const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const { protect, restrictTo } = require('../middleware/auth');
const logAction = require('../utils/auditLogger');

router.use(protect, restrictTo('admin', 'manager'));

// Get all expenses
router.get('/', async (req, res) => {
  try {
    const expenses = await Expense.find()
      .populate('recordedBy', 'name')
      .sort('-date');
    res.json({ success: true, data: expenses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Record new expense
router.post('/', async (req, res) => {
  try {
    req.body.recordedBy = req.user.id;
    const expense = await Expense.create(req.body);
    await logAction(req.user.id, 'RECORD_EXPENSE', 'Expense', expense._id, `Recorded ₹${expense.amount} for ${expense.category}`);
    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
