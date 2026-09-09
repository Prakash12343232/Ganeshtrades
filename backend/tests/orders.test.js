const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const { generateTestToken } = require('./setup');

describe('Orders and Stock Deduction', () => {
  let token, product, customer;

  beforeEach(async () => {
    customer = await User.create({
      name: 'Cust',
      mobile: '9000000000',
      password: 'password123',
      role: 'customer',
      address: { street: 'Test', city: 'Pune', lat: 18.557473097373734, lng: 73.92156518195121 }
    });
    token = generateTestToken(customer._id);
    product = await Product.create({ name: 'Rice', category: 'rice_grains', price: 100, stock: 50 });
  });

  it('should create an order and deduct stock', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ product: product._id, quantity: 5 }],
        paymentMethod: 'cash'
      });
    
    expect(res.statusCode).toEqual(201);
    
    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toEqual(45); // 50 - 5
    expect(updatedProduct.totalSold).toEqual(5);
  });

  it('GET /api/orders should report paidAmount and outstandingAmount for admin UIs', async () => {
    const admin = await User.create({ name: 'Ad', mobile: '9000000022', password: 'password123', role: 'admin' });
    const adminToken = generateTestToken(admin._id);

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product: product._id, quantity: 2 }], paymentMethod: 'cash' });
    expect(orderRes.statusCode).toEqual(201);
    const orderId = orderRes.body.data._id;

    const listRes = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.statusCode).toEqual(200);
    const listed = listRes.body.data.find((o) => String(o._id) === String(orderId));
    expect(listed.paidAmount).toEqual(0);
    expect(listed.outstandingAmount).toEqual(listed.finalAmount);

    const payRes = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: customer._id, orderId, amount: 80, paymentMethod: 'cash' });
    expect(payRes.statusCode).toEqual(201);

    const listRes2 = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`);
    const listed2 = listRes2.body.data.find((o) => String(o._id) === String(orderId));
    expect(listed2.paidAmount).toEqual(80);
    expect(listed2.outstandingAmount).toEqual(listed2.finalAmount - 80);
    expect(listed2.paymentStatus).toEqual('partial');
  });
});
