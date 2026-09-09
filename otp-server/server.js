const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const otpRoutes = require('./routes/otpRoutes');

const app = express();

// Trust Render/Vercel reverse proxies so per-IP rate limits key off the real client
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet());

// CORS configuration (allow requests from Ganesh Backend or configurable origin)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Body Parser Middleware
app.use(express.json({ limit: '10kb' }));

// Mount API Routes
app.use('/api', otpRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ [OTP SERVER UNHANDLED ERROR]:', err.message);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal OTP Server Error'
  });
});

const PORT = process.env.PORT || 5001;

// Start Server if not imported by test suite
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 [OTP SERVER] Running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  }).catch((err) => {
    console.error('❌ Failed to connect to MongoDB, exiting:', err.message);
    process.exit(1);
  });
}

module.exports = app;
