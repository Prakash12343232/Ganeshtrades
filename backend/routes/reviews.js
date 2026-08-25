const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Order = require('../models/Order');
const { protect, authorize } = require('../middleware/auth');
const { parsePagination } = require('../utils/security');

// @route   GET /api/reviews
// @desc    Get reviews (filter by product, user, status, rating)
// @access  Public (approved only) / Admin (all statuses)
router.get('/', async (req, res) => {
  try {
    const { product, user, status, rating, page = 1, limit = 20 } = req.query;
    const query = {};

    if (product) query.product = product;
    if (user) query.user = user;
    if (rating) query.rating = parseInt(rating);

    // Public users only see approved reviews; admin sees all
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    } else if (!req.headers.authorization) {
      // No auth token — public access, show only approved
      query.$or = [
        { status: 'approved' },
        { isApproved: true, status: { $exists: false } } // backward compat
      ];
    }

    const paging = parsePagination(page, limit);
    const total = await Review.countDocuments(query);
    const reviews = await Review.find(query)
      .populate('user', 'name')
      .populate('product', 'name image')
      .sort('-createdAt')
      .skip(paging.skip)
      .limit(paging.limit);

    res.json({
      success: true,
      data: reviews,
      pagination: { total, page: paging.page, pages: Math.ceil(total / paging.limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/reviews/product/:productId
// @desc    Get approved reviews for a product with rating distribution
// @access  Public
router.get('/product/:productId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const paging = parsePagination(page, limit);

    const query = {
      product: req.params.productId,
      $or: [
        { status: 'approved' },
        { isApproved: true, status: { $exists: false } }
      ]
    };

    const total = await Review.countDocuments(query);
    const reviews = await Review.find(query)
      .populate('user', 'name')
      .sort('-createdAt')
      .skip(paging.skip)
      .limit(paging.limit);

    // Rating distribution
    const distribution = await Review.aggregate([
      { $match: query },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    const ratingDist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    distribution.forEach(d => { ratingDist[d._id] = d.count; });

    res.json({
      success: true,
      data: reviews,
      ratingDistribution: ratingDist,
      pagination: { total, page: paging.page, pages: Math.ceil(total / paging.limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/reviews
// @desc    Create a review (must have purchased the product)
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { product, rating, comment } = req.body;

    if (!product || !rating) {
      return res.status(400).json({ success: false, message: 'Product and rating are required' });
    }

    // Check if user has purchased this product
    const hasPurchased = await Order.findOne({
      user: req.user._id,
      'items.product': product,
      orderStatus: 'delivered'
    });

    if (!hasPurchased) {
      return res.status(400).json({
        success: false,
        message: 'You can only review products you have purchased and received'
      });
    }

    // Check if user already reviewed this product
    const existing = await Review.findOne({ user: req.user._id, product });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product. Use the update endpoint instead.'
      });
    }

    const review = await Review.create({
      user: req.user._id,
      product,
      rating: Math.min(5, Math.max(1, parseInt(rating))),
      comment: comment?.slice(0, 500),
      status: 'pending',
      isApproved: false
    });

    await review.populate('user', 'name');

    res.status(201).json({ success: true, message: 'Review submitted for approval', data: review });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this product' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/reviews/:id
// @desc    Update own review
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this review' });
    }

    if (req.body.rating) review.rating = Math.min(5, Math.max(1, parseInt(req.body.rating)));
    if (req.body.comment !== undefined) review.comment = req.body.comment.slice(0, 500);
    review.status = 'pending'; // Re-submit for moderation after edit
    review.isApproved = false;

    await review.save();
    await review.populate('user', 'name');

    res.json({ success: true, message: 'Review updated and re-submitted for approval', data: review });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/reviews/:id/moderate
// @desc    Admin approve/reject review + optional response
// @access  Private/Admin
router.put('/:id/moderate', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { status, adminResponse } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
    }

    const update = {
      status,
      isApproved: status === 'approved'
    };
    if (adminResponse !== undefined) update.adminResponse = adminResponse.slice(0, 500);

    const review = await Review.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('user', 'name')
      .populate('product', 'name');

    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    res.json({ success: true, message: `Review ${status}`, data: review });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/reviews/:id/helpful
// @desc    Mark review as helpful
// @access  Private
router.put('/:id/helpful', protect, async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpfulCount: 1 } },
      { new: true }
    );
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    res.json({ success: true, message: 'Marked as helpful', data: review });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/reviews/:id
// @desc    Delete review (admin or own)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    const isAdmin = ['admin', 'manager'].includes(req.user.role);
    const isOwner = review.user.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await Review.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
