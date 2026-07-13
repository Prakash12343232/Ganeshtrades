const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { createAuditLog } = require('../utils/auditLogger');
const {
  escapeRegex,
  sanitizeSort,
  pickFields,
  parsePositiveInt,
  parseNonNegativeInt,
  parseNonNegativeNumber,
  parsePagination
} = require('../utils/security');

const PRODUCT_FIELDS = [
  'name', 'description', 'category', 'price', 'wholesalePrice', 'unit',
  'stock', 'minStock', 'status', 'brand', 'sku', 'expiryDate'
];

// @route   GET /api/products
// @desc    Get all products
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, sort = '-createdAt', page = 1, limit = 20 } = req.query;
    const query = {};

    if (category) query.category = category;
    query.status = { $ne: 'inactive' };

    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { brand: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseNonNegativeNumber(minPrice, 'minPrice');
      if (maxPrice) query.price.$lte = parseNonNegativeNumber(maxPrice, 'maxPrice');
    }

    const paging = parsePagination(page, limit);
    const safeSort = sanitizeSort(sort, '-createdAt', ['createdAt', 'name', 'price', 'stock', 'totalSold', 'avgRating']);
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(safeSort)
      .skip(paging.skip)
      .limit(paging.limit);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: paging.page,
        pages: Math.ceil(total / paging.limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/products/categories
// @desc    Get product categories with counts
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/products/low-stock
// @desc    Get low stock products
// @access  Private/Admin
router.get('/low-stock', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const products = await Product.find({
      $expr: { $lte: ['$stock', '$minStock'] },
      status: { $ne: 'inactive' }
    }).sort('stock');

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/products/:id
// @desc    Get single product
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, status: { $ne: 'inactive' } });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/products
// @desc    Create product
// @access  Private/Admin
router.post('/', protect, authorize('admin', 'manager'), upload.single('image'), async (req, res) => {
  try {
    const productData = pickFields(req.body, PRODUCT_FIELDS);
    if (productData.price !== undefined) productData.price = parseNonNegativeNumber(productData.price, 'price');
    if (productData.wholesalePrice !== undefined) productData.wholesalePrice = parseNonNegativeNumber(productData.wholesalePrice, 'wholesalePrice');
    if (productData.stock !== undefined) productData.stock = parseNonNegativeInt(productData.stock, 'stock');
    if (productData.minStock !== undefined) productData.minStock = parseNonNegativeInt(productData.minStock, 'minStock');
    if (req.file) {
      productData.image = `/uploads/${req.file.filename}`;
    }

    const product = await Product.create(productData);

    await createAuditLog(req.user._id, 'product_create', 'product', product._id, { name: product.name }, req);

    res.status(201).json({ success: true, message: 'Product created', data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private/Admin
router.put('/:id', protect, authorize('admin', 'manager'), upload.single('image'), async (req, res) => {
  try {
    const updateData = pickFields(req.body, PRODUCT_FIELDS);
    if (updateData.price !== undefined) updateData.price = parseNonNegativeNumber(updateData.price, 'price');
    if (updateData.wholesalePrice !== undefined) updateData.wholesalePrice = parseNonNegativeNumber(updateData.wholesalePrice, 'wholesalePrice');
    if (updateData.stock !== undefined) updateData.stock = parseNonNegativeInt(updateData.stock, 'stock');
    if (updateData.minStock !== undefined) updateData.minStock = parseNonNegativeInt(updateData.minStock, 'minStock');
    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await createAuditLog(req.user._id, 'product_update', 'product', product._id, updateData, req);

    res.json({ success: true, message: 'Product updated', data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/products/:id/stock
// @desc    Update stock
// @access  Private/Admin
router.put('/:id/stock', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { stock, action = 'set' } = req.body; // action: 'set', 'add', 'subtract'
    const amount = action === 'set'
      ? parseNonNegativeInt(stock, 'stock')
      : parsePositiveInt(stock, 'stock');
    if (!['set', 'add', 'subtract'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid stock action' });
    }
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (action === 'add') {
      product.stock += amount;
    } else if (action === 'subtract') {
      product.stock = Math.max(0, product.stock - amount);
    } else {
      product.stock = amount;
    }

    await product.save();

    await createAuditLog(req.user._id, 'stock_update', 'product', product._id,
      { stock: product.stock, action }, req);

    res.json({ success: true, message: 'Stock updated', data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/products/:id
// @desc    Delete product (soft delete)
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: 'inactive' },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await createAuditLog(req.user._id, 'product_delete', 'product', product._id, {}, req);

    res.json({ success: true, message: 'Product removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
