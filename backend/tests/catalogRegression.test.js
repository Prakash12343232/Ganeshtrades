const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { generateTestToken } = require('./setup');

describe('Product Catalog Status Filter', () => {
  beforeEach(async () => {
    await Product.create({ name: 'Active Rice', category: 'rice_grains', price: 100, stock: 50, status: 'active' });
    await Product.create({ name: 'Archived Dal', category: 'dal_pulses', price: 80, stock: 10, status: 'inactive' });
    await Product.create({ name: 'No-Stock Oil', category: 'oil_ghee', price: 200, stock: 0, status: 'out_of_stock' });
  });

  it('public default excludes inactive but includes out_of_stock', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toEqual(200);
    const names = res.body.data.map(p => p.name);
    expect(names).toContain('Active Rice');
    expect(names).toContain('No-Stock Oil');
    expect(names).not.toContain('Archived Dal');
  });

  it('status=all returns every product including inactive', async () => {
    const res = await request(app).get('/api/products?status=all');
    expect(res.statusCode).toEqual(200);
    const names = res.body.data.map(p => p.name);
    expect(names).toContain('Active Rice');
    expect(names).toContain('Archived Dal');
    expect(names).toContain('No-Stock Oil');
    expect(res.body.data.length).toEqual(3);
  });

  it('status=inactive returns only archived products', async () => {
    const res = await request(app).get('/api/products?status=inactive');
    expect(res.statusCode).toEqual(200);
    const names = res.body.data.map(p => p.name);
    expect(names).toEqual(['Archived Dal']);
  });

  it('status=active returns only active products', async () => {
    const res = await request(app).get('/api/products?status=active');
    expect(res.statusCode).toEqual(200);
    const names = res.body.data.map(p => p.name);
    expect(names).toContain('Active Rice');
    expect(names).not.toContain('Archived Dal');
    expect(names).not.toContain('No-Stock Oil');
  });
});

describe('Reschedule Updates Estimated Delivery Time', () => {
  let token, customer, product;

  beforeEach(async () => {
    customer = await User.create({
      name: 'Cust',
      mobile: '9000000001',
      password: 'password123',
      role: 'customer',
      address: { street: 'Test', city: 'Pune', lat: 18.557473097373734, lng: 73.92156518195121 }
    });
    token = generateTestToken(customer._id);
    product = await Product.create({ name: 'Rice', category: 'rice_grains', price: 100, stock: 50 });
  });

  const futureDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  it('sets estimatedDeliveryTime to the new slot after rescheduling', async () => {
    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ product: product._id, quantity: 2 }],
        paymentMethod: 'cash',
        deliveryType: 'scheduled',
        scheduledDate: futureDateStr(),
        timeSlot: '8 AM - 10 AM'
      });
    expect(created.statusCode).toEqual(201);
    const orderId = created.body.data._id;

    const res = await request(app)
      .put(`/api/orders/${orderId}/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scheduledDate: futureDateStr(), timeSlot: '12 PM - 2 PM' });
    expect(res.statusCode).toEqual(200);

    const fresh = await Order.findById(orderId);
    expect(fresh.estimatedDeliveryTime).toBeInstanceOf(Date);
    expect(fresh.estimatedDeliveryTime.getHours()).toEqual(12);
    expect(fresh.scheduledDelivery.timeSlot).toEqual('12 PM - 2 PM');
  });
});

describe('Payment Verify Idempotency', () => {
  let token, customer;

  beforeEach(async () => {
    customer = await User.create({ name: 'Cust', mobile: '9000000002', password: 'password123', role: 'customer' });
    token = generateTestToken(customer._id);
  });

  it('returns success (not 400) when verifying an already-completed payment', async () => {
    const order = await Order.create({
      user: customer._id,
      items: [{ product: new mongoose.Types.ObjectId(), name: 'Rice', price: 100, quantity: 1, total: 100 }],
      totalAmount: 100,
      finalAmount: 100
    });
    await Payment.create({
      user: customer._id,
      order: order._id,
      amount: 100,
      paymentMethod: 'upi',
      paymentStatus: 'completed',
      gatewayOrderId: 'order_doubleclick_1',
      gatewayPaymentId: 'pay_1'
    });

    const res = await request(app)
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ gatewayOrderId: 'order_doubleclick_1', gatewayPaymentId: 'pay_1' });
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
  });
});