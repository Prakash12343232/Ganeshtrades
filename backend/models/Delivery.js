const mongoose = require('mongoose');

const deliverySchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true // One delivery record per order
  },
  deliveryPerson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['unassigned', 'assigned', 'out_for_delivery', 'delivered', 'failed'],
    default: 'unassigned'
  },
  notes: String,
  assignedAt: Date,
  outForDeliveryAt: Date,
  deliveredAt: Date,
  failedAt: Date,
  failureReason: String,
  proofOfDeliveryUrl: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Delivery', deliverySchema);
