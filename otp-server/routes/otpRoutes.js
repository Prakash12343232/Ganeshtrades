const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authenticateOtpService = require('../middleware/authMiddleware');
const {
  sendOtpController,
  verifyOtpController,
  healthController
} = require('../controllers/otpController');

// Rate limiters for IP-level anti-abuse protection
const sendRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP send requests from this IP address. Please try again after 15 minutes.'
  }
});

const verifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    verified: false,
    message: 'Too many OTP verification requests from this IP address. Please try again later.'
  }
});

// Health check endpoint (public, unauthenticated)
router.get('/health', healthController);

// Send OTP endpoint (requires server-to-server authentication & rate limiting)
router.post('/otp/send', sendRateLimiter, authenticateOtpService, sendOtpController);

// Verify OTP endpoint (requires server-to-server authentication & rate limiting)
router.post('/otp/verify', verifyRateLimiter, authenticateOtpService, verifyOtpController);

module.exports = router;
