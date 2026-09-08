const OtpService = require('../services/otpService');
const SmsProvider = require('../services/smsProvider');
const connectDB = require('../config/db');

/**
 * Controller: Send OTP (POST /api/otp/send)
 */
async function sendOtpController(req, res) {
  try {
    const { mobile, purpose } = req.body || {};

    if (!mobile || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both mobile number and purpose.'
      });
    }

    // Ensure database connection
    await connectDB();

    // 1. Generate OTP, enforce rate limits/cooldown, store SHA-256 hash in DB
    const { otpCode, normMobile } = await OtpService.generateAndStoreOtp(mobile, purpose);

    // 2. Dispatch OTP via SMS provider
    await SmsProvider.sendOtp(normMobile, otpCode, purpose);

    // 3. Respond WITHOUT exposing OTP in the response payload
    return res.json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    const errorMessage = error.message || 'An error occurred while generating/sending OTP.';
    const statusCode = errorMessage.includes('wait') || errorMessage.includes('Maximum') ? 429 : 400;
    
    return res.status(statusCode).json({
      success: false,
      message: errorMessage
    });
  }
}

/**
 * Controller: Verify OTP (POST /api/otp/verify)
 */
async function verifyOtpController(req, res) {
  try {
    const { mobile, otp, purpose } = req.body || {};

    if (!mobile || !otp || !purpose) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: 'Mobile number, OTP, and purpose are required.'
      });
    }

    // Ensure database connection
    await connectDB();

    // Verify OTP against stored SHA-256 hash
    const result = await OtpService.verifyOtp(mobile, otp, purpose);

    if (result.verified) {
      return res.json({
        success: true,
        verified: true
      });
    } else {
      return res.status(400).json({
        success: false,
        verified: false,
        message: result.message || 'Invalid or expired OTP'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      verified: false,
      message: 'An error occurred while verifying OTP.'
    });
  }
}

/**
 * Controller: Service Health Check (GET /api/health)
 */
async function healthController(req, res) {
  return res.json({
    success: true,
    service: 'otp-service',
    status: 'healthy'
  });
}

module.exports = {
  sendOtpController,
  verifyOtpController,
  healthController
};
