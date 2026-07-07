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
    required: [true, 'Mobile number is required']
  },
  email: String,
  address: {
    street: String,
    area: String,
    city: String,
    state: String,
    pincode: String
  },
  gstNumber: String,
  balance: {
    type: Number,
    default: 0 // Amount we owe to the supplier
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
