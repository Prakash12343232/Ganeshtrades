const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');

// @route   GET /api/users
// @desc    Get all users (admin/manager)
// @access  Private/Admin
router.get('/', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { customerType, role, search, page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const query = {};

    if (customerType) query.customerType = customerType;
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private/Admin
router.get('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private/Admin
router.put('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { name, email, address, customerType, role, isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, address, customerType, role, isActive },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await createAuditLog(req.user._id, 'user_update', 'user', user._id, req.body, req);

    res.json({ success: true, message: 'User updated', data: user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (soft delete)
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await createAuditLog(req.user._id, 'user_delete', 'user', user._id, { deactivated: true }, req);

    res.json({ success: true, message: 'User deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/users/stats/summary
// @desc    Get user statistics
// @access  Private/Admin
router.get('/stats/summary', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const stats = await User.aggregate([
      { $match: { role: 'customer' } },
      {
        $group: {
          _id: '$customerType',
          count: { $sum: 1 },
          totalSpent: { $sum: '$totalSpent' },
          totalPending: { $sum: '$pendingAmount' }
        }
      }
    ]);

    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const activeCustomers = await User.countDocuments({ role: 'customer', isActive: true });

    res.json({
      success: true,
      data: { stats, totalCustomers, activeCustomers }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
