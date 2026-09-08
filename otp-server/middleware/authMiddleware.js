/**
 * Server-to-Server Authentication Middleware for OTP Server.
 * Enforces Authorization: Bearer <OTP_SERVICE_API_KEY> header.
 */
function authenticateOtpService(req, res, next) {
  const expectedApiKey = process.env.OTP_SERVICE_API_KEY;

  if (!expectedApiKey) {
    if (process.env.NODE_ENV === 'test') {
      return next();
    }
    console.error('❌ [AUTH ERROR] OTP_SERVICE_API_KEY environment variable is missing on OTP Server.');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error: OTP_SERVICE_API_KEY is unconfigured.'
    });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized request: Missing or invalid Authorization header.'
    });
  }

  const providedKey = authHeader.split(' ')[1]?.trim();

  if (!providedKey || providedKey !== expectedApiKey.trim()) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized request: Invalid OTP service API key.'
    });
  }

  next();
}

module.exports = authenticateOtpService;
