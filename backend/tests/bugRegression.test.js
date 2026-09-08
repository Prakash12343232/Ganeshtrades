const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { generateTestToken } = require('./setup');

describe('Bug Regression Tests', () => {
  let adminToken, admin, customer, customerToken;

  beforeEach(async () => {
    admin = await User.create({ name: 'Admin', mobile: '9000000200', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);
    customer = await User.create({
      name: 'Customer',
      mobile: '9000000201',
      password: 'password123',
      role: 'customer',
      creditBalance: 500,
      pendingAmount: 300
    });
    customerToken = generateTestToken(customer._id);
  });

  // BUG-04: DELETE /clear-read must be reachable (not shadowed by /:id)
  describe('BUG-04: Notification route ordering', () => {
    it('DELETE /notifications/clear-read returns 200', async () => {
      await Notification.create({ title: 'T', message: 'M', type: 'general', recipient: customer._id, isRead: true });
      const res = await request(app)
        .delete('/api/notifications/clear-read')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/cleared/i);
    });
  });

  // BUG-06: read-all must mark recipientRole:'all' notifications as read FOR THE REQUESTING
  // USER ONLY — read state is per-user (readBy receipts), never a global isRead flip.
  describe('BUG-06: Mark-all-read includes broadcasts (per-user read state)', () => {
    it('marks broadcasts read for the caller without affecting other users', async () => {
      const other = await User.create({ name: 'Other', mobile: '9000000202', password: 'password123', role: 'customer' });
      const otherToken = generateTestToken(other._id);
      await Notification.create({ title: 'Broadcast', message: 'For everyone', type: 'general', recipientRole: 'all', isRead: false });

      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.statusCode).toEqual(200);

      // The broadcast doc is shared and must NOT be globally marked read.
      const broadcast = await Notification.findOne({ recipientRole: 'all' });
      expect(broadcast.isRead).toBe(false);
      expect(broadcast.readBy.map(id => String(id))).toContain(String(customer._id));

      // Caller sees 0 unread.
      const mine = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(mine.body.unreadCount).toEqual(0);
      expect(mine.body.data[0].isRead).toBe(true);

      // Other user still sees it unread.
      const theirs = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${otherToken}`);
      expect(theirs.body.unreadCount).toEqual(1);
      expect(theirs.body.data[0].isRead).toBe(false);
    });
  });

  // BUG-05: Settlement should reject over-balance amount
  describe('BUG-05: Settlement balance validation', () => {
    it('rejects settlement exceeding TOTAL outstanding (credit + pending)', async () => {
      // customer has creditBalance 500 + pendingAmount 300 = 800 owed
      const res = await request(app)
        .post('/api/payments/settlement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: customer._id, amount: 900, paymentMethod: 'cash' });
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/exceeds/i);
    });

    it('rejects settlement when no balance exists', async () => {
      await User.findByIdAndUpdate(customer._id, { creditBalance: 0, pendingAmount: 0 });
      const res = await request(app)
        .post('/api/payments/settlement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: customer._id, amount: 100, paymentMethod: 'cash' });
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/no outstanding balance/i);
    });

    it('applies settlement credit-first so total owed drops by exactly the paid amount', async () => {
      // 500 credit + 300 pending = 800 owed; paying 600 must reduce total by 600
      const res = await request(app)
        .post('/api/payments/settlement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: customer._id, amount: 600, paymentMethod: 'cash' });
      expect(res.statusCode).toEqual(201);
      const u = await User.findById(customer._id);
      expect(u.creditBalance).toEqual(0);   // 500 of 600 went to credit first
      expect(u.pendingAmount).toEqual(200); // remaining 100 of 600 reduced pending
    });

    it('settling the full total outstanding clears both balances', async () => {
      const res = await request(app)
        .post('/api/payments/settlement')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: customer._id, amount: 800, paymentMethod: 'upi' });
      expect(res.statusCode).toEqual(201);
      const u = await User.findById(customer._id);
      expect(u.creditBalance + u.pendingAmount).toEqual(0);
    });
  });

  describe('Cancelled-order payment integrity', () => {
    it('rejects recording a payment against a cancelled order', async () => {
      const product = await Product.create({ name: 'P', category: 'snacks', price: 100, stock: 10 });
      const order = await Order.create({
        user: customer._id,
        items: [{ product: product._id, quantity: 1, price: 100, total: 100 }],
        totalAmount: 100,
        finalAmount: 100,
        paymentMethod: 'cash',
        orderStatus: 'cancelled',
        cancelReason: 'Cancelled'
      });

      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: customer._id, orderId: order._id, amount: 100, paymentMethod: 'cash' });
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/cancelled/i);
    });
  });

  // BUG-08: Reports reject invalid date strings
  describe('BUG-08: Reports date validation', () => {
    it('rejects invalid startDate in sales report', async () => {
      const res = await request(app)
        .get('/api/reports/sales?startDate=not-a-date&endDate=also-not')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/invalid date/i);
    });

    it('rejects startDate after endDate', async () => {
      const res = await request(app)
        .get('/api/reports/sales?startDate=2025-12-31&endDate=2025-01-01')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toMatch(/before/i);
    });
  });

  // BUG-01/02: Expense audit log should not fail silently
  describe('BUG-01/02: Expense audit logging', () => {
    it('creates expense and records audit log with expense_create action', async () => {
      const res = await request(app)
        .post('/api/expenses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category: 'electricity', amount: 1500, description: 'Monthly bill' });
      expect(res.statusCode).toEqual(201);
      await new Promise(resolve => setTimeout(resolve, 150));
      const log = await AuditLog.findOne({ action: 'expense_create', entity: 'expense' });
      expect(log).not.toBeNull();
    });
  });
});
