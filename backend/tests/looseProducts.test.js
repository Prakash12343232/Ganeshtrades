const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { generateTestToken } = require('./setup');

describe('Loose product weight ordering', () => {
  let token, customer, looseProduct;

  beforeEach(async () => {
    customer = await User.create({
      name: 'Loose Buyer',
      mobile: '9000000100',
      password: 'password123',
      role: 'customer',
      address: { street: 'Test', city: 'Pune', lat: 18.557473097373734, lng: 73.92156518195121 }
    });
    token = generateTestToken(customer._id);

    looseProduct = await Product.create({
      name: 'Loose Sugar',
      category: 'sugar_jaggery',
      price: 150,
      unit: 'kg',
      stock: 0,
      allowLooseSelling: true,
      pricePerKg: 150,
      minOrderQtyGrams: 100,
      stockGrams: 5000
    });
  });

  const placeLooseOrder = (item, extra = {}) => request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({ items: [item], paymentMethod: 'cash', ...extra });

  it('creates a loose order priced per kg and deducts gram stock', async () => {
    const res = await placeLooseOrder({ product: looseProduct._id, quantityGrams: 250 });

    expect(res.statusCode).toEqual(201);
    expect(res.body.data.items[0]).toMatchObject({
      name: 'Loose Sugar',
      isLoose: true,
      quantityGrams: 250,
      quantity: 250,
      pricePerKg: 150,
      total: 37.5
    });
    expect(res.body.data.totalAmount).toEqual(37.5);

    const updated = await Product.findById(looseProduct._id);
    expect(updated.stockGrams).toEqual(4750);
    expect(updated.totalSoldGrams).toEqual(250);
    expect(updated.stock).toEqual(0);
  });

  it('accepts a kg quantity with unit conversion', async () => {
    const res = await placeLooseOrder({ product: looseProduct._id, quantity: 0.5, unit: 'kg' });

    expect(res.statusCode).toEqual(201);
    expect(res.body.data.items[0].quantityGrams).toEqual(500);
    expect(res.body.data.items[0].total).toEqual(75);

    const updated = await Product.findById(looseProduct._id);
    expect(updated.stockGrams).toEqual(4500);
  });

  it('rejects loose orders below the product minimum', async () => {
    const res = await placeLooseOrder({ product: looseProduct._id, quantityGrams: 50 });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toMatch(/Minimum order/i);

    const updated = await Product.findById(looseProduct._id);
    expect(updated.stockGrams).toEqual(5000);
  });

  it('rejects loose orders that exceed gram stock', async () => {
    const res = await placeLooseOrder({ product: looseProduct._id, quantityGrams: 6000 });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toMatch(/Insufficient stock/i);
  });

  it('requires an explicit weight for loose products', async () => {
    const res = await placeLooseOrder({ product: looseProduct._id, quantity: 2 });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toMatch(/by weight/i);
  });

  it('rejects weight-based items for fixed-unit products', async () => {
    const fixed = await Product.create({ name: 'Fixed Rice', category: 'rice_grains', price: 100, stock: 10 });
    const res = await placeLooseOrder({ product: fixed._id, quantityGrams: 500 });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toMatch(/not available for loose ordering/i);
  });

  it('restores gram stock when a loose order is cancelled', async () => {
    const orderRes = await placeLooseOrder({ product: looseProduct._id, quantityGrams: 250 });
    expect(orderRes.statusCode).toEqual(201);

    const cancelRes = await request(app)
      .put(`/api/orders/${orderRes.body.data._id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Test cancellation' });

    expect(cancelRes.statusCode).toEqual(200);
    const updated = await Product.findById(looseProduct._id);
    expect(updated.stockGrams).toEqual(5000);
    expect(updated.totalSoldGrams).toEqual(0);
  });

  it('includes loose products in the in-stock filter when combined with search', async () => {
    const res = await request(app)
      .get('/api/products')
      .query({ availability: 'in_stock', search: 'Loose Sugar' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]._id).toEqual(String(looseProduct._id));
  });

  it('supports gram stock updates through the admin stock endpoint', async () => {
    const admin = await User.create({ name: 'Admin', mobile: '9000000101', password: 'password123', role: 'admin' });
    const adminToken = generateTestToken(admin._id);

    const res = await request(app)
      .put(`/api/products/${looseProduct._id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stockGrams: 1000, action: 'add' });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.stockGrams).toEqual(6000);
  });

  it('keeps fixed-unit order totals and quantities unchanged', async () => {
    const fixed = await Product.create({ name: 'Fixed Dal', category: 'dal_pulses', price: 80, stock: 10 });
    const res = await placeLooseOrder({ product: fixed._id, quantity: 2 });

    expect(res.statusCode).toEqual(201);
    expect(res.body.data.items[0]).toMatchObject({
      isLoose: false,
      quantity: 2,
      price: 80,
      total: 160
    });
    expect(res.body.data.items[0].quantityGrams).toBeUndefined();

    const updated = await Product.findById(fixed._id);
    expect(updated.stock).toEqual(8);
    expect(updated.stockGrams).toEqual(0);
    expect(await Order.countDocuments()).toEqual(1);
  });
});
