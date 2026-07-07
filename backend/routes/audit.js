const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { protect, authorize } = require('../middleware/auth');

// GET /api/audit
router.get('/', protect, authorize('manager'), async (req, res) => {
  try {
    const { action, entity, page = 1, limit = 50 } = req.query;
    const query = {};
    if (action) query.action = action;
    if (entity) query.entity = entity;

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query).populate('user', 'name role').sort('-createdAt').skip((page - 1) * limit).limit(parseInt(limit));
    res.json({ success: true, data: logs, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
