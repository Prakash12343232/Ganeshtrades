const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const CreditTransaction = require('../models/CreditTransaction');
const { generateTestToken } = require('./setup');

const CUSTOMER_ADDRESS = { street: 'Test Street', area: 'Test Area', city: 'Pune', pincode: '411001', lat: 18.557473097373734, lng: 73.92156518195121 };

describe('Money-ledger integrity: cancellation vs payments + gateway on credit orders', () => {
  let adminToken, customer, product;

  beforeEach(async () => {
    const admin = await User.create({ name: 'Ad', mobile: '9000000060', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);
    customer = await User.create({
      name: 'Cu',
      mobile: '9000000061',
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

  const cancelAsAdmin = (orderId) =>
    request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderStatus: 'cancelled' });

  const recordPayment = (orderId, amount, paymentMethod = 'cash') =>
    request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: customer._id, orderId, paymentMethod, amount });

  it('cancelling a fully-paid credit order never makes creditBalance negative', async () => {
    const placed = await placeOrder('credit');
    expect(placed.statusCode).toEqual(201);
    const orderId = placed.body.data._id;
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 200);

    const payRes = await recordPayment(orderId, 200, 'cash');
    expect(payRes.statusCode).toEqual(201);
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 0);
    await expect(Order.findById(orderId)).resolves.toHaveProperty('paymentStatus', 'paid');

    const cancelRes = await cancelAsAdmin(orderId);
    expect(cancelRes.statusCode).toEqual(200);

    const u = await User.findById(customer._id);
    expect(u.creditBalance).toEqual(0);
    // Goods return to inventory even when money was already collected.
    await expect(Product.findById(product._id)).resolves.toHaveProperty('stock', 20);
    // No extra reversal entry: the order's only journal entries are the
    // original debit (order) and the payment credit.
    const txs = await CreditTransaction.find({ referenceOrder: orderId });
    expect(txs.map(t => t.type).sort()).toEqual(['credit', 'debit']);
  });

  it('cancelling a partially-paid cash order reverses only the unpaid remainder', async () => {
    const placed = await placeOrder('cash');
    expect(placed.statusCode).toEqual(201);
    const orderId = placed.body.data._id;
    await expect(User.findById(customer._id)).resolves.toHaveProperty('pendingAmount', 200);

    const payRes = await recordPayment(orderId, 120);
    expect(payRes.statusCode).toEqual(201);
    await expect(User.findById(customer._id)).resolves.toHaveProperty('pendingAmount', 80);
    await expect(Order.findById(orderId)).resolves.toHaveProperty('paymentStatus', 'partial');

    const cancelRes = await cancelAsAdmin(orderId);
    expect(cancelRes.statusCode).toEqual(200);

    // remaining 80 reversed → 0, never −120
    await expect(User.findById(customer._id)).resolves.toHaveProperty('pendingAmount', 0);
    await expect(Product.findById(product._id)).resolves.toHaveProperty('stock', 20);
  });

  it('gateway payment on a credit (Khata) order clears creditBalance and logs a credit transaction', async () => {
    const placed = await placeOrder('credit');
    expect(placed.statusCode).toEqual(201);
    const orderId = placed.body.data._id;
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 200);

    const gw = await request(app)
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${customerToken()}`)
      .send({ orderId, paymentMode: 'upi' });
    expect(gw.statusCode).toEqual(200);

    const verify = await request(app)
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${customerToken()}`)
      .send({ gatewayOrderId: gw.body.data.gatewayOrderId, gatewayPaymentId: 'pay_credit_1' });
    expect(verify.statusCode).toEqual(200);

    const u = await User.findById(customer._id);
    expect(u.creditBalance).toEqual(0);
    // Khata debt for that order is fully cleared by the online payment
    await expect(Order.findById(orderId)).resolves.toHaveProperty('paymentStatus', 'paid');
    const tx = await CreditTransaction.findOne({ referenceOrder: orderId, type: 'credit' });
    expect(tx).not.toBeNull();
    expect(tx.amount).toEqual(200);
  });

  it('rejects moving a delivered order backwards (delivered → pending → cancelled)', async () => {
    const placed = await placeOrder('cash');
    const orderId = placed.body.data._id;

    const delivered = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderStatus: 'delivered' });
    expect(delivered.statusCode).toEqual(200);

    const regress = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderStatus: 'pending' });
    expect(regress.statusCode).toEqual(400);
    expect(regress.body.message).toMatch(/delivered/i);

    // Cancelling a delivered order is also blocked, so reversal can never run twice
    const cancel = await cancelAsAdmin(orderId);
    expect(cancel.statusCode).toEqual(400);
    // Stock was never double-restored
    await expect(Product.findById(product._id)).resolves.toHaveProperty('stock', 18);
  });

  it('does not move an already-cancelled order back to an active state', async () => {
    const placed = await placeOrder('cash');
    const orderId = placed.body.data._id;

    const cancelled = await cancelAsAdmin(orderId);
    expect(cancelled.statusCode).toEqual(200);

    const reopen = await request(app)
      .put(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderStatus: 'confirmed' });
    expect(reopen.statusCode).toEqual(400);
    expect(reopen.body.message).toMatch(/already cancelled/i);

    await expect(Product.findById(product._id)).resolves.toHaveProperty('stock', 20);
    await expect(User.findById(customer._id)).resolves.toHaveProperty('pendingAmount', 0);
  });

  it('verifying a payment on an order cancelled after initiation does not double-decrement pendingAmount', async () => {
    // Cash order → pendingAmount +200
    const placed = await placeOrder('upi');
    expect(placed.statusCode).toEqual(201);
    const orderId = placed.body.data._id;

    // Customer starts the gateway before cancellation
    const gw = await request(app)
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${customerToken()}`)
      .send({ orderId, paymentMode: 'net_banking' });
    expect(gw.statusCode).toEqual(200);

    // Admin cancels: pendingAmount 200 → 0 (full amount still owed), stock restored
    const cancelRes = await cancelAsAdmin(orderId);
    expect(cancelRes.statusCode).toEqual(200);
    await expect(User.findById(customer._id)).resolves.toHaveProperty('pendingAmount', 0);

    // The stale gateway attempt completes afterwards — the cancelled order
    // already removed its owed balance, so the payment must not be subtracted again
    const verify = await request(app)
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${customerToken()}`)
      .send({ gatewayOrderId: gw.body.data.gatewayOrderId, gatewayPaymentId: 'pay_late_1' });
    expect(verify.statusCode).toEqual(200);

    const u = await User.findById(customer._id);
    expect(u.pendingAmount).toEqual(0);
    const pay = await Payment.findOne({ order: orderId, paymentStatus: 'completed' });
    expect(pay).not.toBeNull();
    expect(pay.amount).toEqual(200);
  });
});