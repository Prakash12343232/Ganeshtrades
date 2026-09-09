const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
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

  it('does not leak pending/rejected reviews to anonymous users via the status filter', async () => {
    await Review.create({ user: customer._id, product: product._id, rating: 4, comment: 'draft', status: 'pending', isApproved: false });

    const res = await request(app).get('/api/reviews?status=pending');
    expect(res.statusCode).toEqual(403);

    const res2 = await request(app).get('/api/reviews');
    expect(res2.statusCode).toEqual(200);
    expect(res2.body.data).toHaveLength(0);
  });

  it('rejects a forged/customer Authorization header from listing all review statuses', async () => {
    await Review.create({ user: customer._id, product: product._id, rating: 4, comment: 'moderation draft', status: 'pending', isApproved: false });

    const customerRes = await request(app)
      .get('/api/reviews')
      .set('Authorization', `Bearer ${generateTestToken(customer._id)}`);
    expect(customerRes.statusCode).toEqual(200);
    expect(customerRes.body.data).toHaveLength(0);

    const garbageRes = await request(app)
      .get('/api/reviews?status=pending')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(garbageRes.statusCode).toEqual(401);
  });

  it('lets staff filter reviews by moderation status', async () => {
    await Review.create({ user: customer._id, product: product._id, rating: 4, comment: 'pending draft', status: 'pending', isApproved: false });

    const res = await request(app)
      .get('/api/reviews?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toEqual('pending');
  });

  it('lets a user view their own pending review but not another user\'s', async () => {
    await Review.create({ user: customer._id, product: product._id, rating: 4, comment: 'my draft', status: 'pending', isApproved: false });
    await Review.create({ user: otherCustomer._id, product: product._id, rating: 3, comment: 'their draft', status: 'pending', isApproved: false });

    const own = await request(app)
      .get(`/api/reviews?product=${product._id}&user=${customer._id}&limit=1`)
      .set('Authorization', `Bearer ${generateTestToken(customer._id)}`);
    expect(own.statusCode).toEqual(200);
    expect(own.body.data).toHaveLength(1);
    expect(own.body.data[0].comment).toEqual('my draft');

    const others = await request(app)
      .get(`/api/reviews?product=${product._id}&user=${otherCustomer._id}&limit=1`)
      .set('Authorization', `Bearer ${generateTestToken(customer._id)}`);
    expect(others.statusCode).toEqual(200);
    expect(others.body.data.filter(r => r.status !== 'approved')).toHaveLength(0);
  });
});
