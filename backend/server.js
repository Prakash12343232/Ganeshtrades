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
require('dotenv').config();

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

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

// Rate limiting (API routes only)
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: { success: false, message: 'Too many requests, please try again later.' }
  });
  app.use('/api/', limiter);
}

// CORS — Build allowed origins list
const allowedOrigins = [];

// Add configured frontend URL(s) — supports comma-separated list
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach(url => {
    const trimmed = url.trim().replace(/\/+$/, ''); // remove trailing slashes
    if (trimmed) allowedOrigins.push(trimmed);
  });
}

// Render automatically sets RENDER_EXTERNAL_URL — add it as an allowed origin
if (process.env.RENDER_EXTERNAL_URL) {
  const renderUrl = process.env.RENDER_EXTERNAL_URL.trim().replace(/\/+$/, '');
  if (renderUrl && !allowedOrigins.includes(renderUrl)) {
    allowedOrigins.push(renderUrl);
  }
}

// Always allow localhost for development
['http://localhost:5173', 'http://localhost:5000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5000'].forEach(url => {
  if (!allowedOrigins.includes(url)) allowedOrigins.push(url);
});

console.log('🔒 CORS allowed origins:', allowedOrigins);

app.use(cors({
  origin(origin, callback) {
    // Allow requests with no origin (same-origin GET, server-to-server, curl, mobile apps)
    if (!origin) return callback(null, true);
    // Check explicit allowlist
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // In production, also allow *.onrender.com as a safety net
    if (process.env.NODE_ENV === 'production' && origin.endsWith('.onrender.com')) return callback(null, true);
    console.warn(`⛔ CORS rejected origin: ${origin}`);
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true
}));

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
  res.json({ success: true, message: 'Ganesh Trades API is running', timestamp: new Date() });
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
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Ganesh Trades API running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  });
}

module.exports = app;
