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
      'settlement_create', 'delivery_assign', 'delivery_reassign', 'delivery_update',
      'supplier_create', 'supplier_payment', 'po_create', 'po_receive',
      'expense_create', 'expense_update', 'expense_delete',
      'password_reset',
      'product_image_upload', 'product_image_delete', 'bulk_image_upload',
      'bulk_import_products', 'bulk_import_customers', 'bulk_update_inventory',
      // Phase 1: staff & worker management
      'staff_create', 'staff_update', 'staff_deactivate',
      'partner_create', 'partner_update', 'partner_deactivate',
      'worker_pickup', 'worker_dispatch', 'worker_deliver', 'worker_fail',
      'worker_payment_collect'
    ]
  },
  entity: {
    type: String,
    enum: ['user', 'product', 'order', 'payment', 'review', 'notification', 'settings', 'settlement', 'delivery', 'supplier', 'purchase_order', 'supplier_payment', 'expense', 'staff_profile', 'delivery_partner']
  },
  entityId: mongoose.Schema.Types.ObjectId,
  details: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
