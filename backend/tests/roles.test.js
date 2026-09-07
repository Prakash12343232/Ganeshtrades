const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Settings = require('../models/Settings');
const Expense = require('../models/Expense');
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

  it('should allow manager to update delivery settings', async () => {
    const manager = await User.create({
      name: 'Manager', mobile: '9999999992', password: 'password123', role: 'manager'
    });
    const token = generateTestToken(manager._id);

    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ deliveryRadiusKm: 8 });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.deliveryRadiusKm).toEqual(8);
  });

  it('should allow manager to toggle customer isActive but not change roles', async () => {
    const manager = await User.create({
      name: 'Manager', mobile: '9999999993', password: 'password123', role: 'manager'
    });
    const managerToken = generateTestToken(manager._id);
    const customer = await User.create({
      name: 'Customer', mobile: '9999999994', password: 'password123', role: 'customer', isActive: true
    });

    const toggle = await request(app)
      .put(`/api/users/${customer._id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ isActive: false });
    expect(toggle.statusCode).toEqual(200);
    expect(toggle.body.data.isActive).toEqual(false);

    const roleChange = await request(app)
      .put(`/api/users/${customer._id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ role: 'admin' });
    expect(roleChange.statusCode).toEqual(403);
  });

  it('should allow manager to delete expenses', async () => {
    const manager = await User.create({
      name: 'Manager', mobile: '9999999995', password: 'password123', role: 'manager'
    });
    const token = generateTestToken(manager._id);
    const expense = await Expense.create({
      category: 'miscellaneous', amount: 150, date: new Date(), description: 'Cleaning', loggedBy: manager._id
    });

    const res = await request(app)
      .delete(`/api/expenses/${expense._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(await Expense.findById(expense._id)).toBeNull();
  });

  it('should allow manager to access audit logs', async () => {
    const manager = await User.create({
      name: 'Manager', mobile: '9999999996', password: 'password123', role: 'manager'
    });
    const token = generateTestToken(manager._id);

    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toEqual(true);
  });
});
