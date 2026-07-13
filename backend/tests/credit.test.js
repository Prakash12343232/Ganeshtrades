const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const { generateTestToken } = require('./setup');

describe('Khata (Credit) Workflow', () => {
  let adminToken, customer, customerToken, product;

  beforeEach(async () => {
    const admin = await User.create({ name: 'Ad', mobile: '9000000001', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);
    customer = await User.create({
      name: 'Cu',
      mobile: '9000000002',
      password: 'password123',
      role: 'customer',
      creditLimit: 1000,
      creditBalance: 0,
      address: { street: 'Test', city: 'Pune', lat: 18.5574375, lng: 73.9215625 }
    });
    customerToken = generateTestToken(customer._id);
    product = await Product.create({ name: 'Dal', category: 'dal_pulses', price: 200, stock: 100 });
  });

  it('should allow credit order within limit', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ product: product._id, quantity: 1 }], paymentMethod: 'credit' });
    
    expect(res.statusCode).toEqual(201);
    const u = await User.findById(customer._id);
    expect(u.creditBalance).toEqual(200); // 1 * 200
  });

  it('should reject credit order over limit', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ items: [{ product: product._id, quantity: 10 }], paymentMethod: 'credit' }); // 10 * 200 = 2000 > 1000
    
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toMatch(/limit exceeded/i);
  });

  it('should settle credit balance', async () => {
    customer.creditBalance = 500;
    customer.pendingAmount = 500;
    await customer.save();

    const res = await request(app)
      .post('/api/payments/settlement')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: customer._id, amount: 500, paymentMethod: 'cash' });
    
    expect(res.statusCode).toEqual(201);
    const u = await User.findById(customer._id);
    expect(u.creditBalance).toEqual(0);
  });
});
