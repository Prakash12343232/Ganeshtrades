const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const { generateTestToken } = require('./setup');

describe('Orders and Stock Deduction', () => {
  let token, product, customer;

  beforeEach(async () => {
    customer = await User.create({
      name: 'Cust',
      mobile: '9000000000',
      password: 'password123',
      role: 'customer',
      address: { street: 'Test', city: 'Pune', lat: 18.5574375, lng: 73.9215625 }
    });
    token = generateTestToken(customer._id);
    product = await Product.create({ name: 'Rice', category: 'rice_grains', price: 100, stock: 50 });
  });

  it('should create an order and deduct stock', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ product: product._id, quantity: 5 }],
        paymentMethod: 'cash'
      });
    
    expect(res.statusCode).toEqual(201);
    
    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct.stock).toEqual(45); // 50 - 5
    expect(updatedProduct.totalSold).toEqual(5);
  });
});
