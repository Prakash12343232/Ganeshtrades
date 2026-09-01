const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const { generateTestToken } = require('./setup');
const { validateMagicBytes, sanitizeFilename } = require('../middleware/imageSecurity');

describe('Image Management & Security API', () => {
  let adminToken;
  let adminUser;
  let customerToken;
  let customerUser;
  let sampleProduct;

  beforeEach(async () => {
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'password123',
      mobile: '9876543210',
      role: 'admin'
    });
    adminToken = generateTestToken(adminUser._id);

    customerUser = await User.create({
      name: 'Customer User',
      email: 'customer@test.com',
      password: 'password123',
      mobile: '9876543211',
      role: 'customer'
    });
    customerToken = generateTestToken(customerUser._id);

    sampleProduct = await Product.create({
      name: 'Test Basmati Rice',
      description: 'Premium quality rice',
      category: 'rice_grains',
      price: 120,
      stock: 50,
      unit: 'kg'
    });
  });

  describe('Security & Validation Helper Tests', () => {
    it('validates magic bytes correctly for PNG, JPEG, WebP', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0]);
      expect(validateMagicBytes(pngBuffer)).toBe('image/png');

      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0]);
      expect(validateMagicBytes(jpegBuffer)).toBe('image/jpeg');

      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0,
        0x57, 0x45, 0x42, 0x50
      ]);
      expect(validateMagicBytes(webpBuffer)).toBe('image/webp');

      const textBuffer = Buffer.from('hello world plain text file');
      expect(validateMagicBytes(textBuffer)).toBe(false);
    });

    it('sanitizes filenames and strips path traversal characters', () => {
      const dirtyName = '../../../etc/passwd.exe';
      const cleanName = sanitizeFilename(dirtyName, 'image/jpeg');
      expect(cleanName).not.toContain('..');
      expect(cleanName).not.toContain('etc');
      expect(cleanName).not.toContain('.exe');
      expect(cleanName.endsWith('.jpg')).toBe(true);
    });
  });

  describe('Product Image Upload Endpoints', () => {
    it('blocks unauthorized customer users from uploading product images', async () => {
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

      const res = await request(app)
        .post(`/api/products/${sampleProduct._id}/images`)
        .set('Authorization', `Bearer ${customerToken}`)
        .attach('images', pngBuffer, 'test.png');

      expect(res.statusCode).toBe(403);
    });

    it('allows admin to upload a real product image (PNG/WebP/JPG)', async () => {
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

      const res = await request(app)
        .post(`/api/products/${sampleProduct._id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('images', pngBuffer, 'product-rice.png');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.image).toBeTruthy();
      expect(res.body.data.images.length).toBeGreaterThan(0);
    });

    it('rejects malicious non-image file upload attempt (.exe / .sh)', async () => {
      const maliciousBuffer = Buffer.from('#!/bin/bash\necho malicious code');

      const res = await request(app)
        .post(`/api/products/${sampleProduct._id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('images', maliciousBuffer, 'malware.sh');

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('allows admin to set primary image and delete an image', async () => {
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

      // Upload image
      const uploadRes = await request(app)
        .post(`/api/products/${sampleProduct._id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('images', pngBuffer, 'rice-1.png');

      const uploadedUrl = uploadRes.body.data.image;

      // Set primary
      const primaryRes = await request(app)
        .put(`/api/products/${sampleProduct._id}/images/primary`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ imageUrl: uploadedUrl });

      expect(primaryRes.statusCode).toBe(200);
      expect(primaryRes.body.data.image).toBe(uploadedUrl);

      // Delete image
      const deleteRes = await request(app)
        .delete(`/api/products/${sampleProduct._id}/images`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ imageUrl: uploadedUrl });

      expect(deleteRes.statusCode).toBe(200);
      expect(deleteRes.body.success).toBe(true);
    });
  });
});
