const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { generateInvoicePDF } = require('../utils/pdfGenerator');

// POST /api/orders - Create order
router.post('/', protect, async (req, res) => {
  try {
    const { items, paymentMethod, deliveryAddress, notes } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'No items' });

    let totalAmount = 0;
    const orderItems = [];
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) return res.status(404).json({ success: false, message: `Product not found` });
      if (product.stock < item.quantity) return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });

      const price = (req.user.customerType !== 'public' && product.wholesalePrice) ? product.wholesalePrice : product.price;
      orderItems.push({ product: product._id, name: product.name, price, quantity: item.quantity, total: price * item.quantity });
      totalAmount += price * item.quantity;
      product.stock -= item.quantity;
      product.totalSold += item.quantity;
      await product.save();
      if (product.stock <= product.minStock) {
        await Notification.create({ title: 'Low Stock', message: `${product.name} low: ${product.stock}`, type: 'stock', recipientRole: 'admin' });
      }
    }

    const order = await Order.create({
      user: req.user._id, items: orderItems, totalAmount, discount: 0, deliveryCharge: 0, finalAmount: totalAmount,
      paymentMethod: paymentMethod || 'cash', deliveryAddress: deliveryAddress || req.user.address, notes,
      statusHistory: [{ status: 'pending', note: 'Order placed' }]
    });

    await User.findByIdAndUpdate(req.user._id, { $inc: { totalOrders: 1, totalSpent: totalAmount, pendingAmount: totalAmount } });
    await Notification.create({ title: 'New Order', message: `Order #${order.orderNumber} from ${req.user.name} - ₹${totalAmount}`, type: 'order', recipientRole: 'admin' });
    await createAuditLog(req.user._id, 'order_create', 'order', order._id, { orderNumber: order.orderNumber }, req);

    res.status(201).json({ success: true, message: 'Order placed', data: order });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// GET /api/orders
router.get('/', protect, async (req, res) => {
  try {
    const { status, paymentStatus, page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const query = {};
    if (req.user.role === 'customer') query.user = req.user._id;
    if (status) query.orderStatus = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query).populate('user', 'name mobile customerType').sort(sort).skip((page - 1) * limit).limit(parseInt(limit));
    res.json({ success: true, data: orders, pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /api/orders/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name mobile email address customerType').populate('items.product', 'name image');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (req.user.role === 'customer' && order.user._id.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
    res.json({ success: true, data: order });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// PUT /api/orders/:id/status
router.put('/:id/status', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { orderStatus, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    order.orderStatus = orderStatus;
    order.statusHistory.push({ status: orderStatus, note: note || '' });
    if (orderStatus === 'delivered') order.deliveredAt = new Date();
    await order.save();
    await Notification.create({ title: 'Order Update', message: `Order #${order.orderNumber} is ${orderStatus}`, type: 'order', recipient: order.user });
    res.json({ success: true, message: 'Status updated', data: order });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// PUT /api/orders/:id/cancel
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (req.user.role === 'customer' && order.user.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (['delivered', 'cancelled'].includes(order.orderStatus)) return res.status(400).json({ success: false, message: 'Cannot cancel' });

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity, totalSold: -item.quantity } });
    }
    order.orderStatus = 'cancelled';
    order.cancelReason = req.body.reason || 'Cancelled';
    order.statusHistory.push({ status: 'cancelled', note: order.cancelReason });
    await order.save();
    await User.findByIdAndUpdate(order.user, { $inc: { pendingAmount: -order.finalAmount } });
    res.json({ success: true, message: 'Order cancelled', data: order });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// GET /api/orders/:id/invoice
router.get('/:id/invoice', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name mobile email address');
    if (!order) return res.status(404).json({ success: false, message: 'Not found' });
    const pdfBuffer = await generateInvoicePDF(order, order.user);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=invoice-${order.orderNumber}.pdf` });
    res.send(pdfBuffer);
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
