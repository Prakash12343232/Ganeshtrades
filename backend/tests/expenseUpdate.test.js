const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Expense = require('../models/Expense');
const { generateTestToken } = require('./setup');

describe('Expense CRUD', () => {
  let admin;
  let adminToken;

  beforeEach(async () => {
    admin = await User.create({
      name: 'Admin', mobile: '9999999997', password: 'password123', role: 'admin'
    });
    adminToken = generateTestToken(admin._id);
  });

  it('should update an existing expense', async () => {
    const expense = await Expense.create({
      category: 'electricity', amount: 1200, date: new Date(), description: 'July bill', loggedBy: admin._id
    });

    const res = await request(app)
      .put(`/api/expenses/${expense._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 1500, description: 'July-August bill', category: 'maintenance' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toEqual(true);
    expect(res.body.data.amount).toEqual(1500);
    expect(res.body.data.description).toEqual('July-August bill');
    expect(res.body.data.category).toEqual('maintenance');
    expect(res.body.data.loggedBy.name).toEqual('Admin');
  });

  it('should return 404 when updating a non-existent expense', async () => {
    const res = await request(app)
      .put('/api/expenses/000000000000000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 100 });

    expect(res.statusCode).toEqual(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('should reject invalid amount on update', async () => {
    const expense = await Expense.create({
      category: 'salary', amount: 5000, date: new Date(), description: 'Weekly payout', loggedBy: admin._id
    });

    const res = await request(app)
      .put(`/api/expenses/${expense._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: -50 });

    expect(res.statusCode).toEqual(400);
    const unchanged = await Expense.findById(expense._id);
    expect(unchanged.amount).toEqual(5000);
  });

  it('does not overwrite loggedBy on update', async () => {
    const expense = await Expense.create({
      category: 'transport', amount: 300, date: new Date(), description: 'Dispatch', loggedBy: admin._id
    });

    const other = await User.create({
      name: 'Other', mobile: '9999999998', password: 'password123', role: 'manager'
    });

    const res = await request(app)
      .put(`/api/expenses/${expense._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Dispatch round 2', loggedBy: other._id });

    expect(res.statusCode).toEqual(200);
    const updated = await Expense.findById(expense._id);
    expect(updated.loggedBy.toString()).toEqual(admin._id.toString());
  });

  it('allows manager to update expenses', async () => {
    const manager = await User.create({
      name: 'Manager', mobile: '9999999999', password: 'password123', role: 'manager'
    });
    const managerToken = generateTestToken(manager._id);
    const expense = await Expense.create({
      category: 'miscellaneous', amount: 100, date: new Date(), description: 'Petty', loggedBy: manager._id
    });

    const res = await request(app)
      .put(`/api/expenses/${expense._id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ amount: 200 });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.amount).toEqual(200);
  });

  it('blocks customers from updating expenses', async () => {
    const customer = await User.create({
      name: 'Customer', mobile: '9999999990', password: 'password123', role: 'customer'
    });
    const customerToken = generateTestToken(customer._id);
    const expense = await Expense.create({
      category: 'salary', amount: 1000, date: new Date(), description: 'Payout', loggedBy: admin._id
    });

    const res = await request(app)
      .put(`/api/expenses/${expense._id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ amount: 900 });

    expect(res.statusCode).toEqual(403);
  });
});