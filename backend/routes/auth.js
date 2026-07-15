const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { checkServiceability } = require('../utils/distance');
const { protect } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { pickFields, normalizeMobile, generateOTP } = require('../utils/security');

// Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' }
});

const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 OTP requests per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many OTP requests. Please try again later.' }
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
      return res.status(400).json({ success: false, message: 'Invalid mobile number format' });
    }
    if (!['register', 'login'].includes(purpose)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP purpose' });
    }

    const existingUser = await User.findOne({ mobile: normMobile });

    if (purpose === 'register' && existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this mobile number already exists. Please login.' });
    }

    if (purpose === 'login' && !existingUser) {
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
    await Otp.deleteMany({ mobile: normMobile, purpose });

    const otpCode = generateOTP();
    
    await Otp.create({
      mobile: normMobile,
      otp: otpCode, // In production, hash this or keep it plain if short-lived TTL handles it. Plain is fine for 5m TTL.
      purpose,
      expiresAt: new Date(Date.now() + 5 * 60000) // 5 minutes
    });

    // TODO: Integrate actual SMS gateway here.
    // For now, we simulate sending:
    console.log(`[SMS MOCK] OTP for ${normMobile} (${purpose}): ${otpCode}`);

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    // Ensure OTP was verified
    const verifiedOtp = await Otp.findOne({ mobile: normMobile, purpose: 'register', verified: true });
    if (!verifiedOtp) {
      return res.status(401).json({ success: false, message: 'Mobile number not verified. Please verify OTP first.' });
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
    await Otp.deleteOne({ _id: verifiedOtp._id });
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

module.exports = router;
