const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'card', 'credit', 'bank_transfer'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  transactionId: String,
  gatewayOrderId: String,
  gatewayPaymentId: String,
  gatewaySignature: String,
  paymentMode: {
    type: String,
    enum: ['upi', 'debit_card', 'credit_card', 'net_banking', 'cash', 'credit', 'wallet'],
    default: 'cash'
  },
  notes: String,
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
