const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { pickFields } = require('../utils/security');

const NOTIFICATION_FIELDS = ['title', 'message', 'type', 'recipient', 'recipientRole', 'link', 'metadata'];

function userCanAccessNotification(user, notification) {
  if (notification.recipient && notification.recipient.toString() === user._id.toString()) return true;
  if (notification.recipientRole === 'all') return true;
  if (notification.recipientRole === user.role) return true;
  return false;
}

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
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    if (!userCanAccessNotification(req.user, notification)) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this notification' });
    }
    notification.isRead = true;
    await notification.save();
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
    const notificationData = pickFields(req.body, NOTIFICATION_FIELDS);
    const notification = await Notification.create(notificationData);
    res.status(201).json({ success: true, data: notification });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

module.exports = router;
