const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');

// GET /api/notifications
router.get('/', protect, async (req, res) => {
  try {
    const query = { $or: [{ recipient: req.user._id }, { recipientRole: req.user.role }, { recipientRole: 'all' }] };
    const notifications = await Notification.find(query).sort('-createdAt').limit(50);
    const unreadCount = await Notification.countDocuments({ ...query, isRead: false });
    res.json({ success: true, data: notifications, unreadCount });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', protect, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// PUT /api/notifications/read-all
router.put('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany({ $or: [{ recipient: req.user._id }, { recipientRole: req.user.role }] }, { isRead: true });
    res.json({ success: true, message: 'All marked read' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// POST /api/notifications - Create (admin)
router.post('/', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const notification = await Notification.create(req.body);
    res.status(201).json({ success: true, data: notification });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

module.exports = router;
