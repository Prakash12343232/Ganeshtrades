const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const CreditTransaction = require('../models/CreditTransaction');
const { generateTestToken } = require('./setup');

const CUSTOMER_ADDRESS = { street: 'Test Street', area: 'Test Area', city: 'Pune', pincode: '411001', lat: 18.557473097373734, lng: 73.92156518195121 };

describe('Khata settlement + status-path cancellation integrity', () => {
  let adminToken, customer, product;

  beforeEach(async () => {
    const admin = await User.create({ name: 'Ad', mobile: '9000000050', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);
    customer = await User.create({
      name: 'Cu',
      mobile: '9000000051',
      password: 'password123',
      role: 'customer',
      creditLimit: 1000,
      address: CUSTOMER_ADDRESS
    });
    product = await Product.create({ name: 'Rice', category: 'rice_grains', price: 100, stock: 20 });
  });

  const customerToken = () => generateTestToken(customer._id);

  const placeOrder = (paymentMethod) =>
    request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken()}`)
      .send({ items: [{ product: product._id, quantity: 2 }], paymentMethod });

  const asAdmin = (orderId, status) =>
    request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderStatus: status });

  it('status-path cancellation restores stock and reverses pendingAmount for a cash order', async () => {
    const placed = await placeOrder('cash');
    expect(placed.statusCode).toEqual(201);
    const orderId = placed.body.data._id;

    await expect(User.findById(customer._id)).resolves.toHaveProperty('pendingAmount', 200);
    await expect(Product.findById(product._id)).resolves.toHaveProperty('stock', 18);

    const res = await asAdmin(orderId, 'cancelled');
    expect(res.statusCode).toEqual(200);

    const u = await User.findById(customer._id);
    expect(u.pendingAmount).toEqual(0);
    const p = await Product.findById(product._id);
    expect(p.stock).toEqual(20);
    const o = await Order.findById(orderId);
    expect(o.orderStatus).toEqual('cancelled');
    expect(o.cancelReason).toEqual('Cancelled');
    expect(o.statusHistory.some(h => h.status === 'cancelled')).toEqual(true);
  });

  it('status-path cancellation reverses creditBalance and logs a credit transaction', async () => {
    const placed = await placeOrder('credit');
    expect(placed.statusCode).toEqual(201);
    const orderId = placed.body.data._id;

    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 200);

    const res = await asAdmin(orderId, 'cancelled');
    expect(res.statusCode).toEqual(200);

    const u = await User.findById(customer._id);
    expect(u.creditBalance).toEqual(0);
    const tx = await CreditTransaction.findOne({ referenceOrder: orderId, type: 'credit' });
    expect(tx).not.toBeNull();
    expect(tx.amount).toEqual(200);
  });

  it('rejects cancellation of a delivered order via the status path', async () => {
    const placed = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken()}`)
      .send({ items: [{ product: product._id, quantity: 1 }], paymentMethod: 'cash' });
    expect(placed.statusCode).toEqual(201);
    const orderId = placed.body.data._id;

    const delivered = await asAdmin(orderId, 'delivered');
    expect(delivered.statusCode).toEqual(200);

    const res = await asAdmin(orderId, 'cancelled');
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toMatch(/delivered/i);

    // No double stock restore: product stayed sold
    await expect(Product.findById(product._id)).resolves.toHaveProperty('stock', 19);
  });

  it('rejects re-cancelling an already cancelled order via the status path', async () => {
    const placed = await placeOrder('cash');
    expect(placed.statusCode).toEqual(201);
    const orderId = placed.body.data._id;

    const first = await asAdmin(orderId, 'cancelled');
    expect(first.statusCode).toEqual(200);

    const second = await asAdmin(orderId, 'cancelled');
    expect(second.statusCode).toEqual(400);
    expect(second.body.message).toMatch(/already cancelled/i);

    // Second attempt must not double-restore stock or double-credit balances
    await expect(Product.findById(product._id)).resolves.toHaveProperty('stock', 20);
    await expect(User.findById(customer._id)).resolves.toHaveProperty('pendingAmount', 0);
  });
});