const mongoose = require('mongoose');

const TIME_SLOTS = [
  '8 AM - 10 AM',
  '10 AM - 12 PM',
  '12 PM - 2 PM',
  '2 PM - 4 PM',
  '4 PM - 6 PM',
  '6 PM - 8 PM',
  '8 PM - 10 PM'
];

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: String,
  price: Number,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  total: Number
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  deliveryCharge: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'card', 'credit', 'bank_transfer'],
    default: 'cash'
  },
  deliveryAddress: {
    street: String,
    area: String,
    city: String,
    pincode: String,
    lat: Number,
    lng: Number
  },
  distanceFromShop: {
    type: Number,
    default: 0
  },

  // ─── Scheduled Delivery Fields ───
  deliveryType: {
    type: String,
    enum: ['instant', 'scheduled'],
    default: 'instant'
  },
  scheduledDelivery: {
    date: { type: Date },
    timeSlot: { type: String, enum: [...TIME_SLOTS, ''] },
    scheduledAt: { type: Date },         // Timestamp when customer scheduled it
    rescheduledAt: { type: Date },       // Timestamp of last reschedule
    rescheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    originalDate: { type: Date },        // Keeps the first scheduled date for audit
    originalTimeSlot: { type: String }
  },

  deliveryDate: Date,
  deliveredAt: Date,
  notes: String,
  cancelReason: String,
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String
  }]
}, {
  timestamps: true
});

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

// Auto-generate order number securely using an atomic counter
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    try {
      const date = new Date();
      const prefix = `GT${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const counter = await Counter.findByIdAndUpdate(
        { _id: prefix },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      
      this.orderNumber = `${prefix}${String(counter.seq).padStart(5, '0')}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

// Virtual to check if a scheduled delivery is late
orderSchema.virtual('isDeliveryLate').get(function() {
  if (this.deliveryType !== 'scheduled' || !this.scheduledDelivery?.date) return false;
  if (['delivered', 'cancelled'].includes(this.orderStatus)) return false;
  return new Date() > new Date(this.scheduledDelivery.date);
});

orderSchema.set('toJSON', { virtuals: true });
orderSchema.set('toObject', { virtuals: true });

// Statics
orderSchema.statics.TIME_SLOTS = TIME_SLOTS;

module.exports = mongoose.model('Order', orderSchema);
