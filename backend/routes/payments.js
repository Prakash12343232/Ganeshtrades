const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');

// POST /api/payments - Record payment
router.post('/', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { userId, orderId, amount, paymentMethod, notes } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const payment = await Payment.create({
      user: userId, order: orderId, amount, paymentMethod,
      paymentStatus: 'completed', notes, receivedBy: req.user._id
    });

    order.paymentStatus = 'paid';
    await order.save();
    await User.findByIdAndUpdate(userId, { $inc: { pendingAmount: -amount } });
    await createAuditLog(req.user._id, 'payment_create', 'payment', payment._id, { amount, orderId }, req);

    res.status(201).json({ success: true, message: 'Payment recorded', data: payment });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// GET /api/payments
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, userId } = req.query;
    const query = {};
    if (req.user.role === 'customer') query.user = req.user._id;
    else if (userId) query.user = userId;

    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query).populate('user', 'name mobile').populate('order', 'orderNumber totalAmount').sort('-createdAt').skip((page - 1) * limit).limit(parseInt(limit));
    res.json({ success: true, data: payments, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /api/payments/pending
router.get('/pending', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const users = await User.find({ pendingAmount: { $gt: 0 } }).select('name mobile customerType pendingAmount').sort('-pendingAmount');
    res.json({ success: true, data: users });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
