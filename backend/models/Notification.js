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

module.exports = mongoose.model('Notification', notificationSchema);
