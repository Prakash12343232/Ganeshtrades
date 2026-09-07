const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const { generateTestToken } = require('./setup');

describe('GET /api/users hasCredit filter', () => {
  let adminToken;

  beforeEach(async () => {
    const admin = await User.create({ name: 'Ad', mobile: '9000000040', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);
    await User.create({ name: 'Balanced', mobile: '9000000041', password: 'password123', role: 'customer', creditBalance: 250 });
    await User.create({ name: 'Limit Set', mobile: '9000000042', password: 'password123', role: 'customer', creditLimit: 1000 });
    await User.create({ name: 'No Credit', mobile: '9000000043', password: 'password123', role: 'customer' });
  });

  it('returns only users with an outstanding credit balance or a credit limit', async () => {
    const res = await request(app)
      .get('/api/users?hasCredit=true')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    const names = res.body.data.map(u => u.name);
    expect(names).toContain('Balanced');
    expect(names).toContain('Limit Set');
    expect(names).not.toContain('No Credit');
    expect(names).not.toContain('Ad');
    expect(res.body.pagination.total).toEqual(2);
  });

  it('returns every customer when hasCredit is absent (no behavior change)', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    // 3 customers + 1 admin
    expect(res.body.pagination.total).toEqual(4);
  });

  it('combines hasCredit with the search filter via $and', async () => {
    const res = await request(app)
      .get('/api/users?hasCredit=true&search=Limit')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.map(u => u.name)).toEqual(['Limit Set']);
    expect(res.body.pagination.total).toEqual(1);
  });
});