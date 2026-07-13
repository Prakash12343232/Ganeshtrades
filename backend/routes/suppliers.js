const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const SupplierPayment = require('../models/SupplierPayment');
const Product = require('../models/Product');
const { protect, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { pickFields, parsePositiveInt, parsePositiveNumber } = require('../utils/security');

const SUPPLIER_FIELDS = ['name', 'contactPerson', 'mobile', 'email', 'gstNumber', 'address', 'status'];

// All supplier routes are for admin/manager only
router.use(protect, authorize('admin', 'manager'));

// POST /api/suppliers - Create supplier
router.post('/', async (req, res) => {
  try {
    const supplierData = pickFields(req.body, SUPPLIER_FIELDS);
    const supplier = await Supplier.create(supplierData);
    await createAuditLog(req.user._id, 'supplier_create', 'supplier', supplier._id, { name: supplier.name }, req);
    res.status(201).json({ success: true, data: supplier });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// GET /api/suppliers - List suppliers
router.get('/', async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort('-createdAt');
    res.json({ success: true, data: suppliers });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// POST /api/suppliers/po - Create Purchase Order
router.post('/po', async (req, res) => {
  try {
    const { supplierId, items, expectedDelivery, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      return res.status(400).json({ success: false, message: 'Purchase order requires 1 to 100 items' });
    }
    const supplier = await Supplier.findById(supplierId);
    if (!supplier || supplier.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Active supplier not found' });
    }
    
    let totalAmount = 0;
    const poItems = [];
    for (const item of items) {
      const quantity = parsePositiveInt(item.quantity, 'quantity');
      const unitPrice = parsePositiveNumber(item.unitPrice, 'unitPrice');
      const product = await Product.findById(item.product);
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
      const total = quantity * unitPrice;
      totalAmount += total;
      poItems.push({ product: product._id, name: product.name, quantity, unitPrice, total });
    }

    const po = await PurchaseOrder.create({
      supplier: supplierId,
      items: poItems,
      totalAmount,
      expectedDelivery,
      notes,
      createdBy: req.user._id
    });

    await createAuditLog(req.user._id, 'po_create', 'purchase_order', po._id, { poNumber: po.poNumber }, req);
    res.status(201).json({ success: true, data: po });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// PUT /api/suppliers/po/:id/receive - Mark PO as received (Updates Inventory)
router.put('/po/:id/receive', async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    if (po.status === 'received') return res.status(400).json({ success: false, message: 'PO already received' });
    if (po.status === 'cancelled') return res.status(400).json({ success: false, message: 'Cancelled PO cannot be received' });

    // Update stock
    for (const item of po.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    }

    po.status = 'received';
    po.receivedAt = new Date();
    await po.save();
    
    // Update supplier balance
    await Supplier.findByIdAndUpdate(po.supplier, { $inc: { balance: po.totalAmount } });

    await createAuditLog(req.user._id, 'po_receive', 'purchase_order', po._id, { poNumber: po.poNumber }, req);
    res.json({ success: true, data: po });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// GET /api/suppliers/po - List POs
router.get('/po', async (req, res) => {
  try {
    const pos = await PurchaseOrder.find().populate('supplier', 'name').sort('-createdAt');
    res.json({ success: true, data: pos });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// POST /api/suppliers/payment - Record payment to supplier
router.post('/payment', async (req, res) => {
  try {
    const { supplierId, paymentMethod, referenceNumber, notes, purchaseOrderId } = req.body;
    const amount = parsePositiveNumber(req.body.amount, 'amount');
    const supplier = await Supplier.findById(supplierId);
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    if (amount > supplier.balance) {
      return res.status(400).json({ success: false, message: 'Payment exceeds supplier balance' });
    }

    const payment = await SupplierPayment.create({
      supplier: supplierId,
      purchaseOrder: purchaseOrderId,
      amount,
      paymentMethod,
      referenceNumber,
      notes,
      processedBy: req.user._id
    });

    supplier.balance = Math.max(0, supplier.balance - amount);
    await supplier.save();

    await createAuditLog(req.user._id, 'supplier_payment', 'supplier_payment', payment._id, { amount }, req);
    res.status(201).json({ success: true, data: payment });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

module.exports = router;
