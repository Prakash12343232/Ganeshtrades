const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { pickFields } = require('../utils/security');
const { clientErrorMessage } = require('../utils/errors');

const NOTIFICATION_FIELDS = ['title', 'message', 'type', 'recipient', 'recipientRole', 'link', 'metadata', 'priority'];

function accessibleQuery(user) {
  return { $or: [{ recipient: user._id }, { recipientRole: user.role }, { recipientRole: 'all' }] };
}

function userCanAccessNotification(user, notification) {
  if (notification.recipient && notification.recipient.toString() === user._id.toString()) return true;
  if (notification.recipientRole === 'all') return true;
  if (notification.recipientRole === user.role) return true;
  return false;
}

// Whether this notification is read FOR the given user.
// Targeted notifications (recipient set) use the shared isRead flag because they
// belong to a single user; broadcasts use per-user readBy receipts so read state
// never leaks across users.
function isReadForUser(user, notification) {
  if (!notification) return false;
  if (notification.isRead === true) return true;
  if (Array.isArray(notification.readBy)) {
    return notification.readBy.some(id => id && String(id) === String(user._id));
  }
  return false;
}

// GET /api/notifications
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    const query = accessibleQuery(req.user);
    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query).sort('-createdAt').skip(skip).limit(limitNum);

    // Resolve per-user read state so the shared isRead field stays compatible for
    // the frontend while broadcasts keep independent receipts per user.
    const data = notifications.map(n => ({
      _id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      priority: n.priority,
      recipient: n.recipient,
      recipientRole: n.recipientRole,
      isRead: isReadForUser(req.user, n),
      link: n.link,
      metadata: n.metadata,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt
    }));

    const unreadCount = await Notification.countDocuments({
      $or: [
        { recipient: req.user._id, isRead: false },
        { recipientRole: req.user.role, readBy: { $ne: req.user._id } },
        { recipientRole: 'all', readBy: { $ne: req.user._id } }
      ]
    });
    res.json({ success: true, data, unreadCount, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
  } catch (error) {
    console.error('❌ notifications error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    if (!userCanAccessNotification(req.user, notification)) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this notification' });
    }
    if (notification.recipient && notification.recipient.toString() === req.user._id.toString()) {
      notification.isRead = true;
    } else {
      // Broadcast: mark read for THIS user only, never globally.
      if (!Array.isArray(notification.readBy)) notification.readBy = [];
      if (!notification.readBy.some(id => String(id) === String(req.user._id))) {
        notification.readBy.push(req.user._id);
      }
    }
    await notification.save();
    res.json({ success: true });
  } catch (error) {
    console.error('❌ notifications error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', protect, async (req, res) => {
  try {
    // Targeted notifications belong to this user alone — flip isRead directly.
    await Notification.updateMany({ recipient: req.user._id }, { $set: { isRead: true } });
    // Broadcasts are shared — add this user to readBy so others stay unaffected.
    await Notification.updateMany(
      { $or: [{ recipientRole: req.user.role }, { recipientRole: 'all' }] },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ success: true, message: 'All marked read' });
  } catch (error) {
    console.error('❌ notifications error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

// POST /api/notifications - Create (admin)
router.post('/', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const notificationData = pickFields(req.body, NOTIFICATION_FIELDS);
    const notification = await Notification.create(notificationData);
    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    console.error('❌ notifications error:', error);
    res.status(400).json({ success: false, message: clientErrorMessage(error) });
  }
});

// BUG-04 fix: DELETE /clear-read MUST be registered before DELETE /:id
// otherwise Express matches 'clear-read' as the :id param
// DELETE /api/notifications/clear-read - Clear read notifications for THIS user only.
// Broadcasts are shared documents and must never be deleted on behalf of one user.
router.delete('/clear-read', protect, async (req, res) => {
  try {
    const result = await Notification.deleteMany({ recipient: req.user._id, isRead: true });
    res.json({ success: true, message: `${result.deletedCount} read notification(s) cleared` });
  } catch (error) {
    console.error('❌ notifications error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

// DELETE /api/notifications/:id - Delete single notification
router.delete('/:id', protect, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    // Admins/managers may delete any notification (intentional op). Other users may
    // delete only notifications targeted at them individually — never shared broadcasts.
    const isStaff = ['admin', 'manager'].includes(req.user.role);
    const isOwnTargeted = notification.recipient && notification.recipient.toString() === req.user._id.toString();
    if (!isStaff && !isOwnTargeted) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('❌ notifications error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

module.exports = router;