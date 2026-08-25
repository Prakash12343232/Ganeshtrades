const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Order = require('../models/Order');
const User = require('../models/User');
const Settlement = require('../models/Settlement');
const CreditTransaction = require('../models/CreditTransaction');
const { protect, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { parsePositiveNumber, parsePagination } = require('../utils/security');

// POST /api/payments - Record payment
router.post('/', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { userId, orderId, paymentMethod, notes } = req.body;
    const amount = parsePositiveNumber(req.body.amount, 'amount');
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.user.toString() !== userId) {
      return res.status(400).json({ success: false, message: 'Payment user does not match order owner' });
    }
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Order is already fully paid' });
    }

    const paidAgg = await Payment.aggregate([
      { $match: { order: order._id, paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const alreadyPaid = paidAgg[0]?.total || 0;
    const outstanding = Math.max(0, order.finalAmount - alreadyPaid);
    if (amount > outstanding) {
      return res.status(400).json({ success: false, message: `Payment exceeds outstanding amount of ₹${outstanding}` });
    }

    const payment = await Payment.create({
      user: userId, order: orderId, amount, paymentMethod,
      paymentStatus: 'completed', notes, receivedBy: req.user._id
    });

    order.paymentStatus = alreadyPaid + amount >= order.finalAmount ? 'paid' : 'partial';
    await order.save();

    const user = await User.findById(userId);
    if (user) {
      if (order.paymentMethod === 'credit') {
        user.creditBalance = Math.max(0, user.creditBalance - amount);
        await CreditTransaction.create({
          user: userId,
          amount,
          type: 'credit',
          referenceOrder: order._id,
          description: `Payment for order #${order.orderNumber}`,
          loggedBy: req.user._id
        });
      } else {
        user.pendingAmount = Math.max(0, user.pendingAmount - amount);
      }
      await user.save();
    }
    await createAuditLog(req.user._id, 'payment_create', 'payment', payment._id, { amount, orderId }, req);

    res.status(201).json({ success: true, message: 'Payment recorded', data: payment });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// GET /api/payments
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20, userId } = req.query;
    const paging = parsePagination(page, limit);
    const query = {};
    if (req.user.role === 'customer') query.user = req.user._id;
    else if (userId) query.user = userId;

    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query).populate('user', 'name mobile').populate('order', 'orderNumber totalAmount').sort('-createdAt').skip(paging.skip).limit(paging.limit);
    res.json({ success: true, data: payments, pagination: { total, page: paging.page, pages: Math.ceil(total / paging.limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /api/payments/pending
router.get('/pending', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const users = await User.find({ pendingAmount: { $gt: 0 } }).select('name mobile customerType pendingAmount').sort('-pendingAmount');
    res.json({ success: true, data: users });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// POST /api/payments/settlement - Khata Settlement
router.post('/settlement', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { userId, paymentMethod, referenceNumber, notes } = req.body;
    const amount = parsePositiveNumber(req.body.amount, 'amount');
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (amount > user.creditBalance && amount > user.pendingAmount) {
      return res.status(400).json({ success: false, message: 'Settlement exceeds customer balance' });
    }

    const settlement = await Settlement.create({
      user: userId, amount, paymentMethod, referenceNumber, notes, processedBy: req.user._id
    });

    user.creditBalance = Math.max(0, user.creditBalance - amount);
    user.pendingAmount = Math.max(0, user.pendingAmount - amount);
    await user.save();

    await CreditTransaction.create({
      user: userId,
      amount,
      type: 'credit', // Credit back to their account
      referenceSettlement: settlement._id,
      description: `Settlement via ${paymentMethod}`
    });

    await createAuditLog(req.user._id, 'settlement_create', 'settlement', settlement._id, { amount }, req);
    res.status(201).json({ success: true, message: 'Settlement recorded', data: settlement });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// ─── Online Payment Gateway (Simulated) ─────────────────────
// POST /api/payments/create-order - Customer initiates online payment
router.post('/create-order', protect, async (req, res) => {
  try {
    const { orderId, paymentMode } = req.body;
    const validModes = ['upi', 'debit_card', 'credit_card', 'net_banking'];
    if (!validModes.includes(paymentMode)) {
      return res.status(400).json({ success: false, message: `Invalid payment mode. Use: ${validModes.join(', ')}` });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Order is already paid' });
    }

    // Generate simulated gateway order ID
    const crypto = require('crypto');
    const gatewayOrderId = 'order_' + crypto.randomBytes(12).toString('hex');

    // Create pending payment record
    const payment = await Payment.create({
      user: req.user._id,
      order: orderId,
      amount: order.finalAmount,
      paymentMethod: paymentMode === 'upi' ? 'upi' : paymentMode === 'net_banking' ? 'bank_transfer' : 'card',
      paymentMode,
      paymentStatus: 'pending',
      gatewayOrderId
    });

    res.json({
      success: true,
      data: {
        gatewayOrderId,
        paymentId: payment._id,
        amount: order.finalAmount,
        currency: 'INR',
        orderNumber: order.orderNumber,
        prefill: {
          name: req.user.name,
          mobile: req.user.mobile,
          email: req.user.email || ''
        }
      }
    });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// POST /api/payments/verify - Verify online payment
router.post('/verify', protect, async (req, res) => {
  try {
    const { gatewayOrderId, gatewayPaymentId, gatewaySignature } = req.body;

    if (!gatewayOrderId || !gatewayPaymentId) {
      return res.status(400).json({ success: false, message: 'Missing payment verification data' });
    }

    const payment = await Payment.findOne({ gatewayOrderId, user: req.user._id });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.paymentStatus === 'completed') {
      return res.status(400).json({ success: false, message: 'Payment already verified' });
    }

    // Simulated verification — in production, verify signature with Razorpay SDK
    // const crypto = require('crypto');
    // const expectedSig = crypto.createHmac('sha256', process.env.RAZORPAY_SECRET).update(gatewayOrderId + '|' + gatewayPaymentId).digest('hex');
    // if (expectedSig !== gatewaySignature) return res.status(400).json(...);

    // Mark payment as completed
    payment.paymentStatus = 'completed';
    payment.gatewayPaymentId = gatewayPaymentId;
    payment.gatewaySignature = gatewaySignature || 'simulated';
    await payment.save();

    // Update order payment status
    const order = await Order.findById(payment.order);
    if (order) {
      const paidAgg = await Payment.aggregate([
        { $match: { order: order._id, paymentStatus: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      const totalPaid = paidAgg[0]?.total || 0;
      order.paymentStatus = totalPaid >= order.finalAmount ? 'paid' : 'partial';
      await order.save();

      // Update user pending amount
      const user = await User.findById(req.user._id);
      if (user) {
        user.pendingAmount = Math.max(0, user.pendingAmount - payment.amount);
        await user.save();
      }
    }

    const Notification = require('../models/Notification');
    await Notification.create({
      title: '💳 Payment Successful',
      message: `Your payment of ₹${payment.amount.toFixed(2)} for order #${order?.orderNumber || 'N/A'} has been confirmed.`,
      type: 'payment',
      recipient: req.user._id,
      link: `/orders/${payment.order}`,
      priority: 'high'
    });

    res.json({ success: true, message: 'Payment verified successfully', data: payment });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

module.exports = router;
