const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
require('dotenv').config({ override: false });

// Safe startup diagnostics (no secrets printed)
// Build trigger: 2026-09-01T19:21:40Z
console.log(`🔧 NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`🔧 MONGODB_URI: ${process.env.MONGODB_URI ? 'set (' + process.env.MONGODB_URI.length + ' chars)' : '❌ NOT SET'}`);
console.log(`🔧 JWT_SECRET: ${process.env.JWT_SECRET ? 'set (' + process.env.JWT_SECRET.length + ' chars)' : '❌ NOT SET'}`);
console.log(`🔧 FRONTEND_URL: ${process.env.FRONTEND_URL || '❌ NOT SET'}`);

const connectDB = require('./config/db');
const { initCronJobs } = require('./config/cron');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const reviewRoutes = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const reportRoutes = require('./routes/reports');
const auditRoutes = require('./routes/audit');
const supplierRoutes = require('./routes/suppliers');
const expenseRoutes = require('./routes/expenses');
const deliveryRoutes = require('./routes/deliveries');
const backupRoutes = require('./routes/backups');
const settingsRoutes = require('./routes/settings');

const app = express();
app.set('trust proxy', 1);

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a strong value of at least 32 characters in production');
}

// Connect to MongoDB
connectDB();

// Init Cron Jobs
if (process.env.NODE_ENV !== 'test') {
  initCronJobs();
}

// ──────────────────────────────────────────────────────────────────────
// CRITICAL: Serve frontend static assets BEFORE any other middleware.
// Vite adds `crossorigin` to <script> and <link> tags in the built HTML.
// This causes the browser to send an Origin header even for same-origin
// requests. If CORS middleware runs first, it rejects these requests
// (returns 500 JSON), and the browser refuses to load the JS/CSS assets.
// By serving static files first, they bypass CORS/Helmet/etc entirely.
// ──────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist, {
    maxAge: '1y',
    immutable: true,
    index: false  // Don't serve index.html for '/' here; the SPA fallback handles it
  }));
}

// CORS — Build allowed origins list
const allowedOrigins = [
  'https://ganeshtrades.vercel.app' // Explicitly allow production Vercel frontend
];

// Add configured frontend URL(s) — supports comma-separated list
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach(url => {
    const trimmed = url.trim().replace(/\/+$/, ''); // remove trailing slashes
    if (trimmed && !allowedOrigins.includes(trimmed)) allowedOrigins.push(trimmed);
  });
}

// Render automatically sets RENDER_EXTERNAL_URL — add it as an allowed origin
if (process.env.RENDER_EXTERNAL_URL) {
  const renderUrl = process.env.RENDER_EXTERNAL_URL.trim().replace(/\/+$/, '');
  if (renderUrl && !allowedOrigins.includes(renderUrl)) {
    allowedOrigins.push(renderUrl);
  }
}

// Vercel automatically sets VERCEL_URL — add it as an allowed origin
if (process.env.VERCEL_URL) {
  const vercelUrl = process.env.VERCEL_URL.trim().replace(/\/+$/, '');
  const formattedUrl = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
  if (!allowedOrigins.includes(formattedUrl)) allowedOrigins.push(formattedUrl);
}

// Allow localhost origins only in development
if (process.env.NODE_ENV !== 'production') {
  ['http://localhost:5173', 'http://localhost:5000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5000', 'http://localhost:3000'].forEach(url => {
    if (!allowedOrigins.includes(url)) allowedOrigins.push(url);
  });
}

console.log('🔒 CORS allowed origins:', allowedOrigins);

// CORS middleware - must run before security and rate-limiting middleware to handle preflights correctly
app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (same-origin GET, server-to-server, curl, mobile apps)
    if (!origin) return callback(null, true);
    // Check explicit allowlist
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // In production, also allow *.onrender.com and *.vercel.app as a safety net
    if (process.env.NODE_ENV === 'production' && (origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app'))) return callback(null, true);
    console.warn(`⛔ CORS rejected origin: ${origin}`);
    return callback(null, false); // Reject cleanly without raising a 500 error in the backend
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

// Rate limiting (API routes only)
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per 15 mins
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' }
  });
  app.use('/api/', limiter);
}

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp());

// Compress responses
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'deny',
  index: false,
  maxAge: '1d',
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
  }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  const dbState = mongoose.connection.readyState;
  const dbStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    success: true,
    message: 'Ganesh Trades API is running',
    environment: process.env.NODE_ENV || 'not set',
    database: dbStatus[dbState] || 'unknown',
    timestamp: new Date()
  });
});

// SPA Fallback: Any non-API route serves index.html for React Router
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'dist', 'index.html'));
  });
} else {
  // Fallback for development if someone hits a non-API route
  app.get('/', (req, res) => {
    res.send('API is running. Frontend is served on localhost:5173 in development.');
  });
}

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
let server;

function gracefulShutdown(signal) {
  console.log(`\n🛑 ${signal} received. Closing Ganesh Trades API server...`);
  if (server && server.listening) {
    server.close(() => {
      console.log('✅ HTTP server closed.');
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 0) {
        mongoose.connection.close(false).then(() => {
          console.log('✅ Database connection closed.');
          process.exit(0);
        }).catch(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
  } else {
    process.exit(0);
  }
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Ganesh Trades API running on 0.0.0.0:${PORT} in ${process.env.NODE_ENV} mode`);
  });

  server.on('error', async (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${PORT} is already in use.`);
      try {
        const http = require('http');
        const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data && data.success && data.message && data.message.includes('Ganesh Trades')) {
                console.log(`✅ Existing active Ganesh Trades API detected on port ${PORT}. Reusing existing backend.`);
                process.exit(0);
              } else {
                console.error(`❌ Port ${PORT} is occupied by an unrelated service.`);
                process.exit(1);
              }
            } catch (e) {
              console.error(`❌ Port ${PORT} is occupied by an unresponsive service.`);
              process.exit(1);
            }
          });
        });
        req.on('error', () => {
          console.error(`❌ Port ${PORT} is occupied by a non-HTTP service.`);
          process.exit(1);
        });
        req.setTimeout(2000, () => {
          req.destroy();
          console.error(`❌ Health check timed out on port ${PORT}.`);
          process.exit(1);
        });
      } catch (checkErr) {
        console.error(`❌ Failed to check port ${PORT}:`, checkErr.message);
        process.exit(1);
      }
    } else {
      console.error('❌ Server startup error:', err);
      process.exit(1);
    }
  });

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGUSR2', () => {
    if (server && server.listening) {
      server.close(() => {
        process.kill(process.pid, 'SIGUSR2');
      });
    } else {
      process.kill(process.pid, 'SIGUSR2');
    }
  });
}

module.exports = app;
