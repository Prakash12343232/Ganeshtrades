const mongoose = require('mongoose');

/**
 * StaffProfile
 * One-to-one with User. Created by admin/manager after creating the User account.
 * Does NOT store credentials — those live on the User document.
 */
const staffProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Category of work
  category: {
    type: String,
    enum: ['shop', 'delivery', 'hybrid'],
    required: true,
    default: 'delivery'
  },

  // Internal employee or external partner link
  engagementType: {
    type: String,
    enum: ['internal', 'external'],
    required: true,
    default: 'internal'
  },

  // For external staff — link to a DeliveryPartner org
  partnerOrg: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DeliveryPartner',
    default: null
  },

  // Operational details
  employeeId: {
    type: String,
    trim: true,
    maxlength: 50
  },
  designation: {
    type: String,
    trim: true,
    maxlength: 100
  },
  joiningDate: {
    type: Date
  },

  // Active flag independent of User.isActive — lets admins suspend staff without deleting account
  isActive: {
    type: Boolean,
    default: true
  },

  // Who created/last-modified this profile
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  notes: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// `unique: true` on the `user` field above already creates this index.
// Declaring it again causes Mongoose to create duplicate-index warnings.
staffProfileSchema.index({ category: 1, isActive: 1 });
staffProfileSchema.index({ engagementType: 1, isActive: 1 });
staffProfileSchema.index({ partnerOrg: 1 });

module.exports = mongoose.model('StaffProfile', staffProfileSchema);
