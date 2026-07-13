const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { resolveBackupPath } = require('../utils/security');
const Backup = require('../models/Backup');

const BACKUP_DIR = path.join(__dirname, '../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const performBackup = async (type = 'manual') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_${type}_${timestamp}.json`;
  const filepath = path.join(BACKUP_DIR, filename);

  const backupRecord = await Backup.create({ filename, type, status: 'pending' });

  try {
    const data = {};
    const modelNames = mongoose.modelNames();

    for (const modelName of modelNames) {
      if (modelName === 'Backup') continue; // Don't backup the backup history
      const Model = mongoose.model(modelName);
      data[modelName] = await Model.find({}).lean();
    }

    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(filepath, jsonData);
    
    const stats = fs.statSync(filepath);

    backupRecord.status = 'completed';
    backupRecord.size = stats.size;
    await backupRecord.save();

    return backupRecord;
  } catch (error) {
    backupRecord.status = 'failed';
    backupRecord.error = error.message;
    await backupRecord.save();
    console.error('Backup failed:', error);
    throw error;
  }
};

const restoreBackup = async (filename) => {
  const filepath = resolveBackupPath(filename, BACKUP_DIR);
  if (!fs.existsSync(filepath)) {
    throw new Error('Backup file not found');
  }

  try {
    const fileContent = fs.readFileSync(filepath, 'utf-8');
    const data = JSON.parse(fileContent);

    // Turn off strict mode to allow direct insertion if schemas changed
    for (const modelName of Object.keys(data)) {
      if (mongoose.modelNames().includes(modelName) && modelName !== 'Backup') {
        const Model = mongoose.model(modelName);
        await Model.deleteMany({});
        if (data[modelName].length > 0) {
          await Model.insertMany(data[modelName]);
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Restore failed:', error);
    throw error;
  }
};

module.exports = {
  performBackup,
  restoreBackup
};
