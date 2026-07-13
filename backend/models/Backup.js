const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['manual', 'daily', 'weekly', 'monthly'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  size: {
    type: Number,
    default: 0
  },
  error: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Backup', backupSchema);
