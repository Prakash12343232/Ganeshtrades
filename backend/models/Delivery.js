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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Delivery', deliverySchema);
