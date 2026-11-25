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
    default: ''
  },
  images: [{
    type: String
  }],
  imageMetadata: [{
    url: String,
    public_id: String,
    fileId: String,
    storageProvider: {
      type: String,
      enum: ['cloudinary', 'gridfs', 'local'],
      default: 'local'
    },
    width: Number,
    height: Number,
    mimeType: String,
    size: Number,
    isPrimary: { type: Boolean, default: false }
  }],
  isFeatured: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
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
  allowLooseSelling: {
    type: Boolean,
    default: false
  },
  pricePerKg: {
    type: Number,
    min: 0
  },
  minOrderQtyGrams: {
    type: Number,
    default: 100,
    min: 1
  },
  stockGrams: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSoldGrams: {
    type: Number,
    default: 0,
    min: 0
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
  expiryDate: { type: Date }
}, {
  timestamps: true
});

// Auto-update status based on stock. Loose products are governed by their
// gram inventory; fixed products keep the legacy unit-based behaviour.
productSchema.pre('save', function(next) {
  const outOfStock = this.allowLooseSelling
    ? !(this.stockGrams > 0)
    : this.stock === 0;

  if (outOfStock) {
    this.status = 'out_of_stock';
  } else if (this.status === 'out_of_stock') {
    this.status = 'active';
  }
  next();
});

// Text search index
productSchema.index({ name: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);
