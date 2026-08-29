const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['order', 'payment', 'stock', 'general', 'system', 'promotion', 'delivery', 'new_product', 'payment_reminder'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  recipientRole: {
    type: String,
    enum: ['customer', 'admin', 'manager', 'all']
  },
  isRead: {
    type: Boolean,
    default: false
  },
  link: String,
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// PERF-02: Notification queries run every 30s from frontend — indexes are critical
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });  // user notification feed
notificationSchema.index({ recipientRole: 1, isRead: 1 });              // role-based broadcasts

module.exports = mongoose.model('Notification', notificationSchema);
