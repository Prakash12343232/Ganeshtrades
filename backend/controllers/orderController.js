const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Payment = require('../models/Payment');
const CreditTransaction = require('../models/CreditTransaction');
const Delivery = require('../models/Delivery');
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

// Reverse the inventory + financial effects of cancelling an order so the
// manual status path and the customer cancelOrder endpoint share semantics:
// restore stock, and undo the unpaid portion of the pending/credit balance
// booked at creation. Money already collected on the order (recorded/verified
// payments) reduced the customer's ledger when it happened, so only the
// still-owed remainder is reversed — reversing the full finalAmount would
// double-decrement and could push creditBalance/pendingAmount negative.
async function reverseOrderFinancials(order) {
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity, totalSold: -item.quantity } });
  }

  const paidAgg = await Payment.aggregate([
    { $match: { order: order._id, paymentStatus: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const alreadyPaid = paidAgg[0]?.total || 0;
  const stillOwed = Math.max(0, order.finalAmount - alreadyPaid);
  if (stillOwed <= 0) return;

  // Khata settlements reduce the user's debt ledger directly (they live in the
  // Settlement collection, not Payment), so `stillOwed` derived purely from
  // Payment docs can exceed the balance the user still actually carries. Cap
  // the reversal at the current ledger balance so a cancellation after a
  // settlement can never push creditBalance/pendingAmount negative.
  const user = await User.findById(order.user);
  const currentBalance = order.paymentMethod === 'credit' ? (user?.creditBalance || 0) : (user?.pendingAmount || 0);
  const reversalAmount = Math.min(stillOwed, currentBalance);
  if (reversalAmount <= 0) return;

  if (order.paymentMethod === 'credit') {
    await User.findByIdAndUpdate(order.user, { $inc: { creditBalance: -reversalAmount } });
    await CreditTransaction.create({
      user: order.user,
      amount: reversalAmount,
      type: 'credit',
      referenceOrder: order._id,
      description: `Cancelled order #${order.orderNumber}`
    });
  } else {
    await User.findByIdAndUpdate(order.user, { $inc: { pendingAmount: -reversalAmount } });
  }
}

// ─── Controller Functions ───

exports.createOrder = async (req, res) => {
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

    // Calculate estimated delivery time
    let estimatedDeliveryTime;
    if (deliveryType === 'scheduled' && scheduledDate && timeSlot) {
      const [sYear, sMonth, sDay] = scheduledDate.split('-');
      const slotMatch = timeSlot.match(/^(\d+)\s*(AM|PM)/i);
      let slotHour = slotMatch ? parseInt(slotMatch[1]) : 12;
      const slotPeriod = slotMatch ? slotMatch[2].toUpperCase() : 'PM';
      if (slotPeriod === 'PM' && slotHour !== 12) slotHour += 12;
      if (slotPeriod === 'AM' && slotHour === 12) slotHour = 0;
      estimatedDeliveryTime = new Date(sYear, sMonth - 1, sDay, slotHour, 0, 0);
    } else {
      // Instant: estimate 2 hours from now
      estimatedDeliveryTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    }

    // Build order data
    const orderData = {
      user: req.user._id, items: orderItems, totalAmount, discount: 0, deliveryCharge: 0, finalAmount: totalAmount,
      paymentMethod: finalPaymentMethod,
      deliveryAddress: { street: addressToUse.street, area: addressToUse.area, city: addressToUse.city, pincode: addressToUse.pincode, lat: addressToUse.lat, lng: addressToUse.lng },
      distanceFromShop: serviceCheck.distance,
      deliveryType: deliveryType || 'instant',
      estimatedDeliveryTime,
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
    await Notification.create({ title: 'New Order', message: `Order #${order.orderNumber} from ${req.user.name} — ₹${totalAmount} (${serviceCheck.distance} KM)${scheduleLabel}`, type: 'order', recipientRole: 'admin', link: `/admin/orders`, metadata: { orderId: order._id } });

    // Notify customer
    await Notification.create({ title: '✅ Order Received', message: `Your order #${order.orderNumber} has been received! Estimated delivery: ${estimatedDeliveryTime.toLocaleString('en-IN')}.`, type: 'order', recipient: req.user._id, link: `/orders/${order._id}`, metadata: { orderId: order._id } });

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
};

exports.getOrders = async (req, res) => {
  try {
    const { status, paymentStatus, deliveryType, scheduledDate, timeSlot, userId, page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const paging = parsePagination(page, limit);
    const query = {};
    if (req.user.role === 'customer') query.user = req.user._id;
    else if (userId) query.user = userId;
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

    // Attach delivery assignment info so admin UIs can show/trigger assignment
    const deliveryByOrder = new Map();
    const orderIds = orders.map((o) => o._id);
    if (orderIds.length) {
      const deliveries = await Delivery.find({ order: { $in: orderIds } }).select('order deliveryPersonName deliveryPersonMobile status');
      deliveries.forEach((d) => deliveryByOrder.set(String(d.order), d));
    }

    // Attach payment progress so admin UIs can prefill/cap manual payments to
    // the order's true outstanding amount (finalAmount - completed payments).
    const paidByOrder = new Map();
    if (orderIds.length) {
      const paidAgg = await Payment.aggregate([
        { $match: { order: { $in: orderIds }, paymentStatus: 'completed' } },
        { $group: { _id: '$order', total: { $sum: '$amount' } } }
      ]);
      paidAgg.forEach((p) => paidByOrder.set(String(p._id), p.total));
    }
    const data = orders.map((o) => {
      const delivery = deliveryByOrder.get(String(o._id));
      const paidAmount = paidByOrder.get(String(o._id)) || 0;
      return {
        ...o.toObject(),
        paidAmount,
        outstandingAmount: Math.max(0, (o.finalAmount || 0) - paidAmount),
        deliveryAssigned: Boolean(delivery),
        deliveryPersonName: delivery?.deliveryPersonName || null,
        deliveryPersonMobile: delivery?.deliveryPersonMobile || null,
        deliveryStatus: delivery?.status || null
      };
    });

    res.json({ success: true, data, pagination: { total, page: paging.page, pages: Math.ceil(total / paging.limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getUpcomingScheduledOrders = async (req, res) => {
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
};

exports.getTimeSlots = async (req, res) => {
  res.json({ success: true, data: TIME_SLOTS });
};

exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name mobile email address customerType')
      .populate('items.product', 'name image')
      .populate('scheduledDelivery.rescheduledBy', 'name');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (req.user.role === 'customer' && order.user._id.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
    res.json({ success: true, data: order });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.rescheduleOrder = async (req, res) => {
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

    // Keep the ETA banner consistent with the new slot instead of showing a stale estimate
    const slotMatch = timeSlot.match(/^(\d+)\s*(AM|PM)/i);
    let slotHour = slotMatch ? parseInt(slotMatch[1]) : 12;
    const slotPeriod = slotMatch ? slotMatch[2].toUpperCase() : 'PM';
    if (slotPeriod === 'PM' && slotHour !== 12) slotHour += 12;
    if (slotPeriod === 'AM' && slotHour === 12) slotHour = 0;
    order.estimatedDeliveryTime = new Date(sYear, sMonth - 1, sDay, slotHour, 0, 0);

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
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus, note } = req.body;
    const allowedStatuses = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'];
    if (!allowedStatuses.includes(orderStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid order status' });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Terminal states are permanent: a delivered or cancelled order must never
    // be moved backward (e.g. delivered -> pending), which would re-run the
    // reversal logic and double-restore stock / balances.
    if (order.orderStatus === 'delivered' && orderStatus !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Cannot change status of a delivered order' });
    }
    if (order.orderStatus === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Order is already cancelled' });
    }

    // Cancelling via the status path must reverse inventory + balances just
    // like cancelOrder, and is only legal before the order is terminal.
    if (orderStatus === 'cancelled') {
      order.cancelReason = note || 'Cancelled';
      await reverseOrderFinancials(order);
    }

    order.orderStatus = orderStatus;
    order.statusHistory.push({ status: orderStatus, note: note || '' });
    if (orderStatus === 'delivered') order.deliveredAt = new Date();

    // Update estimated delivery time based on status
    if (orderStatus === 'out_for_delivery') {
      order.estimatedDeliveryTime = new Date(Date.now() + 30 * 60 * 1000); // 30 min ETA
    } else if (orderStatus === 'confirmed') {
      order.estimatedDeliveryTime = new Date(Date.now() + 90 * 60 * 1000); // 1.5 hour ETA
    } else if (orderStatus === 'processing') {
      order.estimatedDeliveryTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour ETA
    }

    // When dispatching a scheduled order, notify customer
    if (orderStatus === 'out_for_delivery') {
      await Notification.create({
        title: '🚚 Out for Delivery',
        message: `Your order #${order.orderNumber} is on its way! Expected in about 30 minutes.`,
        type: 'delivery', recipient: order.user, link: `/orders/${order._id}`, priority: 'high'
      });
    }

    await order.save();

    // Keep the delivery record in sync when the order reaches a terminal state
    // via the manual status path (unifies it with the delivery-assignment path).
    if (orderStatus === 'delivered' || orderStatus === 'cancelled') {
      const delivery = await Delivery.findOne({ order: order._id });
      if (delivery && !['delivered', 'failed'].includes(delivery.status)) {
        delivery.status = orderStatus === 'delivered' ? 'delivered' : 'failed';
        delivery.history.push({
          status: delivery.status,
          note: orderStatus === 'delivered' ? 'Order marked as delivered' : 'Order cancelled'
        });
        await delivery.save();
      }
    }

    // Status-specific notification labels
    const statusLabels = { pending: 'Order Received', confirmed: 'Order Confirmed', processing: 'Preparing Your Order', out_for_delivery: 'Out for Delivery', delivered: 'Delivered Successfully', cancelled: 'Order Cancelled' };
    await Notification.create({ title: '📦 Order Update', message: `Order #${order.orderNumber}: ${statusLabels[orderStatus] || orderStatus}`, type: 'order', recipient: order.user, link: `/orders/${order._id}` });
    res.json({ success: true, message: 'Status updated', data: order });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (req.user.role === 'customer' && order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (['delivered', 'cancelled'].includes(order.orderStatus)) return res.status(400).json({ success: false, message: 'Cannot cancel' });
    if (req.user.role === 'customer' && !['pending', 'confirmed'].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: 'Order can no longer be cancelled by customer' });
    }

    order.orderStatus = 'cancelled';
    order.cancelReason = req.body.reason || 'Cancelled';
    order.statusHistory.push({ status: 'cancelled', note: order.cancelReason });
    await order.save();
    await reverseOrderFinancials(order);

    // A cancelled order must not keep an active delivery in the dispatch queues.
    const delivery = await Delivery.findOne({ order: order._id });
    if (delivery && !['delivered', 'failed'].includes(delivery.status)) {
      delivery.status = 'failed';
      delivery.history.push({ status: 'failed', note: 'Order cancelled' });
      await delivery.save();
    }

    res.json({ success: true, message: 'Order cancelled', data: order });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
};

exports.getOrderInvoice = async (req, res) => {
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
};
