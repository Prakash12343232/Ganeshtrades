const request = require('supertest');
const app = require('../server');
const User = require('../models/User');

describe('Auth Endpoints', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        mobile: '9876543210',
        password: 'password123',
        customerType: 'public',
        address: { street: 'Test', city: 'Pune', lat: 18.5574375, lng: 73.9215625 }
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });

  it('should login an existing user', async () => {
    await User.create({
      name: 'Login User',
      mobile: '8888888888',
      password: 'password123'
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        mobile: '8888888888',
        password: 'password123'
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body.token).toBeDefined();
  });
});
