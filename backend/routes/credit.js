const express = require('express');
const router = express.Router();
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');
const logAction = require('../utils/auditLogger');

// Get all customers with their credit balances
router.get('/balances', protect, restrictTo('admin', 'manager'), async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' })
      .select('name mobile customerType creditLimit creditBalance')
      .sort('-creditBalance');
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get khata ledger for a specific customer
router.get('/ledger/:userId', protect, async (req, res) => {
  try {
    // Customers can only see their own ledger
    if (req.user.role === 'customer' && req.user.id !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this ledger' });
    }

    const transactions = await CreditTransaction.find({ user: req.params.userId })
      .populate('referenceId', 'orderNumber totalAmount')
      .populate('recordedBy', 'name')
      .sort('-createdAt');

    const customer = await User.findById(req.params.userId).select('name creditBalance creditLimit');
    
    res.json({ success: true, customer, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Record a manual settlement (payment received)
router.post('/settle', protect, restrictTo('admin', 'manager'), async (req, res) => {
  try {
    const { userId, amount, notes } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const customer = await User.findById(userId);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Deduct from credit balance
    customer.creditBalance -= Number(amount);
    if (customer.creditBalance < 0) customer.creditBalance = 0; // Prevent negative khata
    await customer.save();

    // Create transaction
    const transaction = await CreditTransaction.create({
      user: userId,
      amount,
      type: 'payment',
      referenceType: 'manual_settlement',
      balanceAfter: customer.creditBalance,
      notes,
      recordedBy: req.user.id
    });

    await logAction(req.user.id, 'RECORD_SETTLEMENT', 'Credit', transaction._id, `Settlement of ₹${amount} for ${customer.name}`);

    res.json({ success: true, data: transaction, balance: customer.creditBalance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update customer credit limit
router.put('/limit/:userId', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { creditLimit } = req.body;
    const user = await User.findByIdAndUpdate(req.params.userId, { creditLimit }, { new: true });
    
    await logAction(req.user.id, 'UPDATE_CREDIT_LIMIT', 'User', user._id, `Updated credit limit for ${user.name} to ₹${creditLimit}`);
    
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
