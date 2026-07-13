const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { checkServiceability } = require('../utils/distance');
const { escapeRegex, sanitizeSort, pickFields } = require('../utils/security');

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
      const safeSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { mobile: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const safeSort = sanitizeSort(sort, '-createdAt', ['createdAt', 'name', 'mobile', 'totalSpent', 'pendingAmount', 'creditBalance']);
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort(safeSort)
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
// @desc    Update user (recalculate distance if address coordinates changed)
// @access  Private/Admin
router.put('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { name, email, address, customerType, role, isActive, creditLimit } = req.body;
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (targetUser.role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can modify administrator accounts' });
    }

    const updateData = { name, email, address, customerType };

    // Only admin can change roles — managers cannot escalate privileges
    if (role !== undefined) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only administrators can change user roles' });
      }
      if (!['customer', 'admin', 'manager'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }
      // Prevent self-demotion of the last admin
      if (targetUser._id.toString() === req.user._id.toString() && role !== 'admin') {
        return res.status(400).json({ success: false, message: 'Cannot change your own admin role' });
      }
      updateData.role = role;
    }

    // Only admin can modify credit limits
    if (creditLimit !== undefined) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only administrators can modify credit limits' });
      }
      const limit = parseFloat(creditLimit);
      if (!Number.isFinite(limit) || limit < 0) {
        return res.status(400).json({ success: false, message: 'Invalid credit limit' });
      }
      updateData.creditLimit = limit;
    }

    if (isActive !== undefined) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only administrators can activate or deactivate users' });
      }
      if (targetUser._id.toString() === req.user._id.toString() && isActive === false) {
        return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
      }
      updateData.isActive = Boolean(isActive);
    }

    // Recalculate distance if address with coordinates is provided
    if (address && address.lat != null && address.lng != null) {
      const serviceCheck = await checkServiceability(address.lat, address.lng);
      updateData.distanceFromShop = serviceCheck.distance;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
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
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
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

module.exports = router;
