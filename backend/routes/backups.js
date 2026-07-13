const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { performBackup, restoreBackup } = require('../services/backupService');
const Backup = require('../models/Backup');
const { resolveBackupPath } = require('../utils/security');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../backups');

// Protect all backup routes and restrict full database snapshots to admins
router.use(protect);
router.use(authorize('admin'));

// @desc    Get all backups
// @route   GET /api/backups
// @access  Private/Admin
router.get('/', async (req, res, next) => {
  try {
    const backups = await Backup.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: backups.length, data: backups });
  } catch (error) { next(error); }
});

// @desc    Trigger manual backup
// @route   POST /api/backups/trigger
// @access  Private/Admin
router.post('/trigger', async (req, res, next) => {
  try {
    const backup = await performBackup('manual');
    res.status(201).json({ success: true, message: 'Backup completed successfully', data: backup });
  } catch (error) { next(error); }
});

// @desc    Restore database from a backup (admin only — destructive operation)
// @route   POST /api/backups/restore/:filename
// @access  Private/Admin
router.post('/restore/:filename', async (req, res, next) => {
  try {
    await restoreBackup(req.params.filename);
    res.status(200).json({ success: true, message: 'Database restored successfully' });
  } catch (error) { next(error); }
});

// @desc    Download backup file
// @route   GET /api/backups/download/:filename
// @access  Private/Admin
router.get('/download/:filename', (req, res, next) => {
  try {
    const filepath = resolveBackupPath(req.params.filename, BACKUP_DIR);
    if (!fs.existsSync(filepath)) return res.status(404).json({ success: false, message: 'File not found' });
    res.download(filepath);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
