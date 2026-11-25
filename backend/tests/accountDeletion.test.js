const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Order = require('../models/Order');

const registerUser = async (mobile) => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Delete Me',
      mobile,
      email: `${mobile}@example.com`,
      password: 'password123',
      customerType: 'public',
      address: { street: 'Test', city: 'Pune', lat: 18.557473097373734, lng: 73.92156518195121 }
    });
  expect(res.statusCode).toBe(201);
  return res.body;
};

describe('DELETE /api/auth/account (self-service deletion)', () => {
  it('erases personal identifiers, deactivates the account and revokes the session', async () => {
    const agent = request.agent(app);
    const mobile = '9876500011';
    const reg = await agent
      .post('/api/auth/register')
      .send({
        name: 'Delete Me',
        mobile,
        email: `${mobile}@example.com`,
        password: 'password123',
        customerType: 'public',
        address: { street: 'Test', city: 'Pune', lat: 18.557473097373734, lng: 73.92156518195121 }
      });
    expect(reg.statusCode).toBe(201);

    const del = await agent
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(del.statusCode).toBe(200);
    expect(del.body.success).toBe(true);

    const user = await User.findById(reg.body.user.id);
    expect(user).toBeTruthy();
    expect(user.isActive).toBe(false);
    expect(user.deletedAt).toBeTruthy();
    expect(user.name).toBe('Deleted User');
    expect(user.mobile).toBeUndefined();
    expect(user.email).toBeUndefined();
    expect(user.googleId).toBeUndefined();

    const raw = await User.collection.findOne({ _id: new mongoose.Types.ObjectId(reg.body.user.id) });
    expect(raw.address).toBeUndefined();
    expect(raw.mobile).toBeUndefined();
    expect(raw.email).toBeUndefined();
    expect(raw.googleId).toBeUndefined();
    expect(raw.password).toBeUndefined();

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(me.statusCode).toBe(403);

    const refreshed = await agent.post('/api/auth/refresh');
    expect(refreshed.statusCode).toBe(401);
  });

  it('frees the mobile number so the person can register again', async () => {
    const mobile = '9876500022';
    const reg = await registerUser(mobile);

    const del = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${reg.token}`);
    expect(del.statusCode).toBe(200);

    const again = await registerUser(mobile);
    expect(again.token).toBeDefined();
  });

  it('blocks deletion while dues are pending', async () => {
    const mobile = '9876500033';
    const reg = await registerUser(mobile);
    await User.updateOne({ mobile }, { $set: { pendingAmount: 250 } });

    const del = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${reg.token}`);
    expect(del.statusCode).toBe(400);

    const user = await User.findOne({ mobile });
    expect(user).toBeTruthy();
    expect(user.isActive).toBe(true);
  });

  it('blocks deletion while an order is active', async () => {
    const mobile = '9876500044';
    const reg = await registerUser(mobile);
    await Order.create({ user: reg.user.id, totalAmount: 100, finalAmount: 100 });

    const del = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${reg.token}`);
    expect(del.statusCode).toBe(400);
  });

  it('refuses staff and admin accounts', async () => {
    await User.create({ name: 'Admin', mobile: '9876500055', password: 'password123', role: 'admin' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ mobile: '9876500055', password: 'password123' });
    expect(login.statusCode).toBe(200);

    const del = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(del.statusCode).toBe(403);
  });
});
