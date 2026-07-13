const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const CreditTransaction = require('../models/CreditTransaction');
const { createAuditLog } = require('../utils/auditLogger');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { checkServiceability } = require('../utils/distance');
const { sanitizeSort, parsePositiveInt, parsePagination } = require('../utils/security');

const TIME_SLOTS = Order.TIME_SLOTS;

// ─── Validation helpers ───

function validateSchedule(deliveryType, scheduledDate, timeSlot) {
  if (deliveryType !== 'scheduled') return { valid: true };

  if (!scheduledDate || !timeSlot) {
    return { valid: false, message: 'Scheduled delivery requires both date and time slot.' };
  }

  if (!TIME_SLOTS.includes(timeSlot)) {
    return { valid: false, message: `Invalid time slot. Choose from: ${TIME_SLOTS.join(', ')}` };
  }

  const [sYear, sMonth, sDay] = scheduledDate.split('-');
  const schedStart = new Date(sYear, sMonth - 1, sDay);
  const now = new Date();

  // Must not be a past date
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (schedStart < todayStart) {
    return { valid: false, message: 'Cannot schedule delivery for a past date.' };
  }

  // If scheduling for today, validate the time slot hasn't passed
  if (schedStart.getTime() === todayStart.getTime()) {
    const slotStartHour = parseSlotStartHour(timeSlot);
    const currentHour = now.getHours();
    if (currentHour >= slotStartHour) {
      return { valid: false, message: `The time slot "${timeSlot}" has already passed for today. Please choose a later slot.` };
    }
  }

  // Max 30 days in advance
  const maxDate = new Date(todayStart);
  maxDate.setDate(maxDate.getDate() + 30);
  if (schedStart > maxDate) {
    return { valid: false, message: 'Cannot schedule delivery more than 30 days in advance.' };
  }

  return { valid: true };
}

function parseSlotStartHour(slot) {
  const match = slot.match(/^(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hour = parseInt(match[1]);
  const period = match[2].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour;
}

// ─── POST /api/orders — Create order ───
router.post('/', protect, async (req, res) => {
  try {
    const { items, paymentMethod, deliveryAddress, notes, deliveryType, scheduledDate, timeSlot } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'No items' });
    if (items.length > 100) return res.status(400).json({ success: false, message: 'Too many items in one order' });
    const finalPaymentMethod = paymentMethod || 'cash';
    if (!['cash', 'upi', 'card', 'credit', 'bank_transfer'].includes(finalPaymentMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    // Validate schedule
    const scheduleCheck = validateSchedule(deliveryType || 'instant', scheduledDate, timeSlot);
    if (!scheduleCheck.valid) {
      return res.status(400).json({ success: false, message: scheduleCheck.message });
    }

    // Validate Delivery Radius
    const addressToUse = deliveryAddress || req.user.address;
    if (!addressToUse || addressToUse.lat == null || addressToUse.lng == null) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid location coordinates for delivery. Enable location access in your profile.'
      });
    }

    const serviceCheck = await checkServiceability(addressToUse.lat, addressToUse.lng);
    if (!serviceCheck.serviceable) {
      return res.status(400).json({
        success: false,
        message: serviceCheck.message,
        serviceability: { serviceable: false, distance: serviceCheck.distance, radius: serviceCheck.radius, shopLocation: serviceCheck.shopLocation }
      });
    }

    let totalAmount = 0;
    const orderItems = [];
    const stockUpdates = [];

    for (const item of items) {
      let quantity;
      try {
        quantity = parsePositiveInt(item.quantity);
      } catch (err) {
        return res.status(400).json({ success: false, message: err.message });
      }

      const product = await Product.findById(item.product);
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
      if (product.status === 'inactive') return res.status(400).json({ success: false, message: `${product.name} is no longer available` });
      if (product.stock < quantity) return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });

      const price = (req.user.customerType !== 'public' && product.wholesalePrice) ? product.wholesalePrice : product.price;
      orderItems.push({ product: product._id, name: product.name, price, quantity, total: price * quantity });
      totalAmount += price * quantity;
      stockUpdates.push({ product, quantity });
    }

    // Credit limit check BEFORE any writes
    if (finalPaymentMethod === 'credit') {
      const user = await User.findById(req.user._id);
      if (user.creditLimit <= 0) {
        return res.status(400).json({ success: false, message: 'Credit facility not enabled for your account. Contact admin.' });
      }
      if (user.creditBalance + totalAmount > user.creditLimit) {
        return res.status(400).json({ success: false, message: `Credit limit exceeded. Available: ₹${user.creditLimit - user.creditBalance}` });
      }
    }

    // Build order data
    const orderData = {
      user: req.user._id, items: orderItems, totalAmount, discount: 0, deliveryCharge: 0, finalAmount: totalAmount,
      paymentMethod: finalPaymentMethod,
      deliveryAddress: { street: addressToUse.street, area: addressToUse.area, city: addressToUse.city, pincode: addressToUse.pincode, lat: addressToUse.lat, lng: addressToUse.lng },
      distanceFromShop: serviceCheck.distance,
      deliveryType: deliveryType || 'instant',
      notes,
      statusHistory: [{ status: 'pending', note: deliveryType === 'scheduled' ? `Order placed — Scheduled for ${new Date(scheduledDate).toLocaleDateString('en-IN')} (${timeSlot})` : 'Order placed' }]
    };

    // Add schedule info
    if (deliveryType === 'scheduled') {
      const [sYear, sMonth, sDay] = scheduledDate.split('-');
      const localScheduledDate = new Date(sYear, sMonth - 1, sDay);
      orderData.scheduledDelivery = {
        date: localScheduledDate,
        timeSlot,
        scheduledAt: new Date(),
        originalDate: localScheduledDate,
        originalTimeSlot: timeSlot
      };
      orderData.deliveryDate = localScheduledDate;
    }

    // Apply stock deductions atomically to prevent overselling during concurrent checkouts.
    const appliedStockUpdates = [];
    const lowStockNotifications = [];
    for (const { product, quantity } of stockUpdates) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: product._id, status: { $ne: 'inactive' }, stock: { $gte: quantity } },
        { $inc: { stock: -quantity, totalSold: quantity } },
        { new: true }
      );
      if (!updatedProduct) {
        for (const applied of appliedStockUpdates) {
          await Product.findByIdAndUpdate(applied.productId, { $inc: { stock: applied.quantity, totalSold: -applied.quantity } });
        }
        return res.status(409).json({ success: false, message: `Insufficient stock for ${product.name}` });
      }
      appliedStockUpdates.push({ productId: product._id, quantity });
      if (updatedProduct.stock <= updatedProduct.minStock) {
        lowStockNotifications.push({ title: 'Low Stock', message: `${updatedProduct.name} low: ${updatedProduct.stock}`, type: 'stock', recipientRole: 'admin' });
      }
    }

    let order;
    try {
      order = await Order.create(orderData);
    } catch (error) {
      for (const applied of appliedStockUpdates) {
        await Product.findByIdAndUpdate(applied.productId, { $inc: { stock: applied.quantity, totalSold: -applied.quantity } });
      }
      throw error;
    }

    for (const notification of lowStockNotifications) {
      await Notification.create(notification);
    }

    // Credit handling (already validated above)
    if (finalPaymentMethod === 'credit') {
      await User.findByIdAndUpdate(req.user._id, { $inc: { creditBalance: totalAmount } });
      await CreditTransaction.create({ user: req.user._id, amount: totalAmount, type: 'debit', referenceOrder: order._id, description: `Order #${order.orderNumber}` });
    }

    await User.findByIdAndUpdate(req.user._id, { $inc: { totalOrders: 1, totalSpent: totalAmount, pendingAmount: finalPaymentMethod === 'credit' ? 0 : totalAmount } });

    // Notifications
    const scheduleLabel = deliveryType === 'scheduled' ? ` 📅 Scheduled: ${new Date(scheduledDate).toLocaleDateString('en-IN')} ${timeSlot}` : ' ⚡ Instant';
    await Notification.create({ title: 'New Order', message: `Order #${order.orderNumber} from ${req.user.name} — ₹${totalAmount} (${serviceCheck.distance} KM)${scheduleLabel}`, type: 'order', recipientRole: 'admin' });

    if (deliveryType === 'scheduled') {
      await Notification.create({
        title: '📅 Delivery Scheduled',
        message: `Your order #${order.orderNumber} is scheduled for delivery on ${new Date(scheduledDate).toLocaleDateString('en-IN')} between ${timeSlot}.`,
        type: 'order', recipient: req.user._id
      });
    }

    await createAuditLog(req.user._id, 'order_create', 'order', order._id, { orderNumber: order.orderNumber, distance: serviceCheck.distance, deliveryType: deliveryType || 'instant' }, req);

    res.status(201).json({ success: true, message: deliveryType === 'scheduled' ? 'Order scheduled successfully' : 'Order placed', data: order });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// ─── GET /api/orders — List orders (with scheduling filters) ───
router.get('/', protect, async (req, res) => {
  try {
    const { status, paymentStatus, deliveryType, scheduledDate, timeSlot, page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const paging = parsePagination(page, limit);
    const query = {};
    if (req.user.role === 'customer') query.user = req.user._id;
    if (status) query.orderStatus = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (deliveryType) query.deliveryType = deliveryType;
    if (timeSlot) query['scheduledDelivery.timeSlot'] = timeSlot;

    if (scheduledDate) {
      const [year, month, day] = scheduledDate.split('-');
      const dayStart = new Date(year, month - 1, day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      query['scheduledDelivery.date'] = { $gte: dayStart, $lt: dayEnd };
    }

    const total = await Order.countDocuments(query);
    const safeSort = sanitizeSort(sort, '-createdAt', ['createdAt', 'totalAmount', 'orderStatus', 'finalAmount', 'deliveryDate']);
    const orders = await Order.find(query).populate('user', 'name mobile customerType').sort(safeSort).skip(paging.skip).limit(paging.limit);
    res.json({ success: true, data: orders, pagination: { total, page: paging.page, pages: Math.ceil(total / paging.limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ─── GET /api/orders/scheduled/upcoming — Upcoming scheduled deliveries ───
router.get('/scheduled/upcoming', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const upcoming = await Order.find({
      deliveryType: 'scheduled',
      'scheduledDelivery.date': { $gte: todayStart },
      orderStatus: { $nin: ['delivered', 'cancelled'] }
    })
    .populate('user', 'name mobile address customerType')
    .sort('scheduledDelivery.date scheduledDelivery.timeSlot');

    // Split into today vs future
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const todayDeliveries = upcoming.filter(o => {
      const d = new Date(o.scheduledDelivery.date);
      return d >= todayStart && d < tomorrowStart;
    });

    const futureDeliveries = upcoming.filter(o => {
      const d = new Date(o.scheduledDelivery.date);
      return d >= tomorrowStart;
    });

    // Late deliveries (scheduled date passed but not delivered)
    const late = await Order.find({
      deliveryType: 'scheduled',
      'scheduledDelivery.date': { $lt: todayStart },
      orderStatus: { $nin: ['delivered', 'cancelled'] }
    })
    .populate('user', 'name mobile address')
    .sort('-scheduledDelivery.date');

    res.json({
      success: true,
      data: {
        today: todayDeliveries,
        upcoming: futureDeliveries,
        late,
        stats: {
          todayCount: todayDeliveries.length,
          upcomingCount: futureDeliveries.length,
          lateCount: late.length,
          totalScheduled: upcoming.length + late.length
        }
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ─── GET /api/orders/time-slots — Available time slots ───
router.get('/time-slots', async (req, res) => {
  res.json({ success: true, data: TIME_SLOTS });
});

// ─── GET /api/orders/:id ───
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name mobile email address customerType')
      .populate('items.product', 'name image')
      .populate('scheduledDelivery.rescheduledBy', 'name');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (req.user.role === 'customer' && order.user._id.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
    res.json({ success: true, data: order });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ─── PUT /api/orders/:id/reschedule — Reschedule delivery ───
router.put('/:id/reschedule', protect, async (req, res) => {
  try {
    const { scheduledDate, timeSlot } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Customer can only reschedule their own orders
    if (req.user.role === 'customer' && order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Can only reschedule if not yet processing/delivered/cancelled
    if (['processing', 'out_for_delivery', 'delivered', 'cancelled'].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: `Cannot reschedule — order is already "${order.orderStatus.replace(/_/g, ' ')}".` });
    }

    const scheduleCheck = validateSchedule('scheduled', scheduledDate, timeSlot);
    if (!scheduleCheck.valid) {
      return res.status(400).json({ success: false, message: scheduleCheck.message });
    }

    const oldDate = order.scheduledDelivery?.date;
    const oldSlot = order.scheduledDelivery?.timeSlot;

    const [sYear, sMonth, sDay] = scheduledDate.split('-');
    const localScheduledDate = new Date(sYear, sMonth - 1, sDay);

    order.deliveryType = 'scheduled';
    order.scheduledDelivery = {
      ...order.scheduledDelivery?.toObject?.() || {},
      date: localScheduledDate,
      timeSlot,
      rescheduledAt: new Date(),
      rescheduledBy: req.user._id,
      originalDate: order.scheduledDelivery?.originalDate || oldDate || localScheduledDate,
      originalTimeSlot: order.scheduledDelivery?.originalTimeSlot || oldSlot || timeSlot
    };
    order.deliveryDate = localScheduledDate;
    order.statusHistory.push({
      status: order.orderStatus,
      note: `Rescheduled from ${oldDate ? new Date(oldDate).toLocaleDateString('en-IN') : 'instant'} (${oldSlot || 'N/A'}) → ${localScheduledDate.toLocaleDateString('en-IN')} (${timeSlot})`
    });

    await order.save();

    // Notify
    await Notification.create({
      title: '🔄 Delivery Rescheduled',
      message: `Order #${order.orderNumber} rescheduled to ${new Date(scheduledDate).toLocaleDateString('en-IN')} (${timeSlot})`,
      type: 'order',
      recipient: order.user,
      metadata: { orderId: order._id }
    });

    if (req.user.role !== 'customer') {
      await Notification.create({
        title: '🔄 Delivery Rescheduled by Admin',
        message: `Order #${order.orderNumber} rescheduled to ${new Date(scheduledDate).toLocaleDateString('en-IN')} (${timeSlot})`,
        type: 'order', recipientRole: 'admin'
      });
    }

    res.json({ success: true, message: 'Delivery rescheduled successfully', data: order });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// ─── PUT /api/orders/:id/status ───
router.put('/:id/status', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { orderStatus, note } = req.body;
    const allowedStatuses = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!allowedStatuses.includes(orderStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid order status' });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    order.orderStatus = orderStatus;
    order.statusHistory.push({ status: orderStatus, note: note || '' });
    if (orderStatus === 'delivered') order.deliveredAt = new Date();

    // When dispatching a scheduled order, notify customer
    if (orderStatus === 'out_for_delivery' && order.deliveryType === 'scheduled') {
      await Notification.create({
        title: '🚚 Delivery Dispatched',
        message: `Your scheduled order #${order.orderNumber} has been dispatched and is on its way!`,
        type: 'order', recipient: order.user
      });
    }

    await order.save();
    await Notification.create({ title: 'Order Update', message: `Order #${order.orderNumber} is ${orderStatus}`, type: 'order', recipient: order.user });
    res.json({ success: true, message: 'Status updated', data: order });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// ─── PUT /api/orders/:id/cancel ───
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (req.user.role === 'customer' && order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (['delivered', 'cancelled'].includes(order.orderStatus)) return res.status(400).json({ success: false, message: 'Cannot cancel' });
    if (req.user.role === 'customer' && !['pending', 'confirmed'].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: 'Order can no longer be cancelled by customer' });
    }

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity, totalSold: -item.quantity } });
    }
    order.orderStatus = 'cancelled';
    order.cancelReason = req.body.reason || 'Cancelled';
    order.statusHistory.push({ status: 'cancelled', note: order.cancelReason });
    await order.save();

    if (order.paymentMethod === 'credit') {
      await User.findByIdAndUpdate(order.user, { $inc: { creditBalance: -order.finalAmount } });
      await CreditTransaction.create({
        user: order.user,
        amount: order.finalAmount,
        type: 'credit',
        referenceOrder: order._id,
        description: `Cancelled order #${order.orderNumber}`
      });
    } else if (order.paymentStatus !== 'paid') {
      await User.findByIdAndUpdate(order.user, { $inc: { pendingAmount: -order.finalAmount } });
    }

    res.json({ success: true, message: 'Order cancelled', data: order });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// ─── GET /api/orders/:id/invoice ───
router.get('/:id/invoice', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name mobile email address');
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    if (req.user.role === 'customer' && order.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this invoice' });
    }
    const pdfBuffer = await generateInvoicePDF(order, order.user);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=invoice-${order.orderNumber}.pdf` });
    res.send(pdfBuffer);
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
