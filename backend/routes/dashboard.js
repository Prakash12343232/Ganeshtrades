const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const { protect, authorize } = require('../middleware/auth');

// GET /api/dashboard/stats
router.get('/stats', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });
    const deliveredOrders = await Order.countDocuments({ orderStatus: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ orderStatus: 'cancelled' });
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalProducts = await Product.countDocuments({ status: { $ne: 'inactive' } });
    const lowStockProducts = await Product.countDocuments({ $expr: { $lte: ['$stock', '$minStock'] }, status: { $ne: 'inactive' } });

    const revenueAgg = await Order.aggregate([
      { $match: { orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    const pendingPayments = await User.aggregate([
      { $match: { pendingAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$pendingAmount' } } }
    ]);
    const totalPending = pendingPayments[0]?.total || 0;

    // Recent orders
    const recentOrders = await Order.find().populate('user', 'name mobile').sort('-createdAt').limit(10);

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await Order.countDocuments({ createdAt: { $gte: today } });
    const todayRevenue = await Order.aggregate([
      { $match: { createdAt: { $gte: today }, orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
    ]);

    res.json({
      success: true,
      data: {
        totalOrders, pendingOrders, deliveredOrders, cancelledOrders,
        totalRevenue, totalPending, totalCustomers, totalProducts, lowStockProducts,
        todayOrders, todayRevenue: todayRevenue[0]?.total || 0,
        recentOrders
      }
    });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /api/dashboard/chart-data
router.get('/chart-data', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const dayOrders = await Order.countDocuments({ createdAt: { $gte: date, $lt: nextDay } });
      const dayRevenue = await Order.aggregate([
        { $match: { createdAt: { $gte: date, $lt: nextDay }, orderStatus: { $ne: 'cancelled' } } },
        { $group: { _id: null, total: { $sum: '$finalAmount' } } }
      ]);

      last7Days.push({
        date: date.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }),
        orders: dayOrders,
        revenue: dayRevenue[0]?.total || 0
      });
    }

    const customerTypes = await User.aggregate([
      { $match: { role: 'customer' } },
      { $group: { _id: '$customerType', count: { $sum: 1 } } }
    ]);

    const topProducts = await Product.find({ status: 'active' }).sort('-totalSold').limit(5).select('name totalSold price');

    res.json({ success: true, data: { last7Days, customerTypes, topProducts } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
