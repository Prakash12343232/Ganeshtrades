const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true
  },
  deliveryPersonName: {
    type: String,
    required: true
  },
  deliveryPersonMobile: {
    type: String,
    required: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number']
  },
  status: {
    type: String,
    enum: ['assigned', 'picked_up', 'on_the_way', 'delivered', 'failed'],
    default: 'assigned'
  },
  location: {
    type: String
  },
  notes: String,
  history: [{
    status: {
      type: String,
      enum: ['assigned', 'picked_up', 'on_the_way', 'delivered', 'failed']
    },
    timestamp: { type: Date, default: Date.now },
    note: String
  }],
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // ── Phase 1 additions (all optional — existing documents unaffected) ──

  // Link to the actual staff User who carries out the delivery
  // (separate from the free-text deliveryPersonName kept for legacy compatibility)
  assignedWorker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Required when status transitions to 'failed'
  failureReason: {
    type: String,
    trim: true,
    maxlength: 500,
    default: null
  },

  // Proof of delivery — photo URL or signature data URL
  proofUrl: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: null
  },

  // Idempotency key for cash payment collection at delivery
  paymentIdempotencyKey: {
    type: String,
    sparse: true,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Delivery', deliverySchema);
