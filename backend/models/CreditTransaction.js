const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  type: {
    type: String,
    enum: ['credit', 'debit'], // debit = customer owes more, credit = customer balance reduced
    required: true
  },
  referenceOrder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  referenceSettlement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Settlement'
  },
  description: {
    type: String
  },
  loggedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);
