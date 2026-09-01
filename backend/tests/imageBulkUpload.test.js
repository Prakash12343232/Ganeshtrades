const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const { generateTestToken } = require('./setup');

describe('Bulk Product Image Upload API', () => {
  let adminToken;
  let adminUser;
  let customerToken;
  let p1, p2;

  beforeEach(async () => {
    adminUser = await User.create({
      name: 'Admin User',
      email: 'adminbulk@test.com',
      password: 'password123',
      mobile: '9876543299',
      role: 'admin'
    });
    adminToken = generateTestToken(adminUser._id);

    const customerUser = await User.create({
      name: 'Customer User',
      email: 'custbulk@test.com',
      password: 'password123',
      mobile: '9876543298',
      role: 'customer'
    });
    customerToken = generateTestToken(customerUser._id);

    p1 = await Product.create({
      name: 'Bulk Test Product 1',
      category: 'spices',
      price: 50,
      stock: 20,
      unit: 'g'
    });

    p2 = await Product.create({
      name: 'Bulk Test Product 2',
      category: 'flour',
      price: 40,
      stock: 30,
      unit: 'kg'
    });
  });

  it('rejects unauthorized non-admin users from bulk uploading images', async () => {
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

    const res = await request(app)
      .post('/api/products/bulk-images')
      .set('Authorization', `Bearer ${customerToken}`)
      .field('productIds', JSON.stringify([p1._id.toString()]))
      .attach('images', pngBuffer, 'p1.png');

    expect(res.statusCode).toBe(403);
  });

  it('allows admin to bulk upload real photographs for multiple products', async () => {
    const pngBuffer1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const pngBuffer2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

    const res = await request(app)
      .post('/api/products/bulk-images')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('productIds', JSON.stringify([p1._id.toString(), p2._id.toString()]))
      .attach('images', pngBuffer1, 'spice.png')
      .attach('images', pngBuffer2, 'flour.png');

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);

    const updatedP1 = await Product.findById(p1._id);
    expect(updatedP1.image).toBeTruthy();
    expect(updatedP1.imageMetadata.length).toBeGreaterThan(0);

    const updatedP2 = await Product.findById(p2._id);
    expect(updatedP2.image).toBeTruthy();
  });

  it('validates matching length between files and productIds', async () => {
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

    const res = await request(app)
      .post('/api/products/bulk-images')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('productIds', JSON.stringify([p1._id.toString(), p2._id.toString()]))
      .attach('images', pngBuffer, 'onlyone.png');

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
