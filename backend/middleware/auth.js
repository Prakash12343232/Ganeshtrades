const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { needsProfileCompletion } = require('../utils/profileCompletion');

// Authenticated customers may still reach these endpoints while onboarding so
// they can inspect their account, finish profile details, link Google, or change
// a password. Every other protected customer API stays blocked.
const PROFILE_COMPLETION_ALLOWED_PATHS = new Set([
  '/api/auth/me',
  '/api/auth/profile',
  '/api/auth/password',
  '/api/auth/google/link'
]);

// Protect routes - verify JWT
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'testsecret' : undefined);
    if (!jwtSecret) {
      return res.status(500).json({ success: false, message: 'Authentication is not configured' });
    }

    const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    if (!decoded?.id) {
      return res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
    }

    // Profile-completion tokens are intentionally short-lived and scoped. They
    // must never be accepted as a normal application session.
    if (decoded.scope && decoded.scope !== 'session') {
      return res.status(401).json({
        success: false,
        code: 'REGISTRATION_SESSION_EXPIRED',
        message: 'Please complete your profile to continue.'
      });
    }

    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!req.user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    if (needsProfileCompletion(req.user)) {
      const requestPath = (req.originalUrl || '').split('?')[0].replace(/\/+$/, '');
      if (!PROFILE_COMPLETION_ALLOWED_PATHS.has(requestPath)) {
        return res.status(403).json({
          success: false,
          code: 'PROFILE_INCOMPLETE',
          requiresProfileCompletion: true,
          message: 'Complete your profile before using customer features.'
        });
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
  }
};

// Role authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this resource`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
