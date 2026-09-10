const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const errorHandler = require('../middleware/errorHandler');
const { generateTestToken } = require('./setup');

describe('non-auth routes never leak internal error details', () => {
  let token, product, customer, admin, adminToken;

  beforeEach(async () => {
    customer = await User.create({
      name: 'Cust',
      mobile: '9000000100',
      password: 'password123',
      role: 'customer',
      address: { street: 'Test', city: 'Pune', lat: 18.557473, lng: 73.921565 }
    });
    token = generateTestToken(customer._id);
    admin = await User.create({ name: 'Ad', mobile: '9000000200', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);
    product = await Product.create({ name: 'Rice', category: 'rice_grains', price: 100, stock: 50 });
  });

  it('GET /api/products/:id hides Mongoose CastError internals behind a generic message', async () => {
    const res = await request(app).get('/api/products/not-a-valid-objectid');

    expect(res.statusCode).toEqual(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toEqual('An unexpected error occurred. Please try again later.');
    expect(res.body.message).not.toMatch(/CastError|ObjectId|path|String/);
  });

  it('POST /api/orders preserves intentional business validation messages (parse errors)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product: product._id, quantity: 'abc' }], paymentMethod: 'cash' });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toContain('Invalid quantity');
    expect(res.body.message).not.toMatch(/NaN|undefined/);
  });

  it('POST /api/payments preserves intentional business validation messages (parse errors)', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: customer._id, orderId: product._id, amount: 'abc', paymentMethod: 'cash' });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toContain('Invalid amount');
  });

  it('PUT /api/settings passes exposed parse errors to a 400-visible message via the global handler', async () => {
    const res = await request(app)
      .put('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deliveryRadiusKm: 'abc' });

    expect(res.body.message).toContain('Invalid deliveryRadiusKm');
  });
});

describe('global error handler message sanitization', () => {
  const mockRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });

  it('converts internal error details to a generic message', () => {
    const err = new Error('connect ECONNREFUSED mongodb://10.0.0.5:27017/ganesh');
    const res = mockRes();

    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Internal Server Error' });
  });

  it('preserves explicitly exposed business messages', () => {
    const err = new Error('Invalid amount: must be greater than 0 and no more than 10000000');
    err.exposed = true;
    const res = mockRes();

    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: err.message });
  });

  it('preserves mongoose duplicate-key framing', () => {
    const err = new Error('E11000 duplicate key error');
    err.code = 11000;
    err.keyValue = { mobile: '9000000000' };
    const res = mockRes();

    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Duplicate value for mobile. This mobile already exists.' });
  });
});