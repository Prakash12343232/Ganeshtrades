const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  action: {
    type: String,
    required: true,
    enum: [
      'user_login', 'user_register', 'user_update', 'user_delete',
      'product_create', 'product_update', 'product_delete',
      'order_create', 'order_update', 'order_cancel',
      'payment_create', 'payment_update',
      'stock_update', 'price_update',
      'review_create', 'review_delete',
      'settings_update', 'data_export',
      'settlement_create', 'delivery_assign', 'delivery_update',
      'supplier_create', 'supplier_payment', 'po_create', 'po_receive'
    ]
  },
  entity: {
    type: String,
    enum: ['user', 'product', 'order', 'payment', 'review', 'notification', 'settings', 'settlement', 'delivery', 'supplier', 'purchase_order', 'supplier_payment']
  },
  entityId: mongoose.Schema.Types.ObjectId,
  details: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
