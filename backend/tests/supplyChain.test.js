const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const { generateTestToken } = require('./setup');

describe('Supply Chain Workflow', () => {
  let adminToken, supplier, product;

  beforeEach(async () => {
    const admin = await User.create({ name: 'Ad', mobile: '9000000010', password: 'password123', role: 'admin' });
    adminToken = generateTestToken(admin._id);
    supplier = await Supplier.create({ name: 'S1', mobile: '9123456780' });
    product = await Product.create({ name: 'P1', category: 'snacks', price: 10, stock: 5 });
  });

  it('should create a PO and increase stock upon receipt', async () => {
    // 1. Create PO
    const res = await request(app)
      .post('/api/suppliers/po')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        supplierId: supplier._id,
        items: [{ product: product._id, quantity: 100, unitPrice: 5 }]
      });
    expect(res.statusCode).toEqual(201);
    const poId = res.body.data._id;

    // 2. Receive PO
    const res2 = await request(app)
      .put(`/api/suppliers/po/${poId}/receive`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res2.statusCode).toEqual(200);

    // 3. Verify stock is 105 (5 + 100) and supplier balance is 500
    const p = await Product.findById(product._id);
    expect(p.stock).toEqual(105);

    const s = await Supplier.findById(supplier._id);
    expect(s.balance).toEqual(500);
  });
});
