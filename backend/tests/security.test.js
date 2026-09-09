const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { validateBackupFilename } = require('../utils/security');
const { generateTestToken } = require('./setup');

describe('Security regressions', () => {
  let adminToken, managerToken, customer, otherCustomer, product;

  beforeEach(async () => {
    const admin = await User.create({ name: 'Admin', mobile: '9000000100', password: 'password123', role: 'admin' });
    const manager = await User.create({ name: 'Manager', mobile: '9000000101', password: 'password123', role: 'manager' });
    customer = await User.create({ name: 'Customer', mobile: '9000000102', password: 'password123', role: 'customer' });
    otherCustomer = await User.create({ name: 'Other', mobile: '9000000103', password: 'password123', role: 'customer' });
    product = await Product.create({ name: 'Rice', category: 'rice_grains', price: 100, stock: 10 });
    adminToken = generateTestToken(admin._id);
    managerToken = generateTestToken(manager._id);
  });

  it('rejects payment when user does not own the order', async () => {
    const order = await Order.create({
      user: customer._id,
      items: [{ product: product._id, name: product.name, price: 100, quantity: 1, total: 100 }],
      totalAmount: 100,
      finalAmount: 100,
      paymentMethod: 'cash'
    });

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: otherCustomer._id, orderId: order._id, amount: 100, paymentMethod: 'cash' });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toMatch(/does not match/i);
  });

  it('rejects invalid stock mutations', async () => {
    const res = await request(app)
      .put(`/api/products/${product._id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stock: -5, action: 'set' });

    expect(res.statusCode).toEqual(400);
  });

  it('blocks managers from full database backups', async () => {
    const res = await request(app)
      .get('/api/backups')
      .set('Authorization', `Bearer ${managerToken}`);

    expect(res.statusCode).toEqual(403);
  });

  it('accepts automated backup filenames (daily/weekly/monthly) from the cron jobs', () => {
    expect(() => validateBackupFilename('backup_daily_2026-09-06T20-30-00-007Z.json')).not.toThrow();
    expect(() => validateBackupFilename('backup_weekly_2026-09-06T20-30-00-007Z.json')).not.toThrow();
    expect(() => validateBackupFilename('backup_monthly_2026-09-06T20-30-00-007Z.json')).not.toThrow();
    expect(() => validateBackupFilename('backup_manual_2026-09-06T20-30-00-007Z.json')).not.toThrow();
    expect(() => validateBackupFilename('backup_auto_2026-09-06T20-30-00-007Z.json')).not.toThrow();
  });

  it('still rejects traversal and malformed backup filenames', () => {
    expect(() => validateBackupFilename('../../etc/passwd')).toThrow();
    expect(() => validateBackupFilename('backup_auto_..\\evil.json')).toThrow();
    expect(() => validateBackupFilename('backup_custom_2026-09-06.json')).toThrow();
  });

  it('routes an automated backup download past filename validation to the file lookup', async () => {
    // Proof the validator no longer blocks automated names: the route reaches
    // the disk lookup and returns 404 (file absent) instead of a 400 format error.
    const res = await request(app)
      .get('/api/backups/download/backup_daily_2099-01-01T00-00-00-000Z.json')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toEqual(404);
  });
});
