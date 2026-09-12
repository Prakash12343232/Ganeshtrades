const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, authorize } = require('../middleware/auth');
const {
  parseSpreadsheetBuffer,
  previewProducts,
  commitProducts,
  previewCustomers,
  commitCustomers,
  previewInventory,
  commitInventory,
  generateTemplate
} = require('../services/bulkImportService');
const { clientErrorMessage } = require('../utils/errors');

// Memory storage for spreadsheet uploads (max 10MB)
const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      return cb(null, true);
    }
    cb(new Error('Only Excel (.xlsx, .xls) and CSV (.csv) files are allowed for import.'));
  }
});

// All import routes are protected for store management (admin & manager)
router.use(protect, authorize('admin', 'manager'));

/**
 * @route   GET /api/import/template/:type
 * @desc    Download Excel or CSV starter template
 */
router.get('/template/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const format = req.query.format === 'csv' ? 'csv' : 'xlsx';

    if (!['products', 'customers', 'inventory'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid template type' });
    }

    const buffer = await generateTemplate(type, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=ganesh_trades_${type}_template.csv`);
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=ganesh_trades_${type}_template.xlsx`);
    }

    res.send(buffer);
  } catch (error) {
    console.error('❌ Template generation error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

/**
 * @route   POST /api/import/products/preview
 * @desc    Parse spreadsheet & return preview with validation & duplicate detection
 */
router.post('/products/preview', uploadDoc.single('file'), async (req, res) => {
  try {
    let rows = [];
    const mapping = req.body.mapping ? (typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping) : {};

    if (req.file) {
      rows = await parseSpreadsheetBuffer(req.file.buffer, req.file.originalname);
    } else if (req.body.rows && Array.isArray(req.body.rows)) {
      rows = req.body.rows;
    } else {
      return res.status(400).json({ success: false, message: 'Please upload an Excel/CSV file or provide rows array' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'The spreadsheet contains no data rows' });
    }

    if (rows.length > 5000) {
      return res.status(400).json({ success: false, message: 'Batch limit is 5,000 items per import. Please split larger sheets.' });
    }

    const previewResult = await previewProducts(rows, mapping);
    res.json({ success: true, ...previewResult });
  } catch (error) {
    console.error('❌ Products preview error:', error);
    res.status(400).json({ success: false, message: clientErrorMessage(error) });
  }
});

/**
 * @route   POST /api/import/products/commit
 * @desc    Execute product import
 */
router.post('/products/commit', async (req, res) => {
  try {
    const { items, duplicateAction = 'skip' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided for import' });
    }

    const result = await commitProducts(items, {
      duplicateAction,
      userId: req.user._id,
      req
    });

    res.json(result);
  } catch (error) {
    console.error('❌ Products commit error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

/**
 * @route   POST /api/import/customers/preview
 * @desc    Preview customer bulk import
 */
router.post('/customers/preview', uploadDoc.single('file'), async (req, res) => {
  try {
    let rows = [];
    const mapping = req.body.mapping ? (typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping) : {};

    if (req.file) {
      rows = await parseSpreadsheetBuffer(req.file.buffer, req.file.originalname);
    } else if (req.body.rows && Array.isArray(req.body.rows)) {
      rows = req.body.rows;
    } else {
      return res.status(400).json({ success: false, message: 'Please upload an Excel/CSV file or provide rows array' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'The spreadsheet contains no data rows' });
    }

    const previewResult = await previewCustomers(rows, mapping);
    res.json({ success: true, ...previewResult });
  } catch (error) {
    console.error('❌ Customers preview error:', error);
    res.status(400).json({ success: false, message: clientErrorMessage(error) });
  }
});

/**
 * @route   POST /api/import/customers/commit
 * @desc    Execute customer bulk import
 */
router.post('/customers/commit', async (req, res) => {
  try {
    const { items, duplicateAction = 'skip' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided for import' });
    }

    const result = await commitCustomers(items, {
      duplicateAction,
      userId: req.user._id,
      req
    });

    res.json(result);
  } catch (error) {
    console.error('❌ Customers commit error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

/**
 * @route   POST /api/import/inventory/preview
 * @desc    Preview inventory stock updates
 */
router.post('/inventory/preview', uploadDoc.single('file'), async (req, res) => {
  try {
    let rows = [];
    const mapping = req.body.mapping ? (typeof req.body.mapping === 'string' ? JSON.parse(req.body.mapping) : req.body.mapping) : {};

    if (req.file) {
      rows = await parseSpreadsheetBuffer(req.file.buffer, req.file.originalname);
    } else if (req.body.rows && Array.isArray(req.body.rows)) {
      rows = req.body.rows;
    } else {
      return res.status(400).json({ success: false, message: 'Please upload an Excel/CSV file or provide rows array' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'The spreadsheet contains no data rows' });
    }

    const previewResult = await previewInventory(rows, mapping);
    res.json({ success: true, ...previewResult });
  } catch (error) {
    console.error('❌ Inventory preview error:', error);
    res.status(400).json({ success: false, message: clientErrorMessage(error) });
  }
});

/**
 * @route   POST /api/import/inventory/commit
 * @desc    Execute inventory stock updates
 */
router.post('/inventory/commit', async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items provided for stock update' });
    }

    const result = await commitInventory(items, {
      userId: req.user._id,
      req
    });

    res.json(result);
  } catch (error) {
    console.error('❌ Inventory commit error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

module.exports = router;
