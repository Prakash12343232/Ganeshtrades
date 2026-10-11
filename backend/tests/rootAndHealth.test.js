const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../server');

describe('Root and Health Regression Suite (API-only Render routing)', () => {
  let existsSyncSpy;

  afterEach(() => {
    if (existsSyncSpy) {
      existsSyncSpy.mockRestore();
    }
  });

  describe('GET / (Root API endpoint)', () => {
    it('returns 200 with API status and does not throw ENOENT when frontend/dist/index.html is absent', async () => {
      // Force fs.existsSync to report that frontend/dist/index.html is absent (Render production state)
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((targetPath) => {
        if (typeof targetPath === 'string' && targetPath.includes(path.join('frontend', 'dist'))) {
          return false;
        }
        return true;
      });

      const res = await request(app).get('/');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Ganesh Trades API is running');
      expect(res.body.documentation).toBe('/api/health');
      expect(res.body.frontend).toBe('https://ganeshtrades.vercel.app');
    });

    it('returns 200 in simulated production environment without ENOENT crash', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((targetPath) => {
        if (typeof targetPath === 'string' && targetPath.includes(path.join('frontend', 'dist'))) {
          return false;
        }
        return true;
      });

      try {
        const res = await request(app).get('/');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.environment).toBe('production');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  describe('GET /api/health (Health check endpoint)', () => {
    it('continues to return 200 OK with database connection and dbType', async () => {
      const res = await request(app).get('/api/health');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Ganesh Trades API is running');
      expect(typeof res.body.database).toBe('string');
      expect(typeof res.body.dbType).toBe('string');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('Non-API route handling (Render is API-only)', () => {
    it('returns 404 JSON for non-API routes when frontend/dist/index.html is absent without throwing ENOENT', async () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((targetPath) => {
        if (typeof targetPath === 'string' && targetPath.includes(path.join('frontend', 'dist'))) {
          return false;
        }
        return true;
      });

      const res = await request(app).get('/some-frontend-route');

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('https://ganeshtrades.vercel.app');
    });

    it('returns 404 JSON for unmatched /api routes', async () => {
      const res = await request(app).get('/api/nonexistent-endpoint');

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('/api/nonexistent-endpoint');
    });
  });
});
