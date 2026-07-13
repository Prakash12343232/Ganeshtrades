const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const PurchaseOrder = require('../models/PurchaseOrder');
const { protect, authorize } = require('../middleware/auth');
const { safeSpreadsheetCell } = require('../utils/security');

// GET /api/reports/sales
router.get('/sales', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { period = 'daily', startDate, endDate } = req.query;
    let start, end = new Date();

    if (startDate && endDate) { start = new Date(startDate); end = new Date(endDate); }
    else if (period === 'daily') { start = new Date(); start.setHours(0, 0, 0, 0); }
    else if (period === 'weekly') { start = new Date(); start.setDate(start.getDate() - 7); }
    else { start = new Date(); start.setMonth(start.getMonth() - 1); }

    const orders = await Order.find({ createdAt: { $gte: start, $lte: end }, orderStatus: { $ne: 'cancelled' } })
      .populate('user', 'name mobile customerType');

    const totalRevenue = orders.reduce((sum, o) => sum + o.finalAmount, 0);
    const totalOrders = orders.length;

    res.json({ success: true, data: { orders, totalRevenue, totalOrders, period, start, end } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /api/reports/profit-loss
router.get('/profit-loss', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let start = new Date(startDate || new Date(new Date().setMonth(new Date().getMonth() - 1)));
    let end = new Date(endDate || new Date());

    // 1. Revenue from completed orders
    const orders = await Order.find({ createdAt: { $gte: start, $lte: end }, orderStatus: 'delivered' });
    const revenue = orders.reduce((sum, o) => sum + o.finalAmount, 0);

    // 2. Expenses
    const expenses = await Expense.find({ date: { $gte: start, $lte: end } });
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // 3. Cost of Goods Sold (approximated from Purchase Orders)
    const pos = await PurchaseOrder.find({ createdAt: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } });
    const costOfGoods = pos.reduce((sum, po) => sum + po.totalAmount, 0);

    const netProfit = revenue - totalExpenses - costOfGoods;

    res.json({ success: true, data: { revenue, totalExpenses, costOfGoods, netProfit, start, end } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /api/reports/export/orders
router.get('/export/orders', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const orders = await Order.find().populate('user', 'name mobile customerType').sort('-createdAt').limit(500);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Orders');

    sheet.columns = [
      { header: 'Order #', key: 'orderNumber', width: 18 },
      { header: 'Customer', key: 'customer', width: 20 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'Type', key: 'type', width: 12 },
      { header: 'Amount', key: 'amount', width: 12 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Payment', key: 'payment', width: 12 },
      { header: 'Date', key: 'date', width: 18 }
    ];

    orders.forEach(o => {
      sheet.addRow({
        orderNumber: safeSpreadsheetCell(o.orderNumber), customer: safeSpreadsheetCell(o.user?.name), mobile: safeSpreadsheetCell(o.user?.mobile),
        type: safeSpreadsheetCell(o.user?.customerType), amount: o.finalAmount, status: safeSpreadsheetCell(o.orderStatus),
        payment: o.paymentStatus, date: new Date(o.createdAt).toLocaleDateString('en-IN')
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=orders-report.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// GET /api/reports/export/products
router.get('/export/products', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const products = await Product.find({ status: { $ne: 'inactive' } }).sort('name');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Products');

    sheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Price', key: 'price', width: 10 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Min Stock', key: 'minStock', width: 10 },
      { header: 'Total Sold', key: 'totalSold', width: 12 },
      { header: 'Status', key: 'status', width: 12 }
    ];

    products.forEach(p => sheet.addRow({
      name: safeSpreadsheetCell(p.name),
      category: safeSpreadsheetCell(p.category),
      price: p.price,
      stock: p.stock,
      minStock: p.minStock,
      totalSold: p.totalSold,
      status: safeSpreadsheetCell(p.status)
    }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=products-report.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
