const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { createAuditLog } = require('../utils/auditLogger');
const { validateImageFile } = require('../middleware/imageSecurity');
const { uploadProductImage, deleteProductImage } = require('../services/storageService');
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
  'stock', 'minStock', 'status', 'brand', 'sku', 'expiryDate', 'isFeatured'
];

// @route   GET /api/products
// @desc    Get all products (with filters + sorting)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, minRating, availability, sort = '-createdAt', page = 1, limit = 20 } = req.query;
    const query = {};

    if (category) query.category = category;
    query.status = { $ne: 'inactive' };

    // Availability filter
    if (availability === 'in_stock') {
      query.stock = { $gt: 0 };
    }

    // Rating filter
    if (minRating) {
      const rating = parseFloat(minRating);
      if (!isNaN(rating) && rating >= 1 && rating <= 5) {
        query.avgRating = { $gte: rating };
      }
    }

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

// @route   GET /api/products/featured
// @desc    Get featured products
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true, status: 'active' })
      .sort('-createdAt')
      .limit(12);
    res.json({ success: true, data: products });
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

// @route   POST /api/products/bulk-images
// @desc    Bulk upload & assign real photographs to multiple products
// @access  Private/Admin
router.post('/bulk-images', protect, authorize('admin', 'manager'), upload.array('images', 20), async (req, res) => {
  try {
    const files = req.files || [];
    let productIds = [];

    if (req.body.productIds) {
      try {
        productIds = typeof req.body.productIds === 'string' ? JSON.parse(req.body.productIds) : req.body.productIds;
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid productIds JSON format' });
      }
    }

    if (files.length === 0 || !Array.isArray(productIds) || productIds.length !== files.length) {
      return res.status(400).json({
        success: false,
        message: 'Number of uploaded images must match the number of target product IDs'
      });
    }

    const updatedProducts = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const productId = productIds[i];

      validateImageFile(file);
      const meta = await uploadProductImage(file.buffer, file.originalname);
      meta.isPrimary = true;

      const product = await Product.findById(productId);
      if (product) {
        product.image = meta.url;
        product.images = [meta.url, ...(product.images || []).filter(u => u !== meta.url)];
        product.imageMetadata = [meta, ...(product.imageMetadata || []).filter(m => m.url !== meta.url)];
        await product.save();
        updatedProducts.push(product);
      }
    }

    await createAuditLog(req.user._id, 'bulk_image_upload', 'product', null, { count: updatedProducts.length }, req);

    res.json({
      success: true,
      message: `Successfully uploaded photographs for ${updatedProducts.length} product(s)`,
      data: updatedProducts
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
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
router.post('/', protect, authorize('admin', 'manager'), upload.array('images', 10), async (req, res) => {
  try {
    const productData = pickFields(req.body, PRODUCT_FIELDS);
    if (productData.price !== undefined) productData.price = parseNonNegativeNumber(productData.price, 'price');
    if (productData.wholesalePrice !== undefined) productData.wholesalePrice = parseNonNegativeNumber(productData.wholesalePrice, 'wholesalePrice');
    if (productData.stock !== undefined) productData.stock = parseNonNegativeInt(productData.stock, 'stock');
    if (productData.minStock !== undefined) productData.minStock = parseNonNegativeInt(productData.minStock, 'minStock');

    const files = req.files || (req.file ? [req.file] : []);
    const uploadedMetas = [];

    if (files.length > 0) {
      for (const file of files) {
        validateImageFile(file);
        const meta = await uploadProductImage(file.buffer, file.originalname);
        uploadedMetas.push(meta);
      }
      uploadedMetas[0].isPrimary = true;
      productData.image = uploadedMetas[0].url;
      productData.images = uploadedMetas.map(m => m.url);
      productData.imageMetadata = uploadedMetas;
    }

    const product = await Product.create(productData);

    await createAuditLog(req.user._id, 'product_create', 'product', product._id, { name: product.name }, req);

    // Send new product notification to all customers
    await Notification.create({
      title: '🆕 New Product',
      message: `${product.name} is now available! Check it out.`,
      type: 'new_product',
      recipientRole: 'customer',
      link: `/products/${product._id}`,
      metadata: { productId: product._id }
    });

    res.status(201).json({ success: true, message: 'Product created', data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/products/:id
// @desc    Update product
// @access  Private/Admin
router.put('/:id', protect, authorize('admin', 'manager'), upload.array('images', 10), async (req, res) => {
  try {
    const updateData = pickFields(req.body, PRODUCT_FIELDS);
    if (updateData.price !== undefined) updateData.price = parseNonNegativeNumber(updateData.price, 'price');
    if (updateData.wholesalePrice !== undefined) updateData.wholesalePrice = parseNonNegativeNumber(updateData.wholesalePrice, 'wholesalePrice');
    if (updateData.stock !== undefined) updateData.stock = parseNonNegativeInt(updateData.stock, 'stock');
    if (updateData.minStock !== undefined) updateData.minStock = parseNonNegativeInt(updateData.minStock, 'minStock');

    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const files = req.files || (req.file ? [req.file] : []);

    if (files.length > 0) {
      const newMetas = [];
      for (const file of files) {
        validateImageFile(file);
        const meta = await uploadProductImage(file.buffer, file.originalname);
        newMetas.push(meta);
      }

      // If replacing all images or product currently has no images
      const replaceAll = req.body.replaceImages === 'true' || req.body.replaceImages === true;
      
      if (replaceAll || !existingProduct.images || existingProduct.images.length === 0) {
        newMetas[0].isPrimary = true;
        updateData.image = newMetas[0].url;
        updateData.images = newMetas.map(m => m.url);
        updateData.imageMetadata = newMetas;
      } else {
        // Append to existing
        const combinedMetas = [...(existingProduct.imageMetadata || []), ...newMetas];
        const combinedUrls = [...(existingProduct.images || []), ...newMetas.map(m => m.url)];
        updateData.imageMetadata = combinedMetas;
        updateData.images = combinedUrls;
        if (!existingProduct.image) {
          updateData.image = newMetas[0].url;
        }
      }
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    await createAuditLog(req.user._id, 'product_update', 'product', product._id, updateData, req);

    res.json({ success: true, message: 'Product updated', data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   POST /api/products/:id/images
// @desc    Upload & append product image(s)
// @access  Private/Admin
router.post('/:id/images', protect, authorize('admin', 'manager'), upload.array('images', 10), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one image file' });
    }

    const newMetas = [];
    for (const file of files) {
      validateImageFile(file);
      const meta = await uploadProductImage(file.buffer, file.originalname);
      newMetas.push(meta);
    }

    const existingMetas = product.imageMetadata || [];
    const existingImages = product.images || [];

    const isReplace = req.body.replace === 'true' || req.body.replace === true;

    let updatedMetas = [];
    let updatedImages = [];

    if (isReplace) {
      // Clean old images
      for (const oldMeta of existingMetas) {
        await deleteProductImage(oldMeta);
      }
      newMetas[0].isPrimary = true;
      updatedMetas = newMetas;
      updatedImages = newMetas.map(m => m.url);
      product.image = newMetas[0].url;
    } else {
      updatedMetas = [...existingMetas, ...newMetas];
      updatedImages = [...existingImages, ...newMetas.map(m => m.url)];
      if (!product.image || product.image.includes('default-product')) {
        product.image = newMetas[0].url;
        newMetas[0].isPrimary = true;
      }
    }

    product.imageMetadata = updatedMetas;
    product.images = updatedImages;

    await product.save();
    await createAuditLog(req.user._id, 'product_image_upload', 'product', product._id, { count: newMetas.length }, req);

    res.json({ success: true, message: 'Product images uploaded successfully', data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/products/:id/images/primary
// @desc    Set primary product image
// @access  Private/Admin
router.put('/:id/images/primary', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'imageUrl is required' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.image = imageUrl;
    if (product.imageMetadata && product.imageMetadata.length > 0) {
      product.imageMetadata.forEach(m => {
        m.isPrimary = (m.url === imageUrl);
      });
    }

    await product.save();
    res.json({ success: true, message: 'Primary image updated', data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/products/:id/images
// @desc    Delete single image from product
// @access  Private/Admin
router.delete('/:id/images', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'imageUrl is required' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Find metadata object to delete from storage provider
    const metaToDelete = (product.imageMetadata || []).find(m => m.url === imageUrl);
    if (metaToDelete) {
      await deleteProductImage(metaToDelete);
    }

    product.images = (product.images || []).filter(img => img !== imageUrl);
    product.imageMetadata = (product.imageMetadata || []).filter(m => m.url !== imageUrl);

    if (product.image === imageUrl) {
      product.image = product.images.length > 0 ? product.images[0] : '';
    }

    await product.save();
    await createAuditLog(req.user._id, 'product_image_delete', 'product', product._id, { imageUrl }, req);

    res.json({ success: true, message: 'Product image deleted', data: product });
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
