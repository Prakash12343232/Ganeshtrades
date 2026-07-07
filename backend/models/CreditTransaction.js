const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['charge', 'payment'], // charge = bought on credit, payment = paid khata
    required: true
  },
  referenceType: {
    type: String,
    enum: ['order', 'manual_settlement'],
    default: 'manual_settlement'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order' // Populated if referenceType is 'order'
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  notes: String,
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin or Manager who recorded the payment
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);
