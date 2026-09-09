const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const CreditTransaction = require('../models/CreditTransaction');
const Settlement = require('../models/Settlement');
const { generateTestToken } = require('./setup');

const CUSTOMER_ADDRESS = { street: 'Test Street', area: 'Test Area', city: 'Pune', pincode: '411001', lat: 18.557473097373734, lng: 73.92156518195121 };

describe('Money-ledger integrity: cancellation after a Khata settlement', () => {
  let adminToken, customer, product;

  beforeEach(async () => {
    const admin = await User.create({ name: 'Ad', mobile: '9000000070', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);
    customer = await User.create({
      name: 'Cu',
      mobile: '9000000071',
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

  it('cancelling a credit order after a partial settlement never drives creditBalance negative', async () => {
    const placed = await placeOrder('credit');
    expect(placed.statusCode).toEqual(201);
    const orderId = placed.body.data._id;
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 200);

    // Settle ₹150 of the ₹200 Khata debt — recorded in the Settlement
    // collection, not as a Payment, so the reversal must not refund it again.
    const settleRes = await settle(150);
    expect(settleRes.statusCode).toEqual(201);
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 50);

    const cancelRes = await cancelAsAdmin(orderId);
    expect(cancelRes.statusCode).toEqual(200);

    // Only the still-carried ₹50 is reversed → 0, never −₹150.
    const u = await User.findById(customer._id);
    expect(u.creditBalance).toEqual(0);
    await expect(Product.findById(product._id)).resolves.toHaveProperty('stock', 20);

    const reversalTx = await CreditTransaction.findOne({ referenceOrder: orderId, type: 'credit', description: /Cancelled order/ });
    expect(reversalTx).not.toBeNull();
    expect(reversalTx.amount).toEqual(50);
  });

  it('cancelling a cash order after a settlement reverses only the remaining pending amount', async () => {
    const placed = await placeOrder('cash');
    expect(placed.statusCode).toEqual(201);
    const orderId = placed.body.data._id;
    await expect(User.findById(customer._id)).resolves.toHaveProperty('pendingAmount', 200);

    const settleRes = await settle(80);
    expect(settleRes.statusCode).toEqual(201);
    await expect(User.findById(customer._id)).resolves.toHaveProperty('pendingAmount', 120);

    const cancelRes = await cancelAsAdmin(orderId);
    expect(cancelRes.statusCode).toEqual(200);

    await expect(User.findById(customer._id)).resolves.toHaveProperty('pendingAmount', 0);
    await expect(Product.findById(product._id)).resolves.toHaveProperty('stock', 20);
  });

  it('cancelling an order whose debt was fully settled leaves the balance at 0 (never negative)', async () => {
    const placed = await placeOrder('credit');
    expect(placed.statusCode).toEqual(201);
    const orderId = placed.body.data._id;

    const settleRes = await settle(200);
    expect(settleRes.statusCode).toEqual(201);
    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 0);

    const cancelRes = await cancelAsAdmin(orderId);
    expect(cancelRes.statusCode).toEqual(200);

    await expect(User.findById(customer._id)).resolves.toHaveProperty('creditBalance', 0);
    await expect(Product.findById(product._id)).resolves.toHaveProperty('stock', 20);
    // Fully settled + cancelled → no extra reversal journal entry (the order's
    // only credit transactions are the settlement and the order debit).
    const reversalTxs = await CreditTransaction.find({ referenceOrder: orderId, type: 'credit', description: /Cancelled order/ });
    expect(reversalTxs).toHaveLength(0);
    await expect(Settlement.countDocuments({ user: customer._id })).resolves.toEqual(1);
  });
});