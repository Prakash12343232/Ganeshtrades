/**
 * /api/worker — Worker (staff) self-service portal
 *
 * Security model:
 * - Requires JWT auth + role=staff
 * - Workers can ONLY see and update deliveries assigned to them (assignedWorker === req.user._id)
 * - External partners cannot access other partners' data
 * - Status transitions are validated server-side
 * - Cash payment collection reuses the shared payment logic with idempotency protection
 */
const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const StaffProfile = require('../models/StaffProfile');
const Notification = require('../models/Notification');
const CreditTransaction = require('../models/CreditTransaction');
const { protect, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { parsePositiveNumber, parsePagination } = require('../utils/security');
const { clientErrorMessage } = require('../utils/errors');

// All worker routes require authentication AND role=staff
router.use(protect, authorize('staff'));

// Allowed forward transitions for workers (cannot skip backward or jump)
const ALLOWED_TRANSITIONS = {
  assigned:   ['picked_up'],
  picked_up:  ['on_the_way'],
  on_the_way: ['delivered', 'failed'],
  delivered:  [],  // terminal
  failed:     []   // terminal (admin reassigns)
};

/**
 * Verify the requesting worker owns this delivery and has an active StaffProfile.
 */
async function assertOwnership(delivery, userId) {
  if (!delivery.assignedWorker || delivery.assignedWorker.toString() !== userId.toString()) {
    const err = new Error('You are not assigned to this delivery');
    err.status = 403;
    throw err;
  }
  const profile = await StaffProfile.findOne({ user: userId, isActive: true });
  if (!profile) {
    const err = new Error('Your staff profile is inactive. Contact your manager.');
    err.status = 403;
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/worker/me — Current worker profile
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const profile = await StaffProfile.findOne({ user: req.user._id })
      .populate('partnerOrg', 'name mobile')
      .populate('createdBy', 'name');

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Staff profile not found. Contact your manager.' });
    }

    res.json({
      success: true,
      data: {
        user: {
          _id: req.user._id,
          name: req.user.name,
          mobile: req.user.mobile,
          email: req.user.email,
          avatar: req.user.avatar
        },
        profile
      }
    });
  } catch (error) {
    console.error('❌ worker/me error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/worker/deliveries — My assigned deliveries
// ─────────────────────────────────────────────────────────────────────────────
router.get('/deliveries', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const paging = parsePagination(page, limit, 50);

    // SECURITY: always filter by assignedWorker === current user
    const query = { assignedWorker: req.user._id };
    if (status) query.status = status;

    const total = await Delivery.countDocuments(query);
    const deliveries = await Delivery.find(query)
      .populate({
        path: 'order',
        select: 'orderNumber finalAmount deliveryAddress paymentMethod paymentStatus deliveryType scheduledDelivery distanceFromShop',
        populate: { path: 'user', select: 'name mobile' }
      })
      .sort('-createdAt')
      .skip(paging.skip)
      .limit(paging.limit);

    res.json({
      success: true,
      data: deliveries,
      pagination: { total, page: paging.page, pages: Math.ceil(total / paging.limit) }
    });
  } catch (error) {
    console.error('❌ worker/deliveries error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/worker/deliveries/:id — Single delivery (ownership-checked)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/deliveries/:id', async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate({
        path: 'order',
        select: 'orderNumber finalAmount paymentMethod paymentStatus deliveryAddress deliveryType scheduledDelivery notes',
        populate: { path: 'user', select: 'name mobile address' }
      });

    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });
    await assertOwnership(delivery, req.user._id);

    res.json({ success: true, data: delivery });
  } catch (error) {
    console.error('❌ worker/deliveries/:id error:', error);
    res.status(error.status || 500).json({ success: false, message: clientErrorMessage(error) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/worker/deliveries/:id/status — Update my delivery status
// ─────────────────────────────────────────────────────────────────────────────
router.put('/deliveries/:id/status', async (req, res) => {
  try {
    const { status, note, location, failureReason, proofUrl } = req.body;

    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });

    // Ownership check
    await assertOwnership(delivery, req.user._id);

    // Validate transition
    const allowed = ALLOWED_TRANSITIONS[delivery.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${delivery.status}' to '${status}'. Allowed: ${allowed.join(', ') || 'none'}`
      });
    }

    // Failure reason is required when marking failed
    if (status === 'failed') {
      if (!failureReason || String(failureReason).trim().length < 5) {
        return res.status(400).json({ success: false, message: 'A failure reason (min 5 characters) is required when marking delivery as failed' });
      }
      delivery.failureReason = String(failureReason).trim().slice(0, 500);
    }

    // Proof of delivery for completed deliveries
    if (status === 'delivered' && proofUrl) {
      delivery.proofUrl = String(proofUrl).trim().slice(0, 1000);
    }

    // Update delivery
    delivery.status = status;
    if (location !== undefined) delivery.location = String(location).slice(0, 200);
    delivery.history.push({ status, note: note ? String(note).slice(0, 300) : undefined });
    await delivery.save();

    // Sync order status
    const order = await Order.findById(delivery.order);
    if (order) {
      if (status === 'delivered') {
        if (order.orderStatus !== 'delivered') {
          order.orderStatus = 'delivered';
          order.deliveredAt = new Date();
          order.statusHistory.push({ status: 'delivered', note: `Delivered by ${delivery.deliveryPersonName}` });
          await order.save();
          await Notification.create({
            title: '✅ Order Delivered',
            message: `Your order #${order.orderNumber} has been delivered successfully!`,
            type: 'order', recipient: order.user
          });
        }
      } else if (status === 'on_the_way') {
        if (order.orderStatus !== 'out_for_delivery') {
          order.orderStatus = 'out_for_delivery';
          order.estimatedDeliveryTime = new Date(Date.now() + 30 * 60 * 1000);
          order.statusHistory.push({ status: 'out_for_delivery', note: 'Delivery person on the way' });
          await order.save();
        }
      } else if (status === 'failed') {
        await Notification.create({
          title: '⚠️ Delivery Attempt Failed',
          message: `Delivery attempt for order #${order.orderNumber} was unsuccessful. We will contact you to reschedule.`,
          type: 'order', recipient: order.user
        });
      }
    }

    // Map worker action to audit log action
    const auditActionMap = {
      picked_up:  'worker_pickup',
      on_the_way: 'worker_dispatch',
      delivered:  'worker_deliver',
      failed:     'worker_fail'
    };
    const auditAction = auditActionMap[status] || 'delivery_update';
    await createAuditLog(req.user._id, auditAction, 'delivery', delivery._id, { status, failureReason }, req);

    res.json({ success: true, data: delivery });
  } catch (error) {
    console.error('❌ worker status update error:', error);
    res.status(error.status || 400).json({ success: false, message: clientErrorMessage(error) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/worker/deliveries/:id/payment — Collect cash payment at delivery
//
// Security:
// - Worker must own the delivery
// - Amount must not exceed outstanding balance
// - Idempotency key prevents duplicate submissions
// - Does NOT mark Khata settled — that remains an admin action
// ─────────────────────────────────────────────────────────────────────────────
router.post('/deliveries/:id/payment', async (req, res) => {
  try {
    const { amount: rawAmount, paymentMethod, idempotencyKey, notes } = req.body;

    const delivery = await Delivery.findById(req.params.id).populate('order');
    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });

    // Ownership check
    await assertOwnership(delivery, req.user._id);

    // Payment can only be collected on active or delivered deliveries
    if (delivery.status === 'failed') {
      return res.status(400).json({ success: false, message: 'Cannot collect payment for a failed delivery' });
    }

    const order = delivery.order;
    if (!order) return res.status(404).json({ success: false, message: 'Associated order not found' });
    if (order.orderStatus === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot collect payment for a cancelled order' });
    }
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'Order is already fully paid' });
    }

    // Idempotency — prevent double-submission
    if (idempotencyKey) {
      const duplicate = await Payment.findOne({ order: order._id, notes: `idem:${idempotencyKey}` });
      if (duplicate) {
        return res.status(200).json({ success: true, data: duplicate, idempotent: true });
      }
    }

    const amount = parsePositiveNumber(rawAmount, 'amount');

    // Only cash or UPI allowed at door — credit settlements are admin-only
    const allowedMethods = ['cash', 'upi'];
    if (!allowedMethods.includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: `Payment method must be one of: ${allowedMethods.join(', ')}` });
    }

    // Calculate outstanding
    const paidAgg = await Payment.aggregate([
      { $match: { order: order._id, paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const alreadyPaid = paidAgg[0]?.total || 0;
    const outstanding = Math.max(0, order.finalAmount - alreadyPaid);

    if (amount > outstanding) {
      return res.status(400).json({ success: false, message: `Payment ₹${amount} exceeds outstanding amount of ₹${outstanding}` });
    }

    const paymentNotes = idempotencyKey ? `idem:${idempotencyKey}` : notes;

    const payment = await Payment.create({
      user: order.user,
      order: order._id,
      amount,
      paymentMethod,
      paymentStatus: 'completed',
      notes: paymentNotes,
      receivedBy: req.user._id
    });

    // Update order payment status
    order.paymentStatus = (alreadyPaid + amount >= order.finalAmount) ? 'paid' : 'partial';
    await order.save();

    // Update idempotencyKey on delivery for traceability
    if (idempotencyKey) {
      delivery.paymentIdempotencyKey = idempotencyKey;
      await delivery.save();
    }

    // Update customer pendingAmount (NOT creditBalance — Khata is admin-only)
    const customer = await User.findById(order.user);
    if (customer && order.paymentMethod !== 'credit') {
      customer.pendingAmount = Math.max(0, customer.pendingAmount - amount);
      await customer.save();
    }

    await createAuditLog(req.user._id, 'worker_payment_collect', 'payment', payment._id, {
      orderId: order._id,
      amount,
      paymentMethod,
      deliveryId: delivery._id
    }, req);

    await Notification.create({
      title: '💰 Payment Received',
      message: `Payment of ₹${amount} received for order #${order.orderNumber}.`,
      type: 'payment',
      recipient: order.user
    });

    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    console.error('❌ worker payment error:', error);
    res.status(error.status || 400).json({ success: false, message: clientErrorMessage(error) });
  }
});

module.exports = router;
