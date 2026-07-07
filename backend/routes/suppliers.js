const express = require('express');
const router = express.Router();
const Supplier = require('../models/Supplier');
const { protect, restrictTo } = require('../middleware/auth');
const logAction = require('../utils/auditLogger');

// All supplier routes restricted to admin/manager
router.use(protect, restrictTo('admin', 'manager'));

// Get all suppliers
router.get('/', async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort('name');
    res.json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create supplier
router.post('/', async (req, res) => {
  try {
    const supplier = await Supplier.create(req.body);
    await logAction(req.user.id, 'CREATE_SUPPLIER', 'Supplier', supplier._id);
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update supplier
router.put('/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    
    await logAction(req.user.id, 'UPDATE_SUPPLIER', 'Supplier', supplier._id);
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete supplier (or just deactivate)
router.delete('/:id', restrictTo('admin'), async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });
    
    await logAction(req.user.id, 'DEACTIVATE_SUPPLIER', 'Supplier', supplier._id);
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
