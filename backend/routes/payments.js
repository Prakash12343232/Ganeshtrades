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
const { clientErrorMessage } = require('../utils/errors');
const { withTransaction } = require('../utils/transaction');
const {
  EPSILON,
  round2,
  getOrderPaidTotal,
  getOrderSettledTotal,
  allocateToOrders,
  recomputeOrderPaymentStatus
} = require('../services/ledgerService');

const sessionOptions = (session) => (session ? { session } : {});

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.exposed = true;
  return err;
}

// POST /api/payments - Record payment
router.post('/', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { userId, orderId, paymentMethod, notes } = req.body;
    const amount = parsePositiveNumber(req.body.amount, 'amount');

    const payment = await withTransaction(async (session) => {
      const orderQuery = Order.findById(orderId);
      if (session) orderQuery.session(session);
      const order = await orderQuery;
      if (!order) throw httpError(404, 'Order not found');
      if (order.orderStatus === 'cancelled') {
        throw httpError(400, 'Order is cancelled and cannot receive payment');
      }
      if (order.user.toString() !== String(userId)) {
        throw httpError(400, 'Payment user does not match order owner');
      }

      const alreadyPaid = await getOrderPaidTotal(order._id, session);
      const alreadySettled = await getOrderSettledTotal(order._id, session);
      const outstanding = round2(Math.max(0, round2(order.finalAmount) - alreadyPaid - alreadySettled));
      if (outstanding <= EPSILON) throw httpError(400, 'Order is already fully paid');
      if (amount > outstanding + EPSILON) {
        throw httpError(400, `Payment exceeds outstanding amount of ₹${outstanding}`);
      }

      const userQuery = User.findById(userId);
      if (session) userQuery.session(session);
      const user = await userQuery;
      if (!user) throw httpError(404, 'User not found');

      const ledgerField = order.paymentMethod === 'credit' ? 'creditBalance' : 'pendingAmount';
      const currentBalance = round2(user[ledgerField]);
      if (amount > currentBalance + EPSILON) {
        throw httpError(
          409,
          `Ledger inconsistency: ${ledgerField} is ₹${currentBalance}, but the payment is ₹${amount}. Reconcile the account before recording this payment.`
        );
      }

      const [created] = await Payment.create([{
        user: userId,
        order: orderId,
        amount,
        paymentMethod,
        paymentStatus: 'completed',
        notes,
        receivedBy: req.user._id
      }], sessionOptions(session));

      const totalPaid = round2(alreadyPaid + alreadySettled + amount);
      order.paymentStatus = totalPaid >= round2(order.finalAmount) - EPSILON ? 'paid' : 'partial';
      await order.save(session ? { session } : undefined);

      user[ledgerField] = round2(currentBalance - amount);
      await user.save(session ? { session } : undefined);

      if (order.paymentMethod === 'credit') {
        await CreditTransaction.create([{
          user: userId,
          amount,
          type: 'credit',
          referenceOrder: order._id,
          description: `Payment for order #${order.orderNumber}`,
          loggedBy: req.user._id
        }], sessionOptions(session));
      }

      return created;
    });

    await createAuditLog(req.user._id, 'payment_create', 'payment', payment._id, { amount, orderId }, req);
    res.status(201).json({ success: true, message: 'Payment recorded', data: payment });
  } catch (error) {
    console.error('❌ payments error:', error);
    res.status(error.status || 400).json({ success: false, message: clientErrorMessage(error) });
  }
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
  } catch (error) {
    console.error('❌ payments error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

// GET /api/payments/pending
router.get('/pending', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const users = await User.find({ pendingAmount: { $gt: 0 } }).select('name mobile customerType pendingAmount').sort('-pendingAmount');
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('❌ payments error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

// POST /api/payments/settlement - Khata Settlement
router.post('/settlement', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { userId, paymentMethod, referenceNumber, notes } = req.body;
    const amount = parsePositiveNumber(req.body.amount, 'amount');

    const settlement = await withTransaction(async (session) => {
      const userQuery = User.findById(userId);
      if (session) userQuery.session(session);
      const user = await userQuery;
      if (!user) throw httpError(404, 'User not found');

      const creditBefore = round2(user.creditBalance);
      const pendingBefore = round2(user.pendingAmount);
      const totalOutstanding = round2(creditBefore + pendingBefore);
      if (totalOutstanding <= EPSILON) {
        throw httpError(400, 'Customer has no outstanding balance');
      }
      if (amount > totalOutstanding + EPSILON) {
        throw httpError(400, `Settlement of ₹${amount} exceeds outstanding balance of ₹${totalOutstanding}`);
      }

      // Attribute the settlement to the customer's open invoices, oldest first,
      // so aging and cancellation reversal can see which order was paid.
      const { allocations, unallocated } = await allocateToOrders(userId, amount, session);

      let creditPortion = 0;
      let pendingPortion = 0;
      for (const allocation of allocations) {
        if (allocation.paymentMethod === 'credit') {
          creditPortion = round2(creditPortion + allocation.amount);
        } else {
          pendingPortion = round2(pendingPortion + allocation.amount);
        }
      }

      if (creditPortion > creditBefore + EPSILON || pendingPortion > pendingBefore + EPSILON) {
        throw httpError(
          409,
          'Ledger inconsistency: order attribution exceeds the customer ledger. Reconcile the account before recording this settlement.'
        );
      }

      // Any amount not attributable to an open order still reduces the ledger
      // credit-first, matching the historical settlement behaviour.
      let remainder = round2(unallocated);
      const extraCredit = round2(Math.min(remainder, round2(creditBefore - creditPortion)));
      creditPortion = round2(creditPortion + extraCredit);
      remainder = round2(remainder - extraCredit);
      pendingPortion = round2(pendingPortion + remainder);

      if (creditPortion > creditBefore + EPSILON || pendingPortion > pendingBefore + EPSILON) {
        throw httpError(
          409,
          'Ledger inconsistency: settlement exceeds the customer ledger. Reconcile the account before recording this settlement.'
        );
      }

      const [created] = await Settlement.create([{
        user: userId,
        amount,
        paymentMethod,
        referenceNumber,
        notes,
        allocations: allocations.map(({ order, amount: allocated }) => ({ order, amount: allocated })),
        processedBy: req.user._id
      }], sessionOptions(session));

      user.creditBalance = round2(creditBefore - creditPortion);
      user.pendingAmount = round2(pendingBefore - pendingPortion);
      await user.save(session ? { session } : undefined);

      for (const allocation of allocations) {
        const orderQuery = Order.findById(allocation.order);
        if (session) orderQuery.session(session);
        const order = await orderQuery;
        if (order) await recomputeOrderPaymentStatus(order, session);
      }

      await CreditTransaction.create([{
        user: userId,
        amount,
        type: 'credit', // Credit back to their account
        referenceSettlement: created._id,
        description: `Settlement via ${paymentMethod}`
      }], sessionOptions(session));

      return created;
    });

    await createAuditLog(req.user._id, 'settlement_create', 'settlement', settlement._id, { amount }, req);
    res.status(201).json({ success: true, message: 'Settlement recorded', data: settlement });
  } catch (error) {
    console.error('❌ payments error:', error);
    res.status(error.status || 400).json({ success: false, message: clientErrorMessage(error) });
  }
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
    if (order.orderStatus === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Order is cancelled and cannot be paid' });
    }

    // Only the genuinely outstanding amount may be charged. Prior manual
    // payments and attributed settlements must not be charged again.
    const alreadyPaid = await getOrderPaidTotal(order._id);
    const alreadySettled = await getOrderSettledTotal(order._id);
    const outstanding = round2(Math.max(0, round2(order.finalAmount) - alreadyPaid - alreadySettled));
    if (outstanding <= EPSILON) {
      return res.status(400).json({ success: false, message: 'Order is already paid' });
    }

    const crypto = require('crypto');
    const paymentMethod = paymentMode === 'upi' ? 'upi' : paymentMode === 'net_banking' ? 'bank_transfer' : 'card';

    // Resume path: reuse the most recent pending gateway payment for this order so a
    // customer retrying after an aborted payment attempt does not create orphan records.
    let payment = await Payment.findOne({ user: req.user._id, order: orderId, paymentStatus: 'pending' }).sort('-createdAt');
    if (payment) {
      payment.paymentMode = paymentMode;
      payment.paymentMethod = paymentMethod;
      payment.amount = outstanding;
      await payment.save();
    } else {
      const gatewayOrderId = 'order_' + crypto.randomBytes(12).toString('hex');
      payment = await Payment.create({
        user: req.user._id,
        order: orderId,
        amount: outstanding,
        paymentMethod,
        paymentMode,
        paymentStatus: 'pending',
        gatewayOrderId
      });
    }

    res.json({
      success: true,
      data: {
        gatewayOrderId: payment.gatewayOrderId,
        paymentId: payment._id,
        amount: outstanding,
        currency: 'INR',
        orderNumber: order.orderNumber,
        prefill: {
          name: req.user.name,
          mobile: req.user.mobile,
          email: req.user.email || ''
        }
      }
    });
  } catch (error) {
    console.error('❌ payments error:', error);
    res.status(400).json({ success: false, message: clientErrorMessage(error) });
  }
});

// POST /api/payments/verify - Verify online payment
router.post('/verify', protect, async (req, res) => {
  try {
    const { gatewayOrderId, gatewayPaymentId, gatewaySignature } = req.body;

    if (!gatewayOrderId || !gatewayPaymentId) {
      return res.status(400).json({ success: false, message: 'Missing payment verification data' });
    }

    const crypto = require('crypto');
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET;
    const simulatedAllowed = process.env.ALLOW_SIMULATED_PAYMENTS === 'true';

    const result = await withTransaction(async (session) => {
      const paymentQuery = Payment.findOne({ gatewayOrderId, user: req.user._id });
      if (session) paymentQuery.session(session);
      const payment = await paymentQuery;
      if (!payment) throw httpError(404, 'Payment not found');
      if (payment.paymentStatus === 'completed') {
        // Idempotent: a retry after a lost response must not fail the flow.
        return { payment, order: null, alreadyVerified: true };
      }

      if (razorpaySecret) {
        if (!gatewaySignature) {
          throw httpError(400, 'Payment signature is required');
        }
        const expectedSig = crypto
          .createHmac('sha256', razorpaySecret)
          .update(`${gatewayOrderId}|${gatewayPaymentId}`)
          .digest('hex');
        if (expectedSig !== gatewaySignature) {
          throw httpError(400, 'Invalid payment signature');
        }
      } else if (process.env.NODE_ENV === 'production' && !simulatedAllowed) {
        throw httpError(503, 'Online payment verification is not configured. Set RAZORPAY_KEY_SECRET or contact support.');
      }

      // Mark payment as completed
      payment.paymentStatus = 'completed';
      payment.gatewayPaymentId = gatewayPaymentId;
      payment.gatewaySignature = gatewaySignature || 'simulated';
      await payment.save(session ? { session } : undefined);

      const orderQuery = Order.findById(payment.order);
      if (session) orderQuery.session(session);
      const order = await orderQuery;

      if (order) {
        await recomputeOrderPaymentStatus(order, session);

        // Update the customer's ledger. Gateway payments on credit (Khata) orders
        // reduce creditBalance (credit orders never book pendingAmount); every
        // other method reduces pendingAmount. If the order was already cancelled,
        // the still-owed balance was removed at cancellation time, so the verified
        // amount must not be subtracted a second time.
        if (order.orderStatus !== 'cancelled') {
          const userQuery = User.findById(req.user._id);
          if (session) userQuery.session(session);
          const user = await userQuery;
          if (user) {
            const ledgerField = order.paymentMethod === 'credit' ? 'creditBalance' : 'pendingAmount';
            const currentBalance = round2(user[ledgerField]);
            if (payment.amount > currentBalance + EPSILON) {
              throw httpError(
                409,
                `Ledger inconsistency: ${ledgerField} is ₹${currentBalance}, but the verified payment is ₹${payment.amount}. Reconcile the account.`
              );
            }

            user[ledgerField] = round2(currentBalance - payment.amount);
            await user.save(session ? { session } : undefined);

            if (order.paymentMethod === 'credit') {
              await CreditTransaction.create([{
                user: req.user._id,
                amount: payment.amount,
                type: 'credit',
                referenceOrder: order._id,
                description: `Online payment for order #${order.orderNumber}`
              }], sessionOptions(session));
            }
          }
        }
      }

      return { payment, order, alreadyVerified: false };
    });

    if (result.alreadyVerified) {
      return res.json({ success: true, message: 'Payment already verified', data: result.payment });
    }

    const Notification = require('../models/Notification');
    await Notification.create({
      title: '💳 Payment Successful',
      message: `Your payment of ₹${result.payment.amount.toFixed(2)} for order #${result.order?.orderNumber || 'N/A'} has been confirmed.`,
      type: 'payment',
      recipient: req.user._id,
      link: `/orders/${result.payment.order}`,
      priority: 'high'
    });

    res.json({ success: true, message: 'Payment verified successfully', data: result.payment });
  } catch (error) {
    console.error('❌ payments error:', error);
    res.status(error.status || 400).json({ success: false, message: clientErrorMessage(error) });
  }
});

module.exports = router;
