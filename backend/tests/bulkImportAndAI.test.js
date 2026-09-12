const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const { generateTestToken } = require('./setup');

describe('Bulk Import & Ganesh AI Assistant API', () => {
  let adminToken;
  let customerToken;
  let adminUser;

  beforeEach(async () => {
    adminUser = await User.create({
      name: 'Admin Owner',
      mobile: '9822123456',
      email: 'admin@ganeshtrades.com',
      password: 'SecurePassword123',
      role: 'admin'
    });
    adminToken = generateTestToken(adminUser._id);

    const customerUser = await User.create({
      name: 'Regular Customer',
      mobile: '9822654321',
      email: 'customer@gmail.com',
      password: 'SecurePassword123',
      role: 'customer'
    });
    customerToken = generateTestToken(customerUser._id);
  });

  describe('Import Templates', () => {
    it('generates an Excel template for products', async () => {
      const res = await request(app)
        .get('/api/import/template/products')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });

    it('generates a CSV template for customers', async () => {
      const res = await request(app)
        .get('/api/import/template/customers?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });

    it('denies access to non-admin customers', async () => {
      const res = await request(app)
        .get('/api/import/template/products')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('Products Bulk Import Flow', () => {
    beforeEach(async () => {
      await Product.create({
        name: 'Existing Basmati Rice',
        category: 'rice_grains',
        price: 120,
        stock: 50,
        sku: 'BAS-001'
      });
    });

    it('previews product rows and detects existing duplicates and invalid fields', async () => {
      const rows = [
        {
          'Product Name': 'New Sugar Pouch',
          'Category': 'Sugar & Jaggery',
          'Price': '45',
          'Wholesale Price': '40',
          'Stock': '100',
          'Unit': 'kg',
          'SKU': 'SUG-001'
        },
        {
          'Product Name': 'Existing Basmati Rice', // Duplicate by name
          'Category': 'rice',
          'Price': '125',
          'Stock': '60'
        },
        {
          'Product Name': '', // Missing name -> error
          'Price': '50'
        }
      ];

      const res = await request(app)
        .post('/api/import/products/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rows });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.totalRows).toBe(3);
      expect(res.body.validCount).toBe(1);
      expect(res.body.duplicateCount).toBe(1);
      expect(res.body.errorCount).toBe(1);

      // Verify normalization
      const validItem = res.body.items[0];
      expect(validItem.data.category).toBe('sugar_jaggery');
      expect(validItem.data.price).toBe(45);
      expect(validItem.data.stock).toBe(100);
    });

    it('commits validated products and respects duplicateAction=skip', async () => {
      const itemsToCommit = [
        {
          rowNumber: 1,
          status: 'valid',
          isDuplicate: false,
          data: {
            name: 'Poha Medium 1kg',
            category: 'rice_grains',
            price: 55,
            stock: 80,
            unit: 'packet'
          }
        },
        {
          rowNumber: 2,
          status: 'duplicate',
          isDuplicate: true,
          data: {
            name: 'Existing Basmati Rice',
            price: 130,
            stock: 60
          }
        }
      ];

      const res = await request(app)
        .post('/api/import/products/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items: itemsToCommit, duplicateAction: 'skip' });

      expect(res.status).toBe(200);
      expect(res.body.createdCount).toBe(1);
      expect(res.body.skippedCount).toBe(1);

      const created = await Product.findOne({ name: 'Poha Medium 1kg' });
      expect(created).toBeTruthy();
      expect(created.price).toBe(55);
    });
  });

  describe('Customers Bulk Import Flow', () => {
    it('previews and validates customers, detecting invalid mobiles', async () => {
      const rows = [
        {
          'Customer Name': 'Ramesh Kirana',
          'Mobile Number': '9876543210',
          'Customer Type': 'hotel',
          'Credit Limit': '20000',
          'City': 'Pune'
        },
        {
          'Customer Name': 'Invalid Phone User',
          'Mobile Number': '12345' // Invalid mobile
        }
      ];

      const res = await request(app)
        .post('/api/import/customers/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rows });

      expect(res.status).toBe(200);
      expect(res.body.validCount).toBe(1);
      expect(res.body.errorCount).toBe(1);
    });

    it('commits customers with default secured credentials', async () => {
      const items = [
        {
          rowNumber: 1,
          status: 'valid',
          isDuplicate: false,
          data: {
            name: 'Gopal Sweets',
            mobile: '9888777666',
            customerType: 'hotel',
            creditLimit: 15000,
            address: { city: 'Pune' },
            role: 'customer'
          }
        }
      ];

      const res = await request(app)
        .post('/api/import/customers/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items });

      expect(res.status).toBe(200);
      expect(res.body.createdCount).toBe(1);

      const created = await User.findOne({ mobile: '9888777666' });
      expect(created).toBeTruthy();
      expect(created.creditLimit).toBe(15000);
    });
  });

  describe('Inventory Bulk Update Flow', () => {
    let testProduct;

    beforeEach(async () => {
      testProduct = await Product.create({
        name: 'Moong Dal Premium',
        category: 'dal_pulses',
        price: 140,
        stock: 20,
        sku: 'MNG-001'
      });
    });

    it('previews inventory updates calculating new stock amounts', async () => {
      const rows = [
        {
          'identifier': 'MNG-001',
          'stock': '30',
          'action': 'add'
        }
      ];

      const res = await request(app)
        .post('/api/import/inventory/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rows });

      expect(res.status).toBe(200);
      expect(res.body.validCount).toBe(1);
      expect(res.body.items[0].currentStock).toBe(20);
      expect(res.body.items[0].newStock).toBe(50);
    });

    it('commits inventory stock update', async () => {
      const items = [
        {
          status: 'valid',
          productId: testProduct._id,
          newStock: 85
        }
      ];

      const res = await request(app)
        .post('/api/import/inventory/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ items });

      expect(res.status).toBe(200);
      expect(res.body.updatedCount).toBe(1);

      const refreshed = await Product.findById(testProduct._id);
      expect(refreshed.stock).toBe(85);
    });
  });

  describe('Ganesh AI Assistant Endpoint', () => {
    it('returns business snapshot to authorized admin', async () => {
      const res = await request(app)
        .get('/api/ai/snapshot')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.today).toBeDefined();
      expect(res.body.data.inventory).toBeDefined();
      expect(res.body.data.finance).toBeDefined();
    });

    it('answers executive questions using live database calculations', async () => {
      const res = await request(app)
        .post('/api/ai/assistant')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ query: "What are today's orders?" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.answer).toBe('string');
      expect(res.body.answer.toLowerCase()).toContain('order');
      expect(res.body.snapshot).toBeDefined();
    });

    it('answers low stock inquiry', async () => {
      const res = await request(app)
        .post('/api/ai/assistant')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ query: 'Which products are low in stock?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.answer).toBeDefined();
    });

    it('denies unauthenticated access to assistant', async () => {
      const res = await request(app)
        .post('/api/ai/assistant')
        .send({ query: "What are today's orders?" });

      expect(res.status).toBe(401);
    });
  });
});
