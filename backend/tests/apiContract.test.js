const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.join(__dirname, '..');
const FRONTEND_API_FILE = path.join(BACKEND_ROOT, '..', 'frontend', 'src', 'services', 'api.js');

const API_BASE = '/api';

// router file -> mount path as registered in backend/server.js
const ROUTE_MOUNTS = {
  'auth.js': '/api/auth',
  'users.js': '/api/users',
  'products.js': '/api/products',
  'orders.js': '/api/orders',
  'payments.js': '/api/payments',
  'reviews.js': '/api/reviews',
  'notifications.js': '/api/notifications',
  'dashboard.js': '/api/dashboard',
  'reports.js': '/api/reports',
  'audit.js': '/api/audit',
  'suppliers.js': '/api/suppliers',
  'expenses.js': '/api/expenses',
  'deliveries.js': '/api/deliveries',
  'backups.js': '/api/backups',
  'settings.js': '/api/settings',
  'media.js': '/api/media'
};

// Endpoints consumed OUTSIDE services/api.js (e.g. media URLs built by utils/mediaUrl.js)
const KNOWN_OUTSIDE_API_CLIENT = new Set(['GET /api/media/:fileId']);

const normalizePath = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

describe('frontend / backend API contract', () => {
  let frontendCalls;
  let backendRoutes;

  beforeAll(() => {
    const frontendSource = fs.readFileSync(FRONTEND_API_FILE, 'utf8');
    const callRegex = /API\.(get|post|put|delete)\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g;
    frontendCalls = [];
    let match;
    while ((match = callRegex.exec(frontendSource)) !== null) {
      const method = match[1].toUpperCase();
      const raw = match[2].slice(1, -1).replace(/\$\{([a-zA-Z0-9_]+)\}/g, ':$1');
      frontendCalls.push({ method, path: normalizePath(`${API_BASE}${raw}`) });
    }

    backendRoutes = new Set();
    const routesDir = path.join(BACKEND_ROOT, 'routes');
    const routeRegex = /router\.(get|post|put|delete)\(\s*(['"])([^'"]*)\2/g;
    for (const file of fs.readdirSync(routesDir)) {
      if (!file.endsWith('.js')) continue;
      if (!ROUTE_MOUNTS[file]) continue;
      const source = fs.readFileSync(path.join(routesDir, file), 'utf8');
      let m;
      while ((m = routeRegex.exec(source)) !== null) {
        const fullPath = normalizePath(`${ROUTE_MOUNTS[file]}${m[3]}`);
        backendRoutes.add(`${m[1].toUpperCase()} ${fullPath}`);
      }
    }
  });

  test('extracts a non-empty set of frontend API calls', () => {
    expect(frontendCalls.length).toBeGreaterThan(20);
  });

  test('extracts a non-empty set of backend routes', () => {
    expect(backendRoutes.size).toBeGreaterThan(20);
  });

  test('every frontend API call has a matching backend route', () => {
    const missing = frontendCalls.filter((c) => !backendRoutes.has(`${c.method} ${c.path}`));
    expect(missing).toEqual([]);
  });

  test('every backend route is reachable from the frontend api client or explicitly allowlisted', () => {
    const frontendKeys = new Set(frontendCalls.map((c) => `${c.method} ${c.path}`));
    const unreachable = [...backendRoutes].filter((r) => !frontendKeys.has(r) && !KNOWN_OUTSIDE_API_CLIENT.has(r));
    expect(unreachable).toEqual([]);
  });
});