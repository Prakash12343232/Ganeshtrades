const mongoose = require('mongoose');

/**
 * DeliveryPartner
 * Represents an external delivery company or freelance rider organisation.
 * Individual riders from the partner are Users with role=staff + StaffProfile.engagementType=external.
 */
const deliveryPartnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150
  },
  contactPerson: {
    type: String,
    trim: true,
    maxlength: 100
  },
  mobile: {
    type: String,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number']
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?.\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  address: {
    type: String,
    trim: true,
    maxlength: 300
  },

  // Active means this partner can accept new assignments
  isActive: {
    type: Boolean,
    default: true
  },

  notes: {
    type: String,
    maxlength: 500
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

deliveryPartnerSchema.index({ isActive: 1 });
deliveryPartnerSchema.index({ name: 1 });

module.exports = mongoose.model('DeliveryPartner', deliveryPartnerSchema);
