const mongoose = require('mongoose');

const purchaseOrderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: String,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  total: Number
});

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    unique: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  items: [purchaseOrderItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'received', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  expectedDelivery: Date,
  receivedAt: Date,
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

// Auto-generate PO number using an atomic counter (shares the Counter
// collection with Order.orderNumber). A naive countDocuments()+1 is racy: two
// concurrent POs can compute the same sequence and collide on the unique
// poNumber index. The counter is seeded from the highest existing number on
// first use so numbers stay contiguous with legacy records.
purchaseOrderSchema.pre('save', async function(next) {
  if (!this.poNumber) {
    try {
      const date = new Date();
      const prefix = `PO${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!(await Counter.findById(prefix))) {
        const highest = await mongoose.model('PurchaseOrder')
          .findOne({ poNumber: new RegExp(`^${prefix}`) })
          .sort({ poNumber: -1 })
          .select('poNumber');
        const lastSeq = highest ? Number(highest.poNumber.slice(prefix.length)) : 0;
        await Counter.findByIdAndUpdate(
          { _id: prefix },
          { $setOnInsert: { seq: lastSeq } },
          { new: true, upsert: true }
        ).catch(() => {});
      }

      const counter = await Counter.findByIdAndUpdate(
        { _id: prefix },
        { $inc: { seq: 1 } },
        { new: true }
      );

      this.poNumber = `${prefix}${String(counter.seq).padStart(5, '0')}`;
      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
