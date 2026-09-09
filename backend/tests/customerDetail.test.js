const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const CreditTransaction = require('../models/CreditTransaction');
const { generateTestToken } = require('./setup');

describe('Admin Customer Detail endpoints', () => {
  let admin, adminToken, customer, product;

  beforeEach(async () => {
    admin = await User.create({ name: 'Admin', mobile: '9000000100', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);
    customer = await User.create({
      name: 'Cust Detail', mobile: '9000000200', password: 'password123', role: 'customer',
      creditBalance: 500, creditLimit: 2000, pendingAmount: 300,
      address: { street: '123 Main', city: 'Pune', lat: 18.557, lng: 73.921 }
    });
    product = await Product.create({ name: 'Sugar', category: 'rice_grains', price: 50, stock: 100 });
  });

  describe('GET /api/orders?userId=', () => {
    it('should filter orders by userId for admin', async () => {
      const custToken = generateTestToken(customer._id);
      const createRes = await request(app).post('/api/orders').set('Authorization', `Bearer ${custToken}`)
        .send({ items: [{ product: product._id, quantity: 2 }], paymentMethod: 'cash' });
      expect(createRes.statusCode).toEqual(201);

      const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${adminToken}`)
        .query({ userId: customer._id.toString() });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach(o => expect(String(o.user._id)).toEqual(String(customer._id)));
    });

    it('should return empty array for non-existent userId', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${adminToken}`)
        .query({ userId: fakeId });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/users/:id/credit-history', () => {
    it('should return credit transactions for a user', async () => {
      await CreditTransaction.create({ user: customer._id, amount: 200, type: 'debit', description: 'Order GT001' });
      await CreditTransaction.create({ user: customer._id, amount: 100, type: 'credit', description: 'Settlement' });

      const res = await request(app).get(`/api/users/${customer._id}/credit-history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.transactions.length).toEqual(2);
      expect(res.body.data.user.creditBalance).toEqual(500);
      expect(res.body.data.pagination.total).toEqual(2);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app).get(`/api/users/${fakeId}/credit-history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(404);
    });

    it('should return 403 for customer role', async () => {
      const custToken = generateTestToken(customer._id);
      const res = await request(app).get(`/api/users/${customer._id}/credit-history`)
        .set('Authorization', `Bearer ${custToken}`);

      expect(res.statusCode).toEqual(403);
    });
  });
});
