const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 500
  },
  // Replaces isApproved boolean — backward compatible (old docs default to 'approved')
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // Legacy field kept for backward compat — not used in new code
  isApproved: {
    type: Boolean,
    default: true
  },
  adminResponse: {
    type: String,
    maxlength: 500
  },
  helpfulCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// One review per user per product
reviewSchema.index({ user: 1, product: 1 }, { unique: true });

// Recalculate product avg rating after save
async function recalcProductRating(productId) {
  const Product = mongoose.model('Product');
  const Review = mongoose.model('Review');
  const stats = await Review.aggregate([
    { $match: { product: productId, $or: [{ status: 'approved' }, { isApproved: true, status: { $exists: false } }] } },
    { $group: { _id: '$product', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
  ]);
  if (stats.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      avgRating: Math.round(stats[0].avgRating * 10) / 10,
      reviewCount: stats[0].count
    });
  } else {
    await Product.findByIdAndUpdate(productId, { avgRating: 0, reviewCount: 0 });
  }
}

reviewSchema.post('save', async function() {
  await recalcProductRating(this.product);
});

reviewSchema.post('findOneAndUpdate', async function(doc) {
  if (doc) await recalcProductRating(doc.product);
});

reviewSchema.post('findOneAndDelete', async function(doc) {
  if (doc) await recalcProductRating(doc.product);
});

module.exports = mongoose.model('Review', reviewSchema);
