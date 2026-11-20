const mongoose = require('mongoose');

const authSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  familyId: { type: String, required: true, index: true },
  userAgent: { type: String, maxlength: 500 },
  ipAddress: { type: String, maxlength: 100 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date, default: null },
  replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AuthSession', default: null }
}, { timestamps: true });

module.exports = mongoose.model('AuthSession', authSessionSchema);
