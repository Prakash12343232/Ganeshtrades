const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  mobile: {
    type: String,
    required: true,
    index: true,
    match: [/^[6-9]\d{9}$/, 'Invalid 10-digit Indian mobile number format']
  },
  otpHash: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    required: true,
    enum: ['login', 'register', 'password_reset']
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
    index: { expires: 0 } // MongoDB TTL index to auto-delete expired OTP records
  }
}, {
  timestamps: true
});

// Compound index for fast lookup of active OTPs per mobile and purpose
otpSchema.index({ mobile: 1, purpose: 1, verified: 1 });
otpSchema.index({ mobile: 1, createdAt: -1 });

module.exports = mongoose.model('Otp', otpSchema);
