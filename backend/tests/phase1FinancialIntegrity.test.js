const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Settlement = require('../models/Settlement');
const CreditTransaction = require('../models/CreditTransaction');
const Delivery = require('../models/Delivery');
const StaffProfile = require('../models/StaffProfile');
const { generateTestToken } = require('./setup');
const { supportsTransactions, withTransaction } = require('../utils/transaction');

const CUSTOMER_ADDRESS = {
  street: 'Test Street',
  area: 'Test Area',
  city: 'Pune',
  pincode: '411001',
  lat: 18.557473097373734,
  lng: 73.92156518195121
};

describe('Phase 1 — financial integrity', () => {
  let admin;
  let adminToken;
  let customer;
  let customerToken;
  let product;

  beforeEach(async () => {
    admin = await User.create({ name: 'Admin', mobile: '9800000001', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);

    customer = await User.create({
      name: 'Customer',
      mobile: '9800000002',
      password: 'password123',
      role: 'customer',
      creditLimit: 10000,
      address: CUSTOMER_ADDRESS
    });
    customerToken = generateTestToken(customer._id);

    product = await Product.create({ name: 'Rice', category: 'rice_grains', price: 100, stock: 50 });
  });

  const placeOrder = (paymentMethod, quantity = 1) =>
    request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ product: product._id, quantity }], paymentMethod });

  const recordPayment = (orderId, amount, paymentMethod = 'cash') =>
    request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: customer._id, orderId, paymentMethod, amount });

  const settle = (amount) =>
    request(app)
      .post('/api/payments/settlement')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: customer._id, amount, paymentMethod: 'cash' });

  const cancelAsAdmin = (orderId) =>
    request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderStatus: 'cancelled' });

  test('worker cash collection on a Khata order reduces creditBalance and journals it', async () => {
    const worker = await User.create({ name: 'Worker', mobile: '9800000003', password: 'password123', role: 'staff' });
    const workerToken = generateTestToken(worker._id);
    await StaffProfile.create({ user: worker._id, category: 'delivery', engagementType: 'internal', isActive: true, createdBy: admin._id });

    const placed = await placeOrder('credit');
    expect(placed.statusCode).toEqual(201);
    const orderId = placed.body.data._id;
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 100);

    const delivery = await Delivery.create({
      order: orderId,
      deliveryPersonName: 'Worker',
      deliveryPersonMobile: '9800000003',
      assignedBy: admin._id,
      assignedWorker: worker._id,
      status: 'on_the_way',
      history: [{ status: 'assigned', note: 'Assigned' }]
    });

    const res = await request(app)
      .post(`/api/worker/deliveries/${delivery._id}/payment`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ amount: 40, paymentMethod: 'cash', idempotencyKey: 'phase1-credit-door' });

    expect(res.statusCode).toEqual(201);
    const updated = await User.findById(customer._id);
    expect(updated.creditBalance).toEqual(60);
    expect(updated.pendingAmount).toEqual(0);
    await expect(Order.findById(orderId)).resolves.toHaveProperty('paymentStatus', 'partial');

    const journal = await CreditTransaction.findOne({ referenceOrder: orderId, type: 'credit', description: /Door payment/ });
    expect(journal).not.toBeNull();
    expect(journal.amount).toEqual(40);
  });

  test('settlement is attributed FIFO and cancelling a fully settled older order never over-reverses a newer debt', async () => {
    const first = await placeOrder('credit');
    const second = await placeOrder('credit');
    expect(first.statusCode).toEqual(201);
    expect(second.statusCode).toEqual(201);
    const firstId = first.body.data._id;
    const secondId = second.body.data._id;
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 200);

    const settleRes = await settle(150);
    expect(settleRes.statusCode).toEqual(201);
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 50);

    const settlement = await Settlement.findOne({ user: customer._id });
    expect(settlement.allocations).toHaveLength(2);
    expect(String(settlement.allocations[0].order)).toEqual(String(firstId));
    expect(settlement.allocations[0].amount).toEqual(100);
    expect(String(settlement.allocations[1].order)).toEqual(String(secondId));
    expect(settlement.allocations[1].amount).toEqual(50);

    await expect(Order.findById(firstId)).resolves.toHaveProperty('paymentStatus', 'paid');
    await expect(Order.findById(secondId)).resolves.toHaveProperty('paymentStatus', 'partial');

    const cancelRes = await cancelAsAdmin(firstId);
    expect(cancelRes.statusCode).toEqual(200);

    // First order was fully settled, so cancelling it must not consume the
    // ₹50 that still belongs to the second order.
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 50);
    await expect(Product.findById(product._id)).resolves.toHaveProperty('stock', 49);
  });

  test('gateway initiation charges only the outstanding amount of a partially paid order', async () => {
    const placed = await placeOrder('credit', 2);
    expect(placed.statusCode).toEqual(201);
    const orderId = placed.body.data._id;
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 200);

    const manual = await recordPayment(orderId, 120, 'cash');
    expect(manual.statusCode).toEqual(201);
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 80);

    const gateway = await request(app)
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ orderId, paymentMode: 'upi' });
    expect(gateway.statusCode).toEqual(200);
    expect(gateway.body.data.amount).toEqual(80);

    const pending = await Payment.findOne({ order: orderId, paymentStatus: 'pending' });
    expect(pending.amount).toEqual(80);

    const verify = await request(app)
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ gatewayOrderId: gateway.body.data.gatewayOrderId, gatewayPaymentId: 'phase1_partial_1' });
    expect(verify.statusCode).toEqual(200);
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 0);
    await expect(Order.findById(orderId)).resolves.toHaveProperty('paymentStatus', 'paid');
  });

  test('payment against an inconsistent ledger is rejected instead of silently clamped', async () => {
    const order = await Order.create({
      user: customer._id,
      items: [{ product: product._id, name: 'Rice', price: 100, quantity: 1, total: 100 }],
      totalAmount: 100,
      finalAmount: 100,
      paymentMethod: 'credit',
      orderStatus: 'processing'
    });

    const res = await recordPayment(order._id, 100, 'cash');
    expect(res.statusCode).toEqual(409);
    expect(res.body.message).toMatch(/ledger inconsistency/i);
    await expect(Payment.countDocuments({ order: order._id })).resolves.toEqual(0);
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 0);
  });

  test('dashboard total outstanding adds pendingAmount + creditBalance exactly once', async () => {
    await User.findByIdAndUpdate(customer._id, { pendingAmount: 300, creditBalance: 200 });

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.totalOutstanding).toEqual(500);
    expect(res.body.data.totalPending).toEqual(500);
  });

  test('transaction helper uses a session when supported and falls back otherwise', async () => {
    const supported = supportsTransactions();
    const result = await withTransaction(async (session) => {
      if (supported) {
        expect(session).not.toBeNull();
        expect(session.inTransaction()).toBe(true);
      } else {
        expect(session).toBeNull();
      }
      return 'ok';
    });
    expect(result).toEqual('ok');
  });
});
