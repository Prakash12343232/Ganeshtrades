const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { generateTestToken } = require('./setup');

describe('Deliveries Workflow', () => {
  let adminToken, order;

  beforeEach(async () => {
    const admin = await User.create({ name: 'Ad', mobile: '9000000020', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);
    const customer = await User.create({ name: 'Cu', mobile: '9000000021', password: 'password123', role: 'customer' });
    const product = await Product.create({ name: 'P', category: 'snacks', price: 10, stock: 50 });
    order = await Order.create({
      user: customer._id,
      items: [{ product: product._id, quantity: 1, price: 10, total: 10 }],
      totalAmount: 10, finalAmount: 10,
      orderStatus: 'pending'
    });
  });

  it('should assign a delivery and update order status to delivered', async () => {
    // 1. Assign Delivery
    const res = await request(app)
      .post('/api/deliveries')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderId: order._id, deliveryPersonName: 'Delivery Man', deliveryPersonMobile: '9111111111' });
    expect(res.statusCode).toEqual(201);
    const deliveryId = res.body.data._id;

    // 2. Update to Delivered
    const res2 = await request(app)
      .put(`/api/deliveries/${deliveryId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'delivered' });
    expect(res2.statusCode).toEqual(200);

    // 3. Verify Order status is 'delivered'
    const o = await Order.findById(order._id);
    expect(o.orderStatus).toEqual('delivered');
  });
});
