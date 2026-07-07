const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 100
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number']
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  address: {
    street: String,
    area: String,
    city: { type: String, default: 'Local' },
    pincode: String
  },
  customerType: {
    type: String,
    enum: ['public', 'hotel', 'pg_hostel'],
    default: 'public'
  },
  role: {
    type: String,
    enum: ['customer', 'admin', 'manager', 'delivery'],
    default: 'customer'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  avatar: String,
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 0 },
  creditBalance: { type: Number, default: 0 },
  discountPercentage: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
