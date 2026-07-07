const express = require('express');
const router = express.Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const { protect, restrictTo } = require('../middleware/auth');
const logAction = require('../utils/auditLogger');

router.use(protect, restrictTo('admin', 'manager'));

// Get all POs
router.get('/', async (req, res) => {
  try {
    const pos = await PurchaseOrder.find()
      .populate('supplier', 'name')
      .populate('recordedBy', 'name')
      .sort('-createdAt');
    res.json({ success: true, data: pos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create PO
router.post('/', async (req, res) => {
  try {
    req.body.recordedBy = req.user.id;
    
    // Calculate totals
    let totalAmount = 0;
    for (let item of req.body.items) {
      item.total = item.quantity * item.purchasePrice;
      totalAmount += item.total;
    }
    req.body.totalAmount = totalAmount;

    const po = await PurchaseOrder.create(req.body);
    await logAction(req.user.id, 'CREATE_PO', 'PurchaseOrder', po._id);
    
    res.status(201).json({ success: true, data: po });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Receive PO & Update Inventory
router.put('/:id/receive', async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    if (po.status === 'received') return res.status(400).json({ success: false, message: 'PO already received' });

    // Update product stock and purchase price
    for (let item of po.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
        purchasePrice: item.purchasePrice // Update to latest purchase price
      });
    }

    // Update supplier balance
    await Supplier.findByIdAndUpdate(po.supplier, {
      $inc: { balance: po.totalAmount }
    });

    po.status = 'received';
    po.receivedDate = Date.now();
    await po.save();

    await logAction(req.user.id, 'RECEIVE_PO', 'PurchaseOrder', po._id);
    res.json({ success: true, data: po });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
