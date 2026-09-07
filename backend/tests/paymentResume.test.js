const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const { generateTestToken } = require('./setup');

describe('Online Payment Resume (aborted payment path)', () => {
  let token, customer, order;

  beforeEach(async () => {
    customer = await User.create({
      name: 'Cust',
      mobile: '9000000011',
      password: 'password123',
      role: 'customer'
    });
    token = generateTestToken(customer._id);
    order = await Order.create({
      user: customer._id,
      items: [{ product: new mongoose.Types.ObjectId(), name: 'Rice', price: 100, quantity: 2, total: 200 }],
      totalAmount: 200,
      finalAmount: 200,
      paymentMethod: 'upi',
      paymentStatus: 'pending'
    });
  });

  async function createGateway(mode) {
    return request(app)
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: order._id, paymentMode: mode });
  }

  it('reuses the same pending payment across retries instead of duplicating', async () => {
    const first = await createGateway('upi');
    expect(first.statusCode).toEqual(200);
    const firstId = first.body.data.gatewayOrderId;

    // Retry after an aborted attempt with a different mode
    const second = await createGateway('debit_card');
    expect(second.statusCode).toEqual(200);
    expect(second.body.data.gatewayOrderId).toEqual(firstId);
    expect(String(second.body.data.paymentId)).toEqual(String(first.body.data.paymentId));

    const pending = await Payment.find({ order: order._id, paymentStatus: 'pending' });
    expect(pending.length).toEqual(1);
    expect(pending[0].paymentMode).toEqual('debit_card');
    expect(pending[0].paymentMethod).toEqual('card');
  });

  it('resumes an aborted payment: verify on the reused pending payment completes and settles the order', async () => {
    const resumed = await createGateway('net_banking');
    expect(resumed.statusCode).toEqual(200);
    const { gatewayOrderId } = resumed.body.data;

    const verifyRes = await request(app)
      .post('/api/payments/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ gatewayOrderId, gatewayPaymentId: 'pay_resume_1', gatewaySignature: 'sig_resume_1' });
    expect(verifyRes.statusCode).toEqual(200);

    const freshOrder = await Order.findById(order._id);
    expect(freshOrder.paymentStatus).toEqual('paid');

    const user = await User.findById(customer._id);
    expect(user.pendingAmount).toEqual(0);
  });

  it('rejects payment initiation for a cancelled order', async () => {
    order.orderStatus = 'cancelled';
    await order.save();

    const res = await createGateway('upi');
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toMatch(/cancelled/i);

    const pending = await Payment.find({ order: order._id });
    expect(pending.length).toEqual(0);
  });
});