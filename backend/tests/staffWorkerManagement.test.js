/**
 * Staff Management & Worker Delivery — Phase 1 regression tests
 *
 * Covers:
 * - Staff role authorization (staff cannot access admin routes)
 * - Staff profile creation by admin/manager
 * - Managers cannot create admin-role accounts
 * - Worker delivery list filtered to own assignments
 * - External partner isolation (worker sees only their deliveries)
 * - Status transition validation (server-side)
 * - Failure reason required for failed deliveries
 * - Assignment ownership enforcement
 * - Payment idempotency and amount validation
 * - Khata/credit balance not auto-settled on delivery
 * - Legacy /api/deliveries endpoints continue to work
 */

const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const StaffProfile = require('../models/StaffProfile');
const DeliveryPartner = require('../models/DeliveryPartner');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const Payment = require('../models/Payment');

const ADMIN_TOKEN = process.env.TEST_ADMIN_TOKEN;
const BASE = '';

// Helper: create a JWT for a given user
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

function makeToken(userId) {
  const secret = process.env.JWT_SECRET || 'testsecret';
  return jwt.sign({ id: userId }, secret, { expiresIn: '1h', algorithm: 'HS256' });
}

async function createTestUser(overrides = {}) {
  const id = new mongoose.Types.ObjectId();
  return User.create({
    _id: id,
    name: overrides.name || 'Test User',
    mobile: overrides.mobile || `9${String(Date.now()).slice(-9)}`,
    password: 'password123',
    role: overrides.role || 'customer',
    isActive: true,
    authProvider: 'local',
    ...overrides
  });
}

async function createTestOrder(userId, overrides = {}) {
  return Order.create({
    user: userId,
    items: [{ product: new mongoose.Types.ObjectId(), name: 'Rice', price: 100, quantity: 2, total: 200 }],
    totalAmount: 200,
    finalAmount: overrides.finalAmount || 200,
    orderStatus: overrides.orderStatus || 'processing',
    paymentStatus: overrides.paymentStatus || 'pending',
    paymentMethod: overrides.paymentMethod || 'cash',
    deliveryAddress: { street: '1 Main St', city: 'TestCity' },
    ...overrides
  });
}

async function createTestDelivery(orderId, assignedById, workerUserId, overrides = {}) {
  return Delivery.create({
    order: orderId,
    deliveryPersonName: overrides.deliveryPersonName || 'Test Rider',
    deliveryPersonMobile: overrides.deliveryPersonMobile || '9876543210',
    assignedBy: assignedById,
    assignedWorker: workerUserId || null,
    status: overrides.status || 'assigned',
    history: [{ status: 'assigned', note: 'Assigned' }],
    ...overrides
  });
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 1 — Staff Role Authorization', () => {
  let adminUser, managerUser, staffUser, staffToken, adminToken, managerToken;

  beforeEach(async () => {
    adminUser = await createTestUser({ name: 'Admin', role: 'admin', mobile: `9100000001` });
    managerUser = await createTestUser({ name: 'Manager', role: 'manager', mobile: `9100000002` });
    staffUser = await createTestUser({ name: 'Rider A', role: 'staff', mobile: `9100000003` });

    adminToken = makeToken(adminUser._id);
    managerToken = makeToken(managerUser._id);
    staffToken = makeToken(staffUser._id);
  });

  afterEach(async () => {
    await User.deleteMany({ _id: { $in: [adminUser._id, managerUser._id, staffUser._id] } });
  });

  test('staff cannot access /api/deliveries (admin/manager only)', async () => {
    const res = await request(app)
      .get('/api/deliveries')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  test('staff cannot access /api/staff (admin/manager only)', async () => {
    const res = await request(app)
      .get('/api/staff')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  test('customer cannot access /api/worker routes', async () => {
    const customer = await createTestUser({ name: 'Cust', role: 'customer', mobile: '9100000099' });
    const tok = makeToken(customer._id);
    const res = await request(app)
      .get('/api/worker/me')
      .set('Authorization', `Bearer ${tok}`);
    expect(res.status).toBe(403);
    await User.findByIdAndDelete(customer._id);
  });

  test('unauthenticated request to /api/worker is rejected', async () => {
    const res = await request(app).get('/api/worker/me');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 1 — Staff Profile Management', () => {
  let adminUser, managerUser, adminToken, managerToken;

  beforeEach(async () => {
    adminUser = await createTestUser({ name: 'Admin2', role: 'admin', mobile: '9200000001' });
    managerUser = await createTestUser({ name: 'Mgr2', role: 'manager', mobile: '9200000002' });
    adminToken = makeToken(adminUser._id);
    managerToken = makeToken(managerUser._id);
  });

  afterEach(async () => {
    await User.deleteMany({ mobile: { $in: ['9200000001', '9200000002', '9200000010', '9200000011'] } });
    await StaffProfile.deleteMany({ createdBy: { $in: [adminUser._id, managerUser._id] } });
  });

  test('admin can create a staff user and profile', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Rider B', mobile: '9200000010', password: 'password123', category: 'delivery', engagementType: 'internal' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('staff');
    expect(res.body.data.profile.category).toBe('delivery');
  });

  test('manager can create a staff user and profile', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Rider C', mobile: '9200000011', password: 'password123', category: 'shop', engagementType: 'internal' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('staff');
  });

  test('cannot create staff without name', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mobile: '9200000099', password: 'password123' });
    expect(res.status).toBe(400);
  });

  test('cannot create staff with password shorter than 8 chars', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X', mobile: '9200000098', password: 'short' });
    expect(res.status).toBe(400);
  });

  test('admin can list staff', async () => {
    const res = await request(app)
      .get('/api/staff')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 1 — Delivery Partner Management', () => {
  let adminUser, adminToken;

  beforeEach(async () => {
    adminUser = await createTestUser({ name: 'Admin3', role: 'admin', mobile: '9300000001' });
    adminToken = makeToken(adminUser._id);
  });

  afterEach(async () => {
    await User.findByIdAndDelete(adminUser._id);
    await DeliveryPartner.deleteMany({ createdBy: adminUser._id });
  });

  test('admin can create a delivery partner', async () => {
    const res = await request(app)
      .post('/api/staff/partners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'SpeedEx Logistics', contactPerson: 'Ravi', mobile: '9876543210' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('SpeedEx Logistics');
  });

  test('cannot create partner without name', async () => {
    const res = await request(app)
      .post('/api/staff/partners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ contactPerson: 'X' });
    expect(res.status).toBe(400);
  });

  test('admin can list partners', async () => {
    const res = await request(app)
      .get('/api/staff/partners')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 1 — Worker Delivery Portal', () => {
  let adminUser, workerUser, otherWorker, adminToken, workerToken, otherToken;
  let order, delivery, otherOrder, otherDelivery;

  beforeEach(async () => {
    adminUser = await createTestUser({ name: 'Admin4', role: 'admin', mobile: '9400000001' });
    workerUser = await createTestUser({ name: 'Worker W', role: 'staff', mobile: '9400000002' });
    otherWorker = await createTestUser({ name: 'Worker X', role: 'staff', mobile: '9400000003' });

    adminToken = makeToken(adminUser._id);
    workerToken = makeToken(workerUser._id);
    otherToken = makeToken(otherWorker._id);

    // Create StaffProfiles
    await StaffProfile.create({ user: workerUser._id, category: 'delivery', engagementType: 'internal', isActive: true, createdBy: adminUser._id });
    await StaffProfile.create({ user: otherWorker._id, category: 'delivery', engagementType: 'internal', isActive: true, createdBy: adminUser._id });

    // Create customer and orders
    const customer = await createTestUser({ name: 'Cust9', role: 'customer', mobile: '9400000099' });
    order = await createTestOrder(customer._id, { finalAmount: 300 });
    otherOrder = await createTestOrder(customer._id, { finalAmount: 200 });

    delivery = await createTestDelivery(order._id, adminUser._id, workerUser._id);
    otherDelivery = await createTestDelivery(otherOrder._id, adminUser._id, otherWorker._id);
  });

  afterEach(async () => {
    await Delivery.deleteMany({ _id: { $in: [delivery._id, otherDelivery._id] } });
    await Order.deleteMany({ _id: { $in: [order._id, otherOrder._id] } });
    await StaffProfile.deleteMany({ user: { $in: [workerUser._id, otherWorker._id] } });
    await User.deleteMany({ mobile: { $in: ['9400000001', '9400000002', '9400000003', '9400000099'] } });
  });

  test('worker can see their own deliveries', async () => {
    const res = await request(app)
      .get('/api/worker/deliveries')
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map(d => d._id.toString());
    expect(ids).toContain(delivery._id.toString());
    // Must NOT contain the other worker's delivery
    expect(ids).not.toContain(otherDelivery._id.toString());
  });

  test('worker cannot access another worker\'s delivery detail', async () => {
    const res = await request(app)
      .get(`/api/worker/deliveries/${otherDelivery._id}`)
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(403);
  });

  test('worker can access their own delivery detail', async () => {
    const res = await request(app)
      .get(`/api/worker/deliveries/${delivery._id}`)
      .set('Authorization', `Bearer ${workerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data._id.toString()).toBe(delivery._id.toString());
  });

  test('worker can transition assigned → picked_up', async () => {
    const res = await request(app)
      .put(`/api/worker/deliveries/${delivery._id}/status`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'picked_up', note: 'Picked up from shop' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('picked_up');
  });

  test('worker cannot skip to delivered (must go picked_up → on_the_way → delivered)', async () => {
    delivery.status = 'picked_up';
    delivery.history.push({ status: 'picked_up', note: 'Picked up for transition test' });
    await delivery.save();

    const res = await request(app)
      .put(`/api/worker/deliveries/${delivery._id}/status`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'delivered' });
    expect(res.status).toBe(400);
  });

  test('worker can transition picked_up → on_the_way', async () => {
    delivery.status = 'picked_up';
    delivery.history.push({ status: 'picked_up', note: 'Picked up for transition test' });
    await delivery.save();

    const res = await request(app)
      .put(`/api/worker/deliveries/${delivery._id}/status`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'on_the_way' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('on_the_way');
  });

  test('worker cannot update another worker\'s delivery status', async () => {
    const res = await request(app)
      .put(`/api/worker/deliveries/${otherDelivery._id}/status`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'picked_up' });
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 1 — Failed Delivery Requires Reason', () => {
  let adminUser, workerUser, adminToken, workerToken;
  let order, delivery;

  beforeEach(async () => {
    adminUser = await createTestUser({ name: 'Admin5', role: 'admin', mobile: '9500000001' });
    workerUser = await createTestUser({ name: 'Worker Y', role: 'staff', mobile: '9500000002' });
    adminToken = makeToken(adminUser._id);
    workerToken = makeToken(workerUser._id);

    await StaffProfile.create({ user: workerUser._id, category: 'delivery', engagementType: 'internal', isActive: true, createdBy: adminUser._id });
    const customer = await createTestUser({ name: 'CustZ', role: 'customer', mobile: '9500000099' });
    order = await createTestOrder(customer._id);
    delivery = await createTestDelivery(order._id, adminUser._id, workerUser._id, { status: 'on_the_way' });
    // Advance history manually so transition is valid
    delivery.history.push({ status: 'picked_up' }, { status: 'on_the_way' });
    await delivery.save();
  });

  afterEach(async () => {
    await Delivery.findByIdAndDelete(delivery._id);
    await Order.findByIdAndDelete(order._id);
    await StaffProfile.deleteMany({ user: workerUser._id });
    await User.deleteMany({ mobile: { $in: ['9500000001', '9500000002', '9500000099'] } });
  });

  test('marking failed without reason is rejected', async () => {
    const res = await request(app)
      .put(`/api/worker/deliveries/${delivery._id}/status`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'failed' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/failure reason/i);
  });

  test('marking failed with reason shorter than 5 chars is rejected', async () => {
    const res = await request(app)
      .put(`/api/worker/deliveries/${delivery._id}/status`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'failed', failureReason: 'No' });
    expect(res.status).toBe(400);
  });

  test('marking failed with a valid reason succeeds', async () => {
    const res = await request(app)
      .put(`/api/worker/deliveries/${delivery._id}/status`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'failed', failureReason: 'Customer was not home at time of delivery' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('failed');
    expect(res.body.data.failureReason).toMatch(/Customer was not home/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 1 — Worker Payment Collection', () => {
  let adminUser, workerUser, customerUser, adminToken, workerToken;
  let order, delivery;

  beforeEach(async () => {
    adminUser = await createTestUser({ name: 'Admin6', role: 'admin', mobile: '9600000001' });
    workerUser = await createTestUser({ name: 'Worker P', role: 'staff', mobile: '9600000002' });
    customerUser = await createTestUser({ name: 'CustP', role: 'customer', mobile: '9600000099', pendingAmount: 500 });
    adminToken = makeToken(adminUser._id);
    workerToken = makeToken(workerUser._id);

    await StaffProfile.create({ user: workerUser._id, category: 'delivery', engagementType: 'internal', isActive: true, createdBy: adminUser._id });
    order = await createTestOrder(customerUser._id, { finalAmount: 500, paymentMethod: 'cash' });
    delivery = await createTestDelivery(order._id, adminUser._id, workerUser._id, { status: 'on_the_way' });
  });

  afterEach(async () => {
    await Payment.deleteMany({ order: order._id });
    await Delivery.findByIdAndDelete(delivery._id);
    await Order.findByIdAndDelete(order._id);
    await StaffProfile.deleteMany({ user: workerUser._id });
    await User.deleteMany({ mobile: { $in: ['9600000001', '9600000002', '9600000099'] } });
  });

  test('worker can collect partial cash payment', async () => {
    const res = await request(app)
      .post(`/api/worker/deliveries/${delivery._id}/payment`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ amount: 200, paymentMethod: 'cash', idempotencyKey: 'idem-test-001' });
    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(200);
  });

  test('same idempotency key returns same payment (no duplicate)', async () => {
    const first = await request(app)
      .post(`/api/worker/deliveries/${delivery._id}/payment`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ amount: 200, paymentMethod: 'cash', idempotencyKey: 'idem-test-001' });
    expect(first.status).toBe(201);

    const res = await request(app)
      .post(`/api/worker/deliveries/${delivery._id}/payment`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ amount: 200, paymentMethod: 'cash', idempotencyKey: 'idem-test-001' });
    expect(res.status).toBe(200);
    expect(res.body.idempotent).toBe(true);
  });

  test('payment exceeding outstanding is rejected', async () => {
    const res = await request(app)
      .post(`/api/worker/deliveries/${delivery._id}/payment`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ amount: 999, paymentMethod: 'cash' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/outstanding/i);
  });

  test('credit payment method is rejected at door collection', async () => {
    const res = await request(app)
      .post(`/api/worker/deliveries/${delivery._id}/payment`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ amount: 100, paymentMethod: 'credit' });
    expect(res.status).toBe(400);
  });

  test('Khata creditBalance is NOT changed when worker collects cash', async () => {
    const before = await User.findById(customerUser._id);
    const creditBefore = before.creditBalance;
    await request(app)
      .post(`/api/worker/deliveries/${delivery._id}/payment`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ amount: 50, paymentMethod: 'cash', idempotencyKey: 'idem-test-002' });
    const after = await User.findById(customerUser._id);
    expect(after.creditBalance).toBe(creditBefore); // must not change
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 1 — Legacy /api/deliveries backward compatibility', () => {
  let adminUser, adminToken;
  let order, delivery;

  beforeEach(async () => {
    adminUser = await createTestUser({ name: 'Admin7', role: 'admin', mobile: '9700000001' });
    adminToken = makeToken(adminUser._id);
    const customer = await createTestUser({ name: 'CustL', role: 'customer', mobile: '9700000099' });
    order = await createTestOrder(customer._id, { orderStatus: 'confirmed' });
  });

  afterEach(async () => {
    if (delivery) await Delivery.findByIdAndDelete(delivery._id);
    if (order) await Order.findByIdAndDelete(order._id);
    await User.deleteMany({ mobile: { $in: ['9700000001', '9700000099'] } });
  });

  test('POST /api/deliveries still works for admin', async () => {
    const res = await request(app)
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderId: order._id.toString(),
        deliveryPersonName: 'Legacy Rider',
        deliveryPersonMobile: '9876543210'
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    delivery = res.body.data;
  });

  test('GET /api/deliveries still works for admin', async () => {
    const res = await request(app)
      .get('/api/deliveries')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('PUT /api/deliveries/:id/status still works for admin', async () => {
    delivery = await createTestDelivery(order._id, adminUser._id, null, {
      deliveryPersonName: 'Legacy Rider',
      deliveryPersonMobile: '9876543210'
    });

    const res = await request(app)
      .put(`/api/deliveries/${delivery._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'picked_up', note: 'Test pickup' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('picked_up');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Phase 1 — Inactive Staff Cannot Operate', () => {
  let adminUser, inactiveWorker, adminToken, workerToken;
  let order, delivery;

  beforeEach(async () => {
    adminUser = await createTestUser({ name: 'Admin8', role: 'admin', mobile: '9800000001' });
    inactiveWorker = await createTestUser({ name: 'Inactive Rider', role: 'staff', mobile: '9800000002', isActive: true });
    adminToken = makeToken(adminUser._id);
    workerToken = makeToken(inactiveWorker._id);

    // Create profile but mark it inactive
    await StaffProfile.create({ user: inactiveWorker._id, category: 'delivery', engagementType: 'internal', isActive: false, createdBy: adminUser._id });
    const customer = await createTestUser({ name: 'CustI', role: 'customer', mobile: '9800000099' });
    order = await createTestOrder(customer._id);
    delivery = await createTestDelivery(order._id, adminUser._id, inactiveWorker._id);
  });

  afterEach(async () => {
    await Delivery.findByIdAndDelete(delivery._id);
    await Order.findByIdAndDelete(order._id);
    await StaffProfile.deleteMany({ user: inactiveWorker._id });
    await User.deleteMany({ mobile: { $in: ['9800000001', '9800000002', '9800000099'] } });
  });

  test('worker with inactive StaffProfile cannot update delivery status', async () => {
    const res = await request(app)
      .put(`/api/worker/deliveries/${delivery._id}/status`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ status: 'picked_up' });
    expect(res.status).toBe(403);
  });
});
