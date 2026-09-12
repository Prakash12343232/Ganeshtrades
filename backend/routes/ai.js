const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getBusinessSnapshot, answerBusinessQuestion } = require('../services/aiAssistantService');
const { clientErrorMessage } = require('../utils/errors');

// Assistant endpoints are restricted to authenticated store admins and managers
router.use(protect, authorize('admin', 'manager'));

/**
 * @route   GET /api/ai/snapshot
 * @desc    Get live business analytical snapshot
 */
router.get('/snapshot', async (req, res) => {
  try {
    const snapshot = await getBusinessSnapshot();
    res.json({ success: true, data: snapshot });
  } catch (error) {
    console.error('❌ AI snapshot error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

/**
 * @route   POST /api/ai/assistant
 * @desc    Ask Ganesh AI Business Assistant an executive store question
 */
router.post('/assistant', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid question for the business assistant'
      });
    }

    const result = await answerBusinessQuestion(query.trim(), req.user);
    res.json(result);
  } catch (error) {
    console.error('❌ AI assistant error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

module.exports = router;
