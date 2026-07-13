const path = require('path');

const DEFAULT_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'price', 'stock', 'totalAmount', 'orderStatus', 'date', 'amount', 'pendingAmount', 'mobile'];

/**
 * Escape special regex characters to prevent ReDoS/injection in $regex queries.
 */
function escapeRegex(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
}

/**
 * Whitelist-based sort sanitization to prevent Mongoose sort injection.
 */
function sanitizeSort(sortParam, defaultSort = '-createdAt', allowedFields = DEFAULT_SORT_FIELDS) {
  if (!sortParam || typeof sortParam !== 'string') return defaultSort;

  const parts = sortParam.split(',').slice(0, 3);
  const sanitized = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const desc = trimmed.startsWith('-');
    const field = desc ? trimmed.slice(1) : trimmed;
    if (allowedFields.includes(field)) {
      sanitized.push(desc ? `-${field}` : field);
    }
  }

  return sanitized.length > 0 ? sanitized.join(' ') : defaultSort;
}

/**
 * Validate backup filenames to prevent path traversal attacks.
 */
function validateBackupFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename');
  }
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename: path traversal detected');
  }
  if (!/^backup_(manual|auto)_[\w-]+\.json$/.test(filename)) {
    throw new Error('Invalid backup filename format');
  }
  return filename;
}

/**
 * Resolve a backup file path safely within the backups directory.
 */
function resolveBackupPath(filename, backupDir) {
  const safeName = validateBackupFilename(filename);
  const resolved = path.resolve(backupDir, safeName);
  const resolvedDir = path.resolve(backupDir);
  if (!resolved.startsWith(resolvedDir + path.sep)) {
    throw new Error('Invalid backup file path');
  }
  return resolved;
}

/**
 * Pick only allowed fields from an object (mass-assignment protection).
 */
function pickFields(obj, allowedFields) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  for (const field of allowedFields) {
    if (obj[field] !== undefined) {
      result[field] = obj[field];
    }
  }
  return result;
}

/**
 * Validate positive integer quantity.
 */
function parsePositiveInt(value, fieldName = 'quantity') {
  const num = parseInt(value, 10);
  if (!Number.isFinite(num) || num < 1 || num > 10000) {
    throw new Error(`Invalid ${fieldName}: must be a positive integer between 1 and 10000`);
  }
  return num;
}

function parseNonNegativeInt(value, fieldName = 'quantity', max = 10000) {
  const num = parseInt(value, 10);
  if (!Number.isFinite(num) || num < 0 || num > max) {
    throw new Error(`Invalid ${fieldName}: must be an integer between 0 and ${max}`);
  }
  return num;
}

function parsePositiveNumber(value, fieldName = 'amount', max = 10000000) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > max) {
    throw new Error(`Invalid ${fieldName}: must be greater than 0 and no more than ${max}`);
  }
  return Math.round(num * 100) / 100;
}

function parseNonNegativeNumber(value, fieldName = 'amount', max = 10000000) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > max) {
    throw new Error(`Invalid ${fieldName}: must be between 0 and ${max}`);
  }
  return Math.round(num * 100) / 100;
}

function parsePagination(pageValue = 1, limitValue = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(pageValue, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(limitValue, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function safeSpreadsheetCell(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trimStart();
  if (/^[=+\-@]/.test(trimmed)) return `'${value}`;
  return value;
}

module.exports = {
  escapeRegex,
  sanitizeSort,
  validateBackupFilename,
  resolveBackupPath,
  pickFields,
  parsePositiveInt,
  parseNonNegativeInt,
  parsePositiveNumber,
  parseNonNegativeNumber,
  parsePagination,
  safeSpreadsheetCell,
  DEFAULT_SORT_FIELDS
};
