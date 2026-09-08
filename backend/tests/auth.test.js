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
        address: { street: 'Test', city: 'Pune', lat: 18.557473097373734, lng: 73.92156518195121 }
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

  describe('PUT /api/auth/password (change password)', () => {
    const registerAndGetToken = async (mobile) => {
      const reg = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Pw Change User',
          mobile,
          password: 'password123',
          customerType: 'public',
          address: { street: 'Test', city: 'Pune', lat: 18.557473097373734, lng: 73.92156518195121 }
        });
      expect(reg.statusCode).toEqual(201);
      return reg.body.token;
    };

    it('rejects a new password that does not meet strength requirements', async () => {
      const token = await registerAndGetToken('9876500001');
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'password123', newPassword: 'short1!' });
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual('Password too weak');
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors).toContain('At least 8 characters');
    });

    it('rejects when current password is incorrect', async () => {
      const token = await registerAndGetToken('9876500002');
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'wrong-pass', newPassword: 'NewPass@123' });
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual('Current password is incorrect');
    });

    it('updates the password and allows login with the new one', async () => {
      const token = await registerAndGetToken('9876500003');
      const res = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'password123', newPassword: 'NewPass@123' });
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);

      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ mobile: '9876500003', password: 'password123' });
      expect(oldLogin.statusCode).toEqual(401);

      const newLogin = await request(app)
        .post('/api/auth/login')
        .send({ mobile: '9876500003', password: 'NewPass@123' });
      expect(newLogin.statusCode).toEqual(200);
      expect(newLogin.body.token).toBeDefined();
    });
  });
});
