const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Otp = require('../models/Otp');
const OtpClient = require('../utils/otpClient');
const { sendOtpSms } = require('../utils/sms');
const { checkServiceability, isValidCoordinates } = require('../utils/distance');
const { protect } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const connectDB = require('../config/db');
const { pickFields, normalizeMobile, generateOTP, hashOTP, verifyOTP, validatePasswordStrength, sanitizeUserForResponse } = require('../utils/security');
const { clientErrorMessage } = require('../utils/errors');
const googleAuth = require('../utils/googleAuth');
const { needsProfileCompletion } = require('../utils/profileCompletion');
const { forwardGeocode } = require('../utils/geocode');

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' }
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { success: false, message: 'Too many OTP requests from this IP, please try again after 15 minutes.' }
});

const getJwtSecret = () => {
  const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'testsecret' : undefined);
  if (!jwtSecret) throw new Error('Authentication is not configured');
  return jwtSecret;
};

// Generate a normal application session JWT
const generateToken = (id) => {
  return jwt.sign({ id, scope: 'session' }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRE || '7d',
    algorithm: 'HS256'
  });
};

// Short-lived token that can ONLY be used to finish Google onboarding.
const generateRegistrationToken = (id) => {
  return jwt.sign({ id, scope: 'profile_completion' }, getJwtSecret(), {
    expiresIn: '30m',
    algorithm: 'HS256',
    audience: 'profile-completion'
  });
};

const verifyRegistrationToken = (token) => {
  const decoded = jwt.verify(token, getJwtSecret(), {
    algorithms: ['HS256'],
    audience: 'profile-completion'
  });
  if (!decoded || decoded.scope !== 'profile_completion' || !decoded.id) {
    const err = new Error('Invalid registration session. Please sign in with Google again.');
    err.statusCode = 401;
    err.exposed = true;
    throw err;
  }
  return decoded;
};

// Never accept a client-supplied role, verification flag, price, or email.
const buildUserResponse = (user) => {
  const safe = sanitizeUserForResponse(user);
  return { ...safe, id: safe._id };
};

const sanitizeAddressInput = (address) => {
  if (!address || typeof address !== 'object' || Array.isArray(address)) return null;

  const fields = { street: 160, area: 160, city: 100, state: 100, pincode: 10 };
  const sanitized = {};
  for (const [field, max] of Object.entries(fields)) {
    if (typeof address[field] === 'string') {
      sanitized[field] = address[field].trim().replace(/\s+/g, ' ').slice(0, max);
    }
  }

  for (const field of ['lat', 'lng']) {
    if (address[field] !== undefined && address[field] !== null && address[field] !== '') {
      const value = Number(address[field]);
      if (Number.isFinite(value)) sanitized[field] = value;
    }
  }

  return sanitized;
};

const CUSTOMER_TYPES = ['public', 'hotel', 'pg_hostel'];

// Check if account is locked
const checkLock = async (user) => {
  if (user.lockUntil && user.lockUntil > Date.now()) {
    const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new Error(`Account locked due to multiple failed attempts. Try again in ${minutesLeft} minutes.`);
  }
};

// @route   GET /api/auth/google/config
// @desc    Get Google OAuth public configuration (client ID availability)
// @access  Public
router.get('/google/config', (req, res) => {
  const clientId = googleAuth.getPrimaryGoogleClientId();
  res.json({
    success: true,
    configured: Boolean(clientId),
    clientId: clientId || null
  });
});

// @route   POST /api/auth/google
// @desc    Authenticate or register user with Google Identity Services token
// @access  Public
router.post('/google', authLimiter, async (req, res) => {
  try {
    const { credential, idToken } = req.body;
    const tokenToVerify = credential || idToken;

    if (!tokenToVerify) {
      return res.status(400).json({
        success: false,
        message: 'Google credential token is required'
      });
    }

    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    // 1. Verify token signature, issuer, audience, and email verification
    const googleProfile = await googleAuth.verifyGoogleToken(tokenToVerify);

    // 2. Find existing user by googleId
    let user = await User.findOne({ googleId: googleProfile.sub });

    // 3. Never infer account ownership from an email match.  A Google identity
    // must be linked by an already authenticated Ganesh Trades user through
    // /google/link; otherwise an attacker with control of an email inbox could
    // take over a mobile/password account (including customer order history).
    if (!user) {
      const existingWithEmail = await User.findOne({ email: googleProfile.email });
      if (existingWithEmail) {
        return res.status(409).json({
          success: false,
          code: 'ACCOUNT_LINK_REQUIRED',
          linkRequired: true,
          message: 'An account with this email already exists. Sign in with your existing account using your mobile number and password, then link Google from Profile > Security & Accounts.'
        });
      }
    }

    // 4. If user still does not exist, create a new customer record
    if (!user) {
      user = await User.create({
        name: googleProfile.name || 'Customer',
        email: googleProfile.email,
        googleId: googleProfile.sub,
        avatar: googleProfile.picture || '',
        role: 'customer', // STRICT: new Google users are ALWAYS customers
        customerType: 'public',
        isEmailVerified: true,
        isActive: true,
        authProvider: 'google',
        profileCompleted: false,
        phoneVerified: false
      });
    }

    // Check account status
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated. Please contact support.'
      });
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(401).json({
        success: false,
        message: `Account temporarily locked. Try again in ${minutesLeft} minutes.`
      });
    }

    // Reset failed login attempts on successful authentication
    if (user.loginAttempts > 0) {
      user.loginAttempts = 0;
      user.lockUntil = undefined;
      await user.save();
    }

    // New Google customers (and legacy Google-only accounts) must finish their
    // profile before a normal session token is issued. The short-lived
    // registration token cannot access any protected API route.
    if (needsProfileCompletion(user)) {
      await createAuditLog(user._id, 'user_login', 'user', user._id, { method: 'google_profile_pending', email: user.email }, req);

      return res.json({
        success: true,
        message: 'Google account verified. Complete your profile to finish creating your account.',
        requiresProfileCompletion: true,
        registrationToken: generateRegistrationToken(user._id),
        profile: {
          name: user.name,
          email: user.email,
          avatar: user.avatar || '',
          googleId: user.googleId
        }
      });
    }

    await createAuditLog(user._id, 'user_login', 'user', user._id, { method: 'google', email: user.email }, req);

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Google login successful',
      token,
      user: {
        ...buildUserResponse(user),
        googleId: user.googleId || null
      }
    });
  } catch (error) {
    console.error('❌ /auth/google error:', error);
    // A Google identity can race with another sign-in, or the email can already
    // exist in a legacy account with different casing. Do not turn this expected
    // account-linking condition into an opaque 500 error.
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This Google account is already associated with a Ganesh Trades account. Sign in with mobile and password, then link Google from your profile if needed.'
      });
    }
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.exposed ? error.message : clientErrorMessage(error, 'Google authentication failed. Please try again.')
    });
  }
});

// @route   POST /api/auth/google/complete-profile
// @desc    Finish Google onboarding and create the customer account
// @access  Public (requires a short-lived profile-completion registration token)
router.post('/google/complete-profile', authLimiter, async (req, res) => {
  try {
    const {
      registrationToken,
      name,
      mobile,
      customerType,
      address
    } = req.body || {};

    if (!registrationToken || typeof registrationToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Registration session is missing. Please sign in with Google again.'
      });
    }

    let decoded;
    try {
      decoded = verifyRegistrationToken(registrationToken);
    } catch (tokenError) {
      return res.status(401).json({
        success: false,
        code: 'REGISTRATION_SESSION_EXPIRED',
        message: 'Your registration session has expired. Please sign in with Google again.'
      });
    }

    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.googleId) {
      return res.status(401).json({
        success: false,
        message: 'Registration session is no longer valid. Please sign in with Google again.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated. Please contact support.'
      });
    }

    // Idempotent retry: once complete, return a normal session instead of
    // allowing the registration token to rewrite an established profile.
    if (user.profileCompleted === true) {
      return res.json({
        success: true,
        message: 'Your Ganesh Trades account is already complete.',
        alreadyCompleted: true,
        token: generateToken(user._id),
        user: buildUserResponse(user)
      });
    }

    const normMobile = normalizeMobile(mobile);
    if (!normMobile) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_MOBILE',
        message: 'Please enter a valid 10-digit Indian mobile number.'
      });
    }

    const cleanName = typeof name === 'string' ? name.trim().slice(0, 100) : '';
    if (!cleanName) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }

    const validCustomerType = CUSTOMER_TYPES.includes(customerType) ? customerType : 'public';

    const sanitizedAddress = sanitizeAddressInput(address);
    if (!sanitizedAddress) {
      return res.status(400).json({ success: false, message: 'A complete delivery address is required.' });
    }

    for (const field of ['street', 'area', 'city', 'state']) {
      if (!sanitizedAddress[field]) {
        return res.status(400).json({
          success: false,
          message: `Address field '${field}' is required.`
        });
      }
    }

    if (!/^\d{6}$/.test(sanitizedAddress.pincode || '')) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 6-digit pincode.'
      });
    }

    // Mobile numbers are unique across local and Google accounts. Never merge
    // two accounts automatically based on a matching number or email.
    const mobileOwner = await User.findOne({
      mobile: normMobile,
      _id: { $ne: user._id }
    }).select('_id');

    if (mobileOwner) {
      return res.status(409).json({
        success: false,
        code: 'MOBILE_IN_USE',
        message: 'This mobile number is already registered. Sign in with your existing account instead.'
      });
    }

    // Delivery radius validation uses the existing shop settings. Manual
    // addresses without coordinates are geocoded server-side; if the address
    // cannot be resolved we ask the customer to detect their location rather
    // than inventing delivery eligibility.
    let lat = Number(sanitizedAddress.lat);
    let lng = Number(sanitizedAddress.lng);

    if (!isValidCoordinates(lat, lng)) {
      try {
        const geocoded = await forwardGeocode(sanitizedAddress);
        lat = Number(geocoded?.lat);
        lng = Number(geocoded?.lng);
      } catch {
        lat = NaN;
        lng = NaN;
      }
    }

    if (!isValidCoordinates(lat, lng)) {
      return res.status(422).json({
        success: false,
        code: 'LOCATION_UNVERIFIED',
        message: 'We could not verify delivery for this address. Please use Detect My Location or check your address details.'
      });
    }

    const serviceCheck = await checkServiceability(lat, lng);
    if (!serviceCheck.serviceable) {
      return res.status(400).json({
        success: false,
        code: 'OUTSIDE_DELIVERY_AREA',
        message: serviceCheck.message,
        serviceability: {
          serviceable: false,
          distance: serviceCheck.distance,
          radius: serviceCheck.radius,
          shopLocation: serviceCheck.shopLocation
        }
      });
    }

    user.name = cleanName;
    user.mobile = normMobile;
    user.customerType = validCustomerType;
    user.address = {
      street: sanitizedAddress.street,
      area: sanitizedAddress.area,
      city: sanitizedAddress.city,
      state: sanitizedAddress.state,
      pincode: sanitizedAddress.pincode,
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6
    };
    user.distanceFromShop = serviceCheck.distance;
    user.profileCompleted = true;
    user.phoneVerified = false;
    user.isEmailVerified = true;

    await user.save();

    await createAuditLog(user._id, 'user_register', 'user', user._id, {
      method: 'google_profile_completion',
      customerType: validCustomerType
    }, req);

    return res.status(201).json({
      success: true,
      message: 'Your Ganesh Trades account is ready.',
      token: generateToken(user._id),
      user: buildUserResponse(user)
    });
  } catch (error) {
    console.error('❌ /auth/google/complete-profile error:', error);
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This mobile number or Google account is already registered. Please sign in with your existing account.'
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.exposed ? error.message : clientErrorMessage(error, 'Unable to create your account right now. Please try again.')
    });
  }
});

// @route   POST /api/auth/google/link
// @desc    Link an existing authenticated account to a verified Google account
// @access  Private (requires existing Bearer token)
router.post('/google/link', protect, async (req, res) => {
  try {
    const { credential, idToken } = req.body;
    const tokenToVerify = credential || idToken;

    if (!tokenToVerify) {
      return res.status(400).json({ success: false, message: 'Google credential token is required' });
    }

    const googleProfile = await googleAuth.verifyGoogleToken(tokenToVerify);

    // Verify this Google ID is not already linked to another account
    const existingWithGoogle = await User.findOne({
      googleId: googleProfile.sub,
      _id: { $ne: req.user._id }
    });

    if (existingWithGoogle) {
      return res.status(409).json({
        success: false,
        message: 'This Google account is already linked to another Ganesh Trades account.'
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If this account has no email, do not attach an email that belongs to a
    // different account. This also gives a clear response instead of relying
    // on the database unique-index error.
    if (!user.email) {
      const existingWithEmail = await User.findOne({
        email: googleProfile.email,
        _id: { $ne: user._id }
      });
      if (existingWithEmail) {
        return res.status(409).json({
          success: false,
          message: 'This Google email is already used by another Ganesh Trades account.'
        });
      }
    }

    user.googleId = googleProfile.sub;
    if (!user.email) {
      user.email = googleProfile.email;
    }
    user.isEmailVerified = true;
    if (!user.avatar && googleProfile.picture) {
      user.avatar = googleProfile.picture;
    }
    // An already-authenticated local customer has completed the details that
    // onboarding would collect, so linking Google must not send them back
    // through profile completion.
    if (user.mobile) {
      user.profileCompleted = true;
    }

    await user.save();

    await createAuditLog(user._id, 'user_update', 'user', user._id, { method: 'google_link', email: googleProfile.email }, req);

    res.json({
      success: true,
      message: 'Google account linked successfully',
      // Return the same complete, sanitized shape as /auth/me so the client can
      // update its stored user without dropping profile or account fields.
      user: buildUserResponse(user)
    });
  } catch (error) {
    console.error('❌ /auth/google/link error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.exposed ? error.message : clientErrorMessage(error, 'Failed to link Google account.')
    });
  }
});

// @route   POST /api/auth/send-otp
// @desc    Send OTP for registration or login
// @access  Public
router.post('/send-otp', otpLimiter, async (req, res) => {
  try {
    const { mobile, purpose } = req.body;
    const normMobile = normalizeMobile(mobile);

    if (!normMobile) {
      return res.status(400).json({ success: false, message: 'Invalid mobile number format. Please provide a valid 10-digit Indian mobile number.' });
    }
    if (!['register', 'login', 'password_reset'].includes(purpose)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP purpose' });
    }

    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    const existingUser = await User.findOne({ mobile: normMobile });

    // Anti-enumeration: return the same generic success body regardless of
    // whether the mobile is registered, and dispatch no OTP in the "wrong
    // purpose" branches — mirroring /forgot-password below. A client can no
    // longer probe which numbers have accounts via distinct status codes or
    // messages. Genuine users reach OTP dispatch for their correct purpose.
    if ((purpose === 'register' && existingUser) || ((purpose === 'login' || purpose === 'password_reset') && !existingUser)) {
      return res.json({ success: true, message: 'OTP sent successfully' });
    }

    if (existingUser) {
      try {
        await checkLock(existingUser);
      } catch (err) {
        // Locked account: return the exact same generic body as the mismatch
        // branch above so a number's lock state is not distinguishable.
        return res.json({ success: true, message: 'OTP sent successfully' });
      }
    }

    // Forward to independent OTP Server if configured
    if (OtpClient.isConfigured()) {
      console.log(`[BACKEND -> OTP SERVER] Forwarding send-otp request for ${normMobile} (${purpose})`);
      const otpResult = await OtpClient.sendOtp(normMobile, purpose);
      return res.json(otpResult);
    }

    // Delete existing unverified OTP for this purpose
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    await Otp.deleteMany({ mobile: normMobile, purpose });

    const otpCode = generateOTP();
    const { salt, hash } = hashOTP(otpCode);

    await Otp.create({
      mobile: normMobile,
      otp: hash,
      salt,
      purpose,
      expiresAt: new Date(Date.now() + 5 * 60000) // 5 minutes
    });

    const { smsSent, smsProvider, error: smsError, unconfigured } = await sendOtpSms(normMobile, otpCode);

    if (unconfigured) {
      return res.status(503).json({
        success: false,
        message: 'SMS service is currently unconfigured in production. Please set FAST2SMS_API_KEY or Twilio credentials in backend environment variables.'
      });
    }

    if (!smsSent) {
      return res.status(502).json({
        success: false,
        message: `Failed to deliver OTP SMS via ${smsProvider || 'configured provider'}. ${smsError ? (smsProvider === 'TWILIO' ? 'Twilio error: ' + smsError : smsError) : 'Please check SMS provider credentials/balance.'}`
      });
    }

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('❌ send-otp route error:', error);
    const statusCode = error.exposed && error.statusCode ? error.statusCode : 500;
    res.status(statusCode).json({ success: false, message: clientErrorMessage(error, 'An error occurred while processing OTP request.') });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP
// @access  Public
router.post('/verify-otp', authLimiter, async (req, res) => {
  try {
    const { mobile, otp, purpose } = req.body;
    const normMobile = normalizeMobile(mobile);

    if (!normMobile || !otp || !purpose) {
      return res.status(400).json({ success: false, message: 'Please provide mobile, OTP, and purpose' });
    }

    // Forward to independent OTP Server if configured.
    // Password-reset OTPs are created in THIS server's Otp collection and
    // delivered by its own SMS gateway (see /forgot-password), so they are
    // always verified locally — the remote otp-server has no such record.
    const REMOTE_OTP_PURPOSES = ['register', 'login'];
    if (OtpClient.isConfigured() && REMOTE_OTP_PURPOSES.includes(purpose)) {
      console.log(`[BACKEND -> OTP SERVER] Forwarding verify-otp request for ${normMobile} (${purpose})`);
      const otpResult = await OtpClient.verifyOtp(normMobile, otp, purpose);
      if (otpResult.verified || otpResult.success) {
        // The OTP was verified on the remote otp-server, which keeps its own
        // database. /register and /login confirm verification against THIS
        // server's otps collection, so persist a short-lived verified receipt
        // (expiring via the TTL index) to bridge the two servers.
        const receipt = await Otp.findOne({
          mobile: normMobile, purpose, verified: true
        });
        if (!receipt) {
          await Otp.create({
            mobile: normMobile,
            otp: 'remote-verified',
            purpose,
            verified: true,
            expiresAt: new Date(Date.now() + 5 * 60000)
          });
        }
        return res.json({ success: true, message: 'OTP verified successfully' });
      } else {
        return res.status(400).json({ success: false, message: otpResult.message || 'Invalid or expired OTP' });
      }
    }

    const otpRecord = await Otp.findOne({ mobile: normMobile, purpose, verified: false });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    otpRecord.attempts += 1;

    if (otpRecord.attempts > 3) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'Maximum attempts reached. Please request a new OTP.' });
    }

    if (!verifyOTP(String(otp).trim(), otpRecord.otp, otpRecord.salt)) {
      await otpRecord.save();
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });
    }

    // Mark verified
    otpRecord.verified = true;
    await otpRecord.save();

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    console.error('❌ verify-otp route error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, mobile, email, password, address, customerType } = req.body;
    const normMobile = normalizeMobile(mobile);

    if (!normMobile) {
      return res.status(400).json({ success: false, message: 'Invalid mobile number' });
    }

    // Legacy mobile/password registration is retained for existing API clients.
    // No OTP service is required or consulted: the supplied number is stored
    // with phoneVerified=false and is never presented as verified.

    // Double check duplicate
    const existingUser = await User.findOne({ mobile: normMobile });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Mobile number already registered' });
    }

    let distanceFromShop = 0;

    // Validate delivery radius
    if (address && address.lat != null && address.lng != null) {
      const serviceCheck = await checkServiceability(address.lat, address.lng);
      distanceFromShop = serviceCheck.distance;

      if (!serviceCheck.serviceable) {
        return res.status(400).json({
          success: false,
          message: serviceCheck.message,
          serviceability: {
            serviceable: false,
            distance: serviceCheck.distance,
            radius: serviceCheck.radius,
            shopLocation: serviceCheck.shopLocation
          }
        });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Please allow location access to verify delivery serviceability.' });
    }

    // Strict Role Enforcement
    const role = 'customer'; // Force role to customer for public registration
    const validCustomerType = ['public', 'hotel', 'pg_hostel'].includes(customerType) ? customerType : 'public';

    const userData = pickFields({ name, email, password, address }, ['name', 'email', 'password', 'address']);
    userData.mobile = normMobile;
    userData.customerType = validCustomerType;
    userData.distanceFromShop = distanceFromShop;
    userData.role = role;
    userData.profileCompleted = true;
    userData.phoneVerified = false;

    const user = await User.create(userData);

    await createAuditLog(user._id, 'user_register', 'user', user._id, { name, mobile: normMobile, customerType: validCustomerType }, req);

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        ...buildUserResponse(user),
        googleId: user.googleId || null
      }
    });
  } catch (error) {
    console.error('❌ register route error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: clientErrorMessage(error, 'Registration failed. Please try again later.') });
  }
});

// @route   POST /api/auth/login
// @desc    Login user (supports password or OTP)
// @access  Public
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { mobile, password, useOtp } = req.body;
    const normMobile = normalizeMobile(mobile);

    if (!normMobile) {
      return res.status(400).json({ success: false, message: 'Invalid mobile number' });
    }

    const user = await User.findOne({ mobile: normMobile }).select('+password +loginAttempts +lockUntil');

    // Uniform response for unknown, locked, or deactivated accounts prevents an
    // attacker from probing which numbers have accounts via the login endpoint.
    // Lock and deactivation still block the flow; the user simply isn't told why.
    if (!user || (user.lockUntil && user.lockUntil > Date.now()) || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Handle OTP Login flow
    if (useOtp) {
      const verifiedOtp = await Otp.findOne({ mobile: normMobile, purpose: 'login', verified: true });
      if (!verifiedOtp) {
        return res.status(401).json({ success: false, message: 'Mobile number not verified or OTP expired.' });
      }
      
      // Clean up OTP
      await Otp.deleteOne({ _id: verifiedOtp._id });
      
      // Reset login attempts
      if (user.loginAttempts > 0) {
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        await user.save();
      }
    } 
    // Handle Password Login flow
    else {
      if (!password) {
        return res.status(400).json({ success: false, message: 'Please provide password' });
      }

      if (!user.password) {
        return res.status(401).json({ success: false, message: 'Account setup incomplete. Please use OTP login.' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        user.loginAttempts += 1;
        
        // Lock account after 5 failed attempts for 15 minutes
        if (user.loginAttempts >= 5) {
          user.lockUntil = new Date(Date.now() + 15 * 60000);
        }
        await user.save();
        
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // Successful password login, reset attempts
      if (user.loginAttempts > 0) {
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        await user.save();
      }
    }

    await createAuditLog(user._id, 'user_login', 'user', user._id, { mobile: normMobile, method: useOtp ? 'otp' : 'password' }, req);

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        ...buildUserResponse(user),
        googleId: user.googleId || null
      }
    });
  } catch (error) {
    console.error('❌ login route error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user: buildUserResponse(user) });
  } catch (error) {
    console.error('❌ /auth/me route error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update profile (with delivery radius check on address change)
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const { name, email, address } = req.body;
    const updateData = pickFields({ name, email }, ['name', 'email']);

    if (address) {
      const sanitizedAddress = sanitizeAddressInput(address);
      if (!sanitizedAddress) {
        return res.status(400).json({ success: false, message: 'Invalid address.' });
      }

      if (sanitizedAddress.lat != null && sanitizedAddress.lng != null) {
        const serviceCheck = await checkServiceability(sanitizedAddress.lat, sanitizedAddress.lng);

        if (!serviceCheck.serviceable) {
          return res.status(400).json({
            success: false,
            message: serviceCheck.message,
            serviceability: { serviceable: false, distance: serviceCheck.distance, radius: serviceCheck.radius, shopLocation: serviceCheck.shopLocation }
          });
        }

        updateData.address = sanitizedAddress;
        updateData.distanceFromShop = serviceCheck.distance;
      } else {
        const existingUser = await User.findById(req.user._id);
        if (existingUser.address && existingUser.address.lat && existingUser.address.lng) {
          updateData.address = { ...sanitizedAddress, lat: existingUser.address.lat, lng: existingUser.address.lng };
        } else {
          return res.status(400).json({ success: false, message: 'Please detect your location to verify delivery serviceability.' });
        }
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });
    res.json({ success: true, message: 'Profile updated', user: buildUserResponse(user) });
  } catch (error) {
    console.error('❌ profile route error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: clientErrorMessage(error, 'Profile update failed. Please try again later.') });
  }
});

// @route   PUT /api/auth/password
// @desc    Change password
// @access  Private
router.put('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      return res.status(400).json({ success: false, message: 'Password too weak', errors: pwCheck.errors });
    }
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('❌ password route error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: clientErrorMessage(error, 'Password update failed. Please try again later.') });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send OTP for password reset
// @access  Public
router.post('/forgot-password', otpLimiter, async (req, res) => {
  try {
    const normMobile = normalizeMobile(req.body.mobile);
    if (!normMobile) {
      return res.status(400).json({ success: false, message: 'Invalid mobile number' });
    }

    const user = await User.findOne({ mobile: normMobile });
    if (!user) {
      // Don't reveal whether account exists
      return res.json({ success: true, message: 'If an account exists with this number, an OTP has been sent.' });
    }

    // Delete existing OTPs for password reset
    await Otp.deleteMany({ mobile: normMobile, purpose: 'password_reset' });

    const otpCode = generateOTP();
    const { salt, hash } = hashOTP(otpCode);
    await Otp.create({
      mobile: normMobile,
      otp: hash,
      salt,
      purpose: 'password_reset',
      expiresAt: new Date(Date.now() + 10 * 60000) // 10 minutes
    });

    const { smsSent, smsProvider, error: smsError, unconfigured } = await sendOtpSms(normMobile, otpCode);

    if (unconfigured) {
      return res.status(503).json({
        success: false,
        message: 'SMS service is currently unconfigured in production. Please set FAST2SMS_API_KEY or Twilio credentials in backend environment variables.'
      });
    }

    if (!smsSent) {
      return res.status(502).json({
        success: false,
        message: `Failed to deliver OTP SMS via ${smsProvider || 'configured provider'}. ${smsError ? (smsProvider === 'TWILIO' ? 'Twilio error: ' + smsError : smsError) : 'Please check SMS provider credentials/balance.'}`
      });
    }

    res.json({ success: true, message: 'If an account exists with this number, an OTP has been sent.' });
  } catch (error) {
    console.error('❌ forgot-password route error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error, 'Error processing password reset request. Please try again later.') });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with OTP verification
// @access  Public
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { mobile, otp, newPassword } = req.body;
    const normMobile = normalizeMobile(mobile);

    if (!normMobile || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Mobile, OTP, and new password are required' });
    }

    // Validate password strength
    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      return res.status(400).json({ success: false, message: 'Password too weak', errors: pwCheck.errors });
    }

    // Verify OTP. The record may have already been confirmed by a prior
    // /verify-otp call (purpose 'password_reset'), in which case re-checking
    // the code is skipped — lookups accept both verified and unverified records.
    const otpRecord = await Otp.findOne({ mobile: normMobile, purpose: 'password_reset' });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please request a new one.' });
    }

    if (!otpRecord.verified) {
      otpRecord.attempts += 1;
      if (otpRecord.attempts > 3) {
        await Otp.deleteOne({ _id: otpRecord._id });
        return res.status(400).json({ success: false, message: 'Maximum attempts reached. Please request a new OTP.' });
      }

      if (!verifyOTP(String(otp).trim(), otpRecord.otp, otpRecord.salt)) {
        await otpRecord.save();
        return res.status(400).json({ success: false, message: 'Incorrect OTP' });
      }

      otpRecord.verified = true;
      await otpRecord.save();
    }

    // OTP is correct — find user and reset password
    const user = await User.findOne({ mobile: normMobile }).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    user.password = newPassword;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    // Clean up OTP
    await Otp.deleteMany({ mobile: normMobile, purpose: 'password_reset' });

    await createAuditLog(user._id, 'password_reset', 'user', user._id, { mobile: normMobile }, req);

    res.json({ success: true, message: 'Password reset successfully. You can now login with your new password.' });
  } catch (error) {
    console.error('❌ reset-password route error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: clientErrorMessage(error, 'Password reset failed. Please try again later.') });
  }
});

// @route   POST /api/auth/validate-password
// @desc    Check password strength (no auth required — used in registration form)
// @access  Public
router.post('/validate-password', (req, res) => {
  const result = validatePasswordStrength(req.body.password);
  res.json({ success: true, data: result });
});

module.exports = router;
