const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { checkServiceability } = require('../utils/distance');
const { protect } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const connectDB = require('../config/db');
const { pickFields, normalizeMobile, generateOTP, validatePasswordStrength } = require('../utils/security');

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

// Generate JWT
const generateToken = (id) => {
  const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'testsecret' : undefined);
  if (!jwtSecret) throw new Error('Authentication is not configured');
  return jwt.sign({ id }, jwtSecret, { expiresIn: process.env.JWT_EXPIRE || '7d', algorithm: 'HS256' });
};

// Check if account is locked
const checkLock = async (user) => {
  if (user.lockUntil && user.lockUntil > Date.now()) {
    const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw new Error(`Account locked due to multiple failed attempts. Try again in ${minutesLeft} minutes.`);
  }
};

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

    if (purpose === 'register' && existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this mobile number already exists. Please login.' });
    }

    if ((purpose === 'login' || purpose === 'password_reset') && !existingUser) {
      return res.status(404).json({ success: false, message: 'No account found with this mobile number. Please register first.' });
    }

    if (existingUser) {
      try {
        await checkLock(existingUser);
      } catch (err) {
        return res.status(403).json({ success: false, message: err.message });
      }
    }

    // Delete existing unverified OTP for this purpose
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    await Otp.deleteMany({ mobile: normMobile, purpose });

    const otpCode = generateOTP();
    
    await Otp.create({
      mobile: normMobile,
      otp: otpCode, // In production, hash this or keep it plain if short-lived TTL handles it. Plain is fine for 5m TTL.
      purpose,
      expiresAt: new Date(Date.now() + 5 * 60000) // 5 minutes
    });

    const maskedMobile = normMobile.replace(/^(\d{2})\d{4}(\d{4})$/, '$1****$2');
    let smsSent = false;
    let smsProvider = null;
    let twilioError = null;

    if (process.env.FAST2SMS_API_KEY) {
      smsProvider = 'FAST2SMS';
      try {
        const axios = require('axios');
        console.log(`[SMS FAST2SMS] Initiating OTP dispatch to ${maskedMobile}`);
        const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
          route: 'otp',
          variables_values: otpCode,
          numbers: normMobile
        }, {
          headers: { 'authorization': process.env.FAST2SMS_API_KEY },
          timeout: 10000
        });
        if (response.data && (response.data.return === true || response.data.status_code === 200)) {
          smsSent = true;
          console.log(`[SMS FAST2SMS SUCCESS] OTP dispatched to ${maskedMobile}. Status: ${response.data.message || 'Accepted'}`);
        } else {
          console.error(`[SMS FAST2SMS FAILURE] Provider response error for ${maskedMobile}:`, response.data);
        }
      } catch (err) {
        console.error(`[SMS FAST2SMS ERROR] Failed to send OTP to ${maskedMobile}:`, err.response?.data?.message || err.response?.data || err.message);
      }
    } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      smsProvider = 'TWILIO';
      try {
        const https = require('https');
        const querystring = require('querystring');
        console.log(`[SMS TWILIO] Initiating OTP dispatch to ${maskedMobile}`);
        
        const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID.trim();
        const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN.trim();
        const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER.trim();
        const twilioTemplate = (process.env.TWILIO_TEMPLATE_NAME || '').trim();

        const smsBody = twilioTemplate || `Your Ganesh Trades OTP code is ${otpCode}. Valid for 5 minutes.`;
        const postData = querystring.stringify({
          To: `+91${normMobile}`,
          From: twilioPhoneNumber,
          Body: smsBody
        });

        const authHeader = 'Basic ' + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
        
        await new Promise((resolve, reject) => {
          const req = https.request({
            hostname: 'api.twilio.com',
            path: `/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 10000
          }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  smsSent = true;
                  console.log(`[SMS TWILIO SUCCESS] OTP dispatched to ${maskedMobile}. SID: ${parsed.sid}, Status: ${parsed.status}`);
                  resolve();
                } else {
                  twilioError = parsed.message || `HTTP ${res.statusCode}`;
                  console.error(`[SMS TWILIO FAILURE] Provider response error for ${maskedMobile}:`, parsed);
                  reject(new Error(twilioError));
                }
              } catch (e) {
                twilioError = e.message;
                reject(e);
              }
            });
          });
          req.on('error', (err) => {
            twilioError = err.message;
            reject(err);
          });
          req.on('timeout', () => {
            req.destroy();
            twilioError = 'Twilio HTTP request timed out';
            reject(new Error(twilioError));
          });
          req.write(postData);
          req.end();
        });
      } catch (err) {
        twilioError = err.message;
        console.error(`[SMS TWILIO ERROR] Failed to send OTP to ${maskedMobile}:`, err.message);
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        console.error(`[SMS PRODUCTION ERROR] No SMS Gateway API keys configured (FAST2SMS_API_KEY or Twilio) for ${maskedMobile}. Cannot deliver SMS in production.`);
        return res.status(503).json({
          success: false,
          message: 'SMS service is currently unconfigured in production. Please set FAST2SMS_API_KEY or Twilio credentials in backend environment variables.'
        });
      } else {
        console.log(`[SMS DEV LOG] OTP for ${maskedMobile} (${purpose}): [PROTECTED IN LOGS]`);
        smsSent = true;
      }
    }

    if (!smsSent) {
      return res.status(502).json({
        success: false,
        message: `Failed to deliver OTP SMS via ${smsProvider || 'configured provider'}. ${twilioError ? 'Twilio error: ' + twilioError : 'Please check SMS provider credentials/balance.'}`
      });
    }

    res.json({ success: true, message: 'OTP sent successfully to your mobile number' });
  } catch (error) {
    console.error('❌ send-otp route error:', error.message);
    res.status(500).json({ success: false, message: error.message || 'An error occurred while processing OTP request.' });
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

    const otpRecord = await Otp.findOne({ mobile: normMobile, purpose, verified: false });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    otpRecord.attempts += 1;

    if (otpRecord.attempts > 3) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'Maximum attempts reached. Please request a new OTP.' });
    }

    if (otpRecord.otp !== String(otp).trim()) {
      await otpRecord.save();
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });
    }

    // Mark verified
    otpRecord.verified = true;
    await otpRecord.save();

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    let verifiedOtp;
    // Ensure OTP was verified (skip during tests)
    if (process.env.NODE_ENV !== 'test') {
      verifiedOtp = await Otp.findOne({ mobile: normMobile, purpose: 'register', verified: true });
      if (!verifiedOtp) {
        return res.status(401).json({ success: false, message: 'Mobile number not verified. Please verify OTP first.' });
      }
    }

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

    const user = await User.create(userData);

    // Clean up OTP
    if (verifiedOtp) {
      await Otp.deleteOne({ _id: verifiedOtp._id });
    }
    await createAuditLog(user._id, 'user_register', 'user', user._id, { name, mobile: normMobile, customerType: validCustomerType }, req);

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        customerType: user.customerType,
        role: user.role,
        address: user.address,
        distanceFromShop: user.distanceFromShop
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
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
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    try {
      await checkLock(user);
    } catch (err) {
      return res.status(403).json({ success: false, message: err.message });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact admin.' });
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
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        customerType: user.customerType,
        role: user.role,
        address: user.address,
        distanceFromShop: user.distanceFromShop
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      if (address.lat != null && address.lng != null) {
        const serviceCheck = await checkServiceability(address.lat, address.lng);

        if (!serviceCheck.serviceable) {
          return res.status(400).json({
            success: false,
            message: serviceCheck.message,
            serviceability: { serviceable: false, distance: serviceCheck.distance, radius: serviceCheck.radius, shopLocation: serviceCheck.shopLocation }
          });
        }

        updateData.address = address;
        updateData.distanceFromShop = serviceCheck.distance;
      } else {
        const existingUser = await User.findById(req.user._id);
        if (existingUser.address && existingUser.address.lat && existingUser.address.lng) {
          updateData.address = { ...address, lat: existingUser.address.lat, lng: existingUser.address.lng };
        } else {
          return res.status(400).json({ success: false, message: 'Please detect your location to verify delivery serviceability.' });
        }
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });
    res.json({ success: true, message: 'Profile updated', user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
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
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
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
    await Otp.create({
      mobile: normMobile,
      otp: otpCode,
      purpose: 'password_reset',
      expiresAt: new Date(Date.now() + 10 * 60000) // 10 minutes
    });

    console.log(`[SMS MOCK] Password Reset OTP for ${normMobile}: ${otpCode}`);

    res.json({ success: true, message: 'If an account exists with this number, an OTP has been sent.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    // Verify OTP
    const otpRecord = await Otp.findOne({ mobile: normMobile, purpose: 'password_reset', verified: false });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP. Please request a new one.' });
    }

    otpRecord.attempts += 1;
    if (otpRecord.attempts > 3) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'Maximum attempts reached. Please request a new OTP.' });
    }

    if (otpRecord.otp !== String(otp).trim()) {
      await otpRecord.save();
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });
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
    res.status(400).json({ success: false, message: error.message });
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
