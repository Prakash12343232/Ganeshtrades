const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const { protect, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { pickFields, parsePositiveNumber, parsePagination } = require('../utils/security');

const EXPENSE_FIELDS = ['category', 'amount', 'date', 'description', 'receiptUrl'];

router.use(protect, authorize('admin', 'manager'));

// POST /api/expenses
router.post('/', async (req, res) => {
  try {
    const expenseData = pickFields(req.body, EXPENSE_FIELDS);
    expenseData.amount = parsePositiveNumber(expenseData.amount, 'amount');
    const expense = await Expense.create({
      ...expenseData,
      loggedBy: req.user._id
    });
    
    await createAuditLog(req.user._id, 'expense_create', 'expense', expense._id, { amount: expense.amount, category: expense.category }, req);
    res.status(201).json({ success: true, data: expense });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});

// GET /api/expenses
router.get('/', async (req, res) => {
  try {
    const { category, startDate, endDate, page = 1, limit = 50 } = req.query;
    const paging = parsePagination(page, limit, 100);
    const query = {};
    
    if (category) query.category = category;
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const total = await Expense.countDocuments(query);
    const expenses = await Expense.find(query)
      .populate('loggedBy', 'name')
      .sort('-date')
      .skip(paging.skip)
      .limit(paging.limit);
      
    res.json({ success: true, data: expenses, pagination: { total, page: paging.page, pages: Math.ceil(total / paging.limit) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// DELETE /api/expenses/:id
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    
    await createAuditLog(req.user._id, 'expense_delete', 'expense', req.params.id, { amount: expense.amount }, req);
    res.json({ success: true, message: 'Expense deleted' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

module.exports = router;
