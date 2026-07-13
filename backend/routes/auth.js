const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { checkServiceability } = require('../utils/distance');
const { protect } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { pickFields } = require('../utils/security');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' }
});

// Generate JWT
const generateToken = (id) => {
  const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'testsecret' : undefined);
  if (!jwtSecret) throw new Error('Authentication is not configured');
  return jwt.sign({ id }, jwtSecret, { expiresIn: process.env.JWT_EXPIRE || '7d', algorithm: 'HS256' });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, mobile, email, password, address, customerType } = req.body;

    let distanceFromShop = 0;

    // Validate delivery radius for customers
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
      return res.status(400).json({
        success: false,
        message: 'Please allow location access to verify delivery serviceability.'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Mobile number already registered' });
    }

    const userData = pickFields({ name, mobile, email, password, customerType, address, distanceFromShop }, [
      'name', 'mobile', 'email', 'password', 'customerType', 'address', 'distanceFromShop'
    ]);
    const user = await User.create(userData);

    await createAuditLog(user._id, 'user_register', 'user', user._id, { name, mobile, customerType, distanceFromShop }, req);

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
// @desc    Login user
// @access  Public
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
      console.log('Login failed: Missing mobile or password');
      return res.status(400).json({ success: false, message: 'Please provide mobile and password' });
    }
    if (!/^[6-9]\d{9}$/.test(String(mobile))) {
      console.log('Login failed: Invalid mobile format:', mobile);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = await User.findOne({ mobile }).select('+password');
    if (!user) {
      console.log('Login failed: User not found for mobile:', mobile);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      console.log('Login failed: User account is inactive:', mobile);
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact admin.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('Login failed: Password mismatch for mobile:', mobile);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await createAuditLog(user._id, 'user_login', 'user', user._id, { mobile }, req);

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

    // If address with coordinates is provided, validate serviceability
    if (address) {
      if (address.lat != null && address.lng != null) {
        const serviceCheck = await checkServiceability(address.lat, address.lng);

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

        updateData.address = address;
        updateData.distanceFromShop = serviceCheck.distance;
      } else {
        // Allow address text update without coordinates only if existing coordinates exist
        const existingUser = await User.findById(req.user._id);
        if (existingUser.address && existingUser.address.lat && existingUser.address.lng) {
          updateData.address = {
            ...address,
            lat: existingUser.address.lat,
            lng: existingUser.address.lng
          };
        } else {
          return res.status(400).json({
            success: false,
            message: 'Please detect your location to verify delivery serviceability.'
          });
        }
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );
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
