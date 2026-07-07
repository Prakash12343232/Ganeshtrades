const express = require('express');
const router = express.Router();
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');
const logAction = require('../utils/auditLogger');

router.use(protect);

// Admin/Manager: Get all deliveries
router.get('/', restrictTo('admin', 'manager'), async (req, res) => {
  try {
    const deliveries = await Delivery.find()
      .populate({ path: 'order', select: 'orderNumber deliveryAddress totalAmount paymentStatus' })
      .populate('deliveryPerson', 'name mobile')
      .sort('-createdAt');
    res.json({ success: true, data: deliveries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delivery Boy: Get my assigned deliveries
router.get('/my-deliveries', restrictTo('delivery'), async (req, res) => {
  try {
    const deliveries = await Delivery.find({ 
      deliveryPerson: req.user.id,
      status: { $in: ['assigned', 'out_for_delivery'] }
    })
      .populate({ path: 'order', populate: { path: 'user', select: 'name mobile' } })
      .sort('-createdAt');
    res.json({ success: true, data: deliveries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Assign delivery
router.post('/assign', restrictTo('admin', 'manager'), async (req, res) => {
  try {
    const { orderId, deliveryPersonId } = req.body;
    
    let delivery = await Delivery.findOne({ order: orderId });
    if (!delivery) {
      delivery = new Delivery({ order: orderId });
    }
    
    delivery.deliveryPerson = deliveryPersonId;
    delivery.status = 'assigned';
    delivery.assignedAt = Date.now();
    await delivery.save();

    // Update order deliveryId
    await Order.findByIdAndUpdate(orderId, { deliveryId: delivery._id });

    await logAction(req.user.id, 'ASSIGN_DELIVERY', 'Delivery', delivery._id);
    res.json({ success: true, data: delivery });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delivery Boy: Update status
router.put('/:id/status', restrictTo('delivery', 'admin'), async (req, res) => {
  try {
    const { status, notes, failureReason } = req.body;
    const delivery = await Delivery.findById(req.params.id);
    
    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });
    
    // Delivery boy can only update their own
    if (req.user.role === 'delivery' && delivery.deliveryPerson.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your delivery' });
    }

    delivery.status = status;
    if (notes) delivery.notes = notes;
    
    if (status === 'out_for_delivery') delivery.outForDeliveryAt = Date.now();
    if (status === 'delivered') delivery.deliveredAt = Date.now();
    if (status === 'failed') {
      delivery.failedAt = Date.now();
      delivery.failureReason = failureReason;
    }

    await delivery.save();

    // Sync status to Order
    await Order.findByIdAndUpdate(delivery.order, { 
      orderStatus: status === 'failed' ? 'processing' : status 
    });

    res.json({ success: true, data: delivery });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
