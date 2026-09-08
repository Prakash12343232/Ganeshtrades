const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { generateTestToken } = require('./setup');

describe('Notifications — per-user read state isolation', () => {
  let admin, adminToken, customerA, customerAToken, customerB, customerBToken;

  beforeEach(async () => {
    admin = await User.create({ name: 'Admin', mobile: '9000000400', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);
    customerA = await User.create({ name: 'A', mobile: '9000000401', password: 'password123', role: 'customer' });
    customerAToken = generateTestToken(customerA._id);
    customerB = await User.create({ name: 'B', mobile: '9000000402', password: 'password123', role: 'customer' });
    customerBToken = generateTestToken(customerB._id);
  });

  it('marking a broadcast read affects only the requesting user', async () => {
    const broadcast = await Notification.create({ title: 'Broadcast', message: 'Hi all', type: 'general', recipientRole: 'all' });

    const res = await request(app)
      .put(`/api/notifications/${broadcast._id}/read`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.statusCode).toEqual(200);

    const fromDb = await Notification.findById(broadcast._id);
    expect(fromDb.isRead).toBe(false);
    expect(fromDb.readBy.map(id => String(id))).toEqual([String(customerA._id)]);

    const mine = await request(app).get('/api/notifications').set('Authorization', `Bearer ${customerAToken}`);
    expect(mine.body.unreadCount).toEqual(0);
    expect(mine.body.data[0].isRead).toBe(true);

    const theirs = await request(app).get('/api/notifications').set('Authorization', `Bearer ${customerBToken}`);
    expect(theirs.body.unreadCount).toEqual(1);
    expect(theirs.body.data[0].isRead).toBe(false);
  });

  it('targeted notifications still use per-document isRead semantics', async () => {
    await Notification.create({ title: 'ForA', message: 'Only A', type: 'order', recipient: customerA._id });
    const forB = await Notification.create({ title: 'ForB', message: 'Only B', type: 'order', recipient: customerB._id });

    const res = await request(app)
      .put(`/api/notifications/${forB._id}/read`)
      .set('Authorization', `Bearer ${customerBToken}`);
    expect(res.statusCode).toEqual(200);
    expect((await Notification.findById(forB._id)).isRead).toBe(true);

    const mine = await request(app).get('/api/notifications').set('Authorization', `Bearer ${customerBToken}`);
    expect(mine.body.unreadCount).toEqual(0);

    const a = await request(app).get('/api/notifications').set('Authorization', `Bearer ${customerAToken}`);
    expect(a.body.unreadCount).toEqual(1);
    expect(a.body.data[0].isRead).toBe(false);
  });

  it('clear-read deletes only the caller’s targeted read notifications, never broadcasts', async () => {
    const broadcast = await Notification.create({ title: 'Broadcast', message: 'For everyone', type: 'general', recipientRole: 'all' });
    const aRead = await Notification.create({ title: 'A read', message: 'T', type: 'general', recipient: customerA._id, isRead: true });
    const aUnread = await Notification.create({ title: 'A unread', message: 'T', type: 'general', recipient: customerA._id, isRead: false });
    const bRead = await Notification.create({ title: 'B read', message: 'T', type: 'general', recipient: customerB._id, isRead: true });

    const res = await request(app)
      .delete('/api/notifications/clear-read')
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.message).toMatch(/cleared/i);

    expect(await Notification.findById(aRead._id)).toBeNull();
    expect(await Notification.findById(aUnread._id)).not.toBeNull();
    expect(await Notification.findById(bRead._id)).not.toBeNull();
    expect(await Notification.findById(broadcast._id)).not.toBeNull();
  });

  it('a regular user cannot delete a shared broadcast notification', async () => {
    const broadcast = await Notification.create({ title: 'Broadcast', message: 'For everyone', type: 'general', recipientRole: 'all' });

    const forbidden = await request(app)
      .delete(`/api/notifications/${broadcast._id}`)
      .set('Authorization', `Bearer ${customerBToken}`);
    expect(forbidden.statusCode).toEqual(403);
    expect(await Notification.findById(broadcast._id)).not.toBeNull();

    const allowed = await request(app)
      .delete(`/api/notifications/${broadcast._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(allowed.statusCode).toEqual(200);
    expect(await Notification.findById(broadcast._id)).toBeNull();
  });

  it('a user can delete their own targeted notification but not someone else’s', async () => {
    const own = await Notification.create({ title: 'Own', message: 'T', type: 'general', recipient: customerA._id });
    const others = await Notification.create({ title: 'Other', message: 'T', type: 'general', recipient: customerB._id });

    const forbidden = await request(app)
      .delete(`/api/notifications/${others._id}`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(forbidden.statusCode).toEqual(403);

    const allowed = await request(app)
      .delete(`/api/notifications/${own._id}`)
      .set('Authorization', `Bearer ${customerAToken}`);
    expect(allowed.statusCode).toEqual(200);
  });
});