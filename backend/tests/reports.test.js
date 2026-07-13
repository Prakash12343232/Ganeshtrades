const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const { generateTestToken } = require('./setup');

describe('Reports Workflow', () => {
  let adminToken;

  beforeEach(async () => {
    const admin = await User.create({ name: 'Ad', mobile: '9000000030', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);
    await Product.create({ name: 'Low Stock Item', category: 'snacks', price: 10, stock: 1, minStock: 10 });
    await Product.create({ name: 'High Demand Item', category: 'snacks', price: 10, stock: 40, totalSold: 150 });
  });

  it('should fetch auto-reorder suggestions', async () => {
    const res = await request(app)
      .get('/api/dashboard/auto-reorder')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.statusCode).toEqual(200);
    // Should return both products (one low stock, one high demand)
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should fetch profit-loss report', async () => {
    const res = await request(app)
      .get('/api/reports/profit-loss')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body.data.revenue).toBeDefined();
    expect(res.body.data.netProfit).toBeDefined();
  });
});
