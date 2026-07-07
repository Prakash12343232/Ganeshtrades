const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 1000
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'rice_grains', 'dal_pulses', 'spices', 'oil_ghee', 'flour',
      'sugar_jaggery', 'tea_coffee', 'snacks', 'beverages', 'dairy',
      'fruits', 'vegetables', 'dry_fruits', 'cleaning', 'personal_care',
      'packaged_food', 'bakery', 'frozen', 'other'
    ]
  },
  image: {
    type: String,
    default: '/uploads/default-product.png'
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  purchasePrice: {
    type: Number,
    min: 0
  },
  wholesalePrice: {
    type: Number,
    min: 0
  },
  unit: {
    type: String,
    enum: ['kg', 'g', 'l', 'ml', 'piece', 'packet', 'dozen', 'box'],
    default: 'kg'
  },
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  minStock: {
    type: Number,
    default: 10
  },
  reorderQuantity: {
    type: Number,
    default: 50
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'out_of_stock'],
    default: 'active'
  },
  brand: String,
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  totalSold: { type: Number, default: 0 },
  avgRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  expiryDate: Date
}, {
  timestamps: true
});

// Auto-update status based on stock
productSchema.pre('save', function(next) {
  if (this.stock === 0) {
    this.status = 'out_of_stock';
  } else if (this.status === 'out_of_stock' && this.stock > 0) {
    this.status = 'active';
  }
  next();
});

// Text search index
productSchema.index({ name: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);
