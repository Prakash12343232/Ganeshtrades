const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  mobile: {
    type: String,
    required: true,
    match: [/^[6-9]\d{9}$/, 'Invalid mobile number']
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['register', 'login'],
    required: true
  },
  verified: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 } // TTL index — MongoDB auto-deletes expired docs
  }
}, {
  timestamps: true
});

// Compound index: one active OTP per mobile+purpose
otpSchema.index({ mobile: 1, purpose: 1 });

module.exports = mongoose.model('Otp', otpSchema);
