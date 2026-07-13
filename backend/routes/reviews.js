const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');

// POST /api/reviews
router.post('/', protect, async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    const product = await Product.findOne({ _id: productId, status: { $ne: 'inactive' } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    const review = await Review.create({ user: req.user._id, product: productId, rating, comment });
    res.status(201).json({ success: true, data: review });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// GET /api/reviews/product/:productId
router.get('/product/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId, isApproved: true }).populate('user', 'name').sort('-createdAt');
    res.json({ success: true, data: reviews });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /api/reviews - All reviews (admin)
router.get('/', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const reviews = await Review.find().populate('user', 'name').populate('product', 'name').sort('-createdAt');
    res.json({ success: true, data: reviews });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// DELETE /api/reviews/:id
router.delete('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
