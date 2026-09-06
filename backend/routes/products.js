const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getProducts,
  getFeaturedProducts,
  getCategories,
  getLowStockProducts,
  bulkImageUpload,
  getProductById,
  createProduct,
  updateProduct,
  uploadProductImages,
  setPrimaryImage,
  deleteProductImage,
  updateStock,
  deleteProduct
} = require('../controllers/productController');

// @route   GET /api/products
// @desc    Get all products (with filters + sorting)
// @access  Public
router.get('/', getProducts);

// @route   GET /api/products/featured
// @desc    Get featured products
// @access  Public
router.get('/featured', getFeaturedProducts);

// @route   GET /api/products/categories
// @desc    Get product categories with counts
// @access  Public
router.get('/categories', getCategories);

// @route   GET /api/products/low-stock
// @desc    Get low stock products
// @access  Private/Admin
router.get('/low-stock', protect, authorize('admin', 'manager'), getLowStockProducts);

// @route   POST /api/products/bulk-images
// @desc    Bulk upload & assign real photographs to multiple products
// @access  Private/Admin
router.post('/bulk-images', protect, authorize('admin', 'manager'), upload.array('images', 20), bulkImageUpload);

// @route   GET /api/products/:id
// @desc    Get single product
// @access  Public
router.get('/:id', getProductById);

// @route   POST /api/products
// @desc    Create product
// @access  Private/Admin
router.post('/', protect, authorize('admin', 'manager'), upload.array('images', 10), createProduct);

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private/Admin
router.put('/:id', protect, authorize('admin', 'manager'), upload.array('images', 10), updateProduct);

// @route   POST /api/products/:id/images
// @desc    Upload & append product image(s)
// @access  Private/Admin
router.post('/:id/images', protect, authorize('admin', 'manager'), upload.array('images', 10), uploadProductImages);

// @route   PUT /api/products/:id/images/primary
// @desc    Set primary product image
// @access  Private/Admin
router.put('/:id/images/primary', protect, authorize('admin', 'manager'), setPrimaryImage);

// @route   DELETE /api/products/:id/images
// @desc    Delete single image from product
// @access  Private/Admin
router.delete('/:id/images', protect, authorize('admin', 'manager'), deleteProductImage);

// @route   PUT /api/products/:id/stock
// @desc    Update stock
// @access  Private/Admin
router.put('/:id/stock', protect, authorize('admin', 'manager'), updateStock);

// @route   DELETE /api/products/:id
// @desc    Delete product (soft delete)
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin', 'manager'), deleteProduct);

module.exports = router;
