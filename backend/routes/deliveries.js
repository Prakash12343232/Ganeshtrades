const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { parsePagination } = require('../utils/security');

const DELIVERY_STATUSES = ['assigned', 'picked_up', 'on_the_way', 'delivered', 'failed'];

router.use(protect, authorize('admin', 'manager'));

// POST /api/deliveries - Assign delivery
router.post('/', async (req, res) => {
  try {
    const { orderId, deliveryPersonName, deliveryPersonMobile, notes } = req.body;
    if (!/^[6-9]\d{9}$/.test(String(deliveryPersonMobile))) {
      return res.status(400).json({ success: false, message: 'Invalid delivery person mobile number' });
    }
    
    const existing = await Delivery.findOne({ order: orderId });
    if (existing) return res.status(400).json({ success: false, message: 'Delivery already assigned for this order' });

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (['delivered', 'cancelled'].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: 'Cannot assign delivery for a completed or cancelled order' });
    }

    const delivery = await Delivery.create({
      order: orderId,
      deliveryPersonName,
      deliveryPersonMobile,
      notes,
      assignedBy: req.user._id,
      history: [{ status: 'assigned', note: 'Assigned to ' + deliveryPersonName }]
    });

    order.orderStatus = 'processing';
    await order.save();

      // Notify customer of delivery assignment
      const scheduleInfo = order.deliveryType === 'scheduled' && order.scheduledDelivery?.date
        ? ` Scheduled: ${new Date(order.scheduledDelivery.date).toLocaleDateString('en-IN')} (${order.scheduledDelivery.timeSlot})`
        : '';
    await Notification.create({
      title: '📦 Delivery Assigned',
      message: `Your order #${order.orderNumber} has been assigned to ${deliveryPersonName}.${scheduleInfo}`,
      type: 'order', recipient: order.user
    });

    await createAuditLog(req.user._id, 'delivery_assign', 'delivery', delivery._id, { orderId }, req);
    res.status(201).json({ success: true, data: delivery });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// GET /api/deliveries - List deliveries (with schedule filters)
router.get('/', async (req, res) => {
  try {
    const { status, deliveryType, scheduledDate, timeSlot, page = 1, limit = 50 } = req.query;
    const paging = parsePagination(page, limit, 100);
    const query = {};
    if (status) query.status = status;

    const total = await Delivery.countDocuments(query);
    let deliveries = await Delivery.find(query)
      .populate({
        path: 'order',
        select: 'orderNumber finalAmount deliveryAddress user deliveryType scheduledDelivery distanceFromShop',
        populate: { path: 'user', select: 'name mobile' }
      })
      .sort('-createdAt')
      .skip(paging.skip)
      .limit(paging.limit);

    // Post-filter by order delivery type / schedule if needed
    if (deliveryType) {
      deliveries = deliveries.filter(d => d.order?.deliveryType === deliveryType);
    }
    if (scheduledDate) {
      const [year, month, day] = scheduledDate.split('-');
      const dayStart = new Date(year, month - 1, day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      deliveries = deliveries.filter(d => {
        const dd = d.order?.scheduledDelivery?.date;
        return dd && new Date(dd) >= dayStart && new Date(dd) < dayEnd;
      });
    }
    if (timeSlot) {
      deliveries = deliveries.filter(d => d.order?.scheduledDelivery?.timeSlot === timeSlot);
    }

    res.json({ success: true, data: deliveries, pagination: { total, page: paging.page, pages: Math.ceil(total / paging.limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /api/deliveries/today-priority — Priority list for today
router.get('/today-priority', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    // All active deliveries
    const activeDeliveries = await Delivery.find({
      status: { $nin: ['delivered', 'failed'] }
    }).populate({
      path: 'order',
      select: 'orderNumber finalAmount deliveryAddress user deliveryType scheduledDelivery distanceFromShop createdAt',
      populate: { path: 'user', select: 'name mobile address' }
    });

    // Separate by priority
    const lateScheduled = [];     // Scheduled date passed — highest priority
    const todayScheduled = [];    // Scheduled for today — high priority
    const instantPending = [];    // Instant orders — normal priority
    const futureScheduled = [];   // Scheduled for later — low priority

    activeDeliveries.forEach(d => {
      if (!d.order) return;
      if (d.order.deliveryType === 'scheduled' && d.order.scheduledDelivery?.date) {
        const schedDate = new Date(d.order.scheduledDelivery.date);
        if (schedDate < todayStart) {
          lateScheduled.push(d);
        } else if (schedDate >= todayStart && schedDate < tomorrowStart) {
          todayScheduled.push(d);
        } else {
          futureScheduled.push(d);
        }
      } else {
        instantPending.push(d);
      }
    });

    // Sort today's scheduled by time slot
    const slotOrder = Order.TIME_SLOTS;
    todayScheduled.sort((a, b) => {
      const ai = slotOrder.indexOf(a.order.scheduledDelivery?.timeSlot);
      const bi = slotOrder.indexOf(b.order.scheduledDelivery?.timeSlot);
      return ai - bi;
    });

    res.json({
      success: true,
      data: {
        late: lateScheduled,
        today: todayScheduled,
        instant: instantPending,
        future: futureScheduled,
        stats: {
          lateCount: lateScheduled.length,
          todayCount: todayScheduled.length,
          instantCount: instantPending.length,
          futureCount: futureScheduled.length
        }
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// PUT /api/deliveries/:id/status - Update delivery status
router.put('/:id/status', async (req, res) => {
  try {
    const { status, note, location } = req.body;
    if (!DELIVERY_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery status' });
    }
    const delivery = await Delivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });

    delivery.status = status;
    if (location !== undefined) delivery.location = String(location).slice(0, 200);
    delivery.history.push({ status, note });
    await delivery.save();

    const order = await Order.findById(delivery.order);

    if (status === 'delivered') {
      if (order && order.orderStatus !== 'delivered') {
        order.orderStatus = 'delivered';
        order.deliveredAt = new Date();
        order.statusHistory.push({ status: 'delivered', note: 'Delivered by ' + delivery.deliveryPersonName });
        await order.save();
      }
    } else if (status === 'on_the_way') {
      if (order) {
        await Order.findByIdAndUpdate(delivery.order, { orderStatus: 'out_for_delivery' });
        // Dispatch notification for scheduled orders
        if (order.deliveryType === 'scheduled') {
          await Notification.create({
            title: '🚚 Scheduled Delivery Dispatched',
            message: `Your scheduled order #${order.orderNumber} is now out for delivery!`,
            type: 'order', recipient: order.user
          });
        }
      }
    }

    await createAuditLog(req.user._id, 'delivery_update', 'delivery', delivery._id, { status }, req);
    res.json({ success: true, data: delivery });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

module.exports = router;
