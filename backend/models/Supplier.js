const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Supplier name is required'],
    trim: true
  },
  contactPerson: String,
  mobile: {
    type: String,
    required: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit mobile number']
  },
  email: String,
  gstNumber: String,
  address: {
    street: String,
    area: String,
    city: String,
    state: String,
    pincode: String
  },
  balance: {
    type: Number,
    default: 0 // Amount we owe the supplier
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Supplier', supplierSchema);
