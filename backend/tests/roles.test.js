const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const { generateTestToken } = require('./setup');

describe('RBAC (Role Based Access Control)', () => {
  it('should block customer from accessing admin routes', async () => {
    const customer = await User.create({
      name: 'Customer', mobile: '9999999990', password: 'password123', role: 'customer'
    });
    const token = generateTestToken(customer._id);

    const res = await request(app)
      .get('/api/users') // Admin only route
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(403);
  });

  it('should allow admin to access admin routes', async () => {
    const admin = await User.create({
      name: 'Admin', mobile: '9999999991', password: 'password123', role: 'admin'
    });
    const token = generateTestToken(admin._id);

    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
  });
});
