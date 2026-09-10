const crypto = require('crypto');
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
    const err = new Error('Invalid filename');
    err.exposed = true;
    throw err;
  }
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    const err = new Error('Invalid filename: path traversal detected');
    err.exposed = true;
    throw err;
  }
  if (!/^backup_(manual|auto|daily|weekly|monthly)_[\w-]+\.json$/.test(filename)) {
    const err = new Error('Invalid backup filename format');
    err.exposed = true;
    throw err;
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
    const err = new Error('Invalid backup file path');
    err.exposed = true;
    throw err;
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
    const err = new Error(`Invalid ${fieldName}: must be a positive integer between 1 and 10000`);
    err.exposed = true;
    throw err;
  }
  return num;
}

function parseNonNegativeInt(value, fieldName = 'quantity', max = 10000) {
  const num = parseInt(value, 10);
  if (!Number.isFinite(num) || num < 0 || num > max) {
    const err = new Error(`Invalid ${fieldName}: must be an integer between 0 and ${max}`);
    err.exposed = true;
    throw err;
  }
  return num;
}

function parsePositiveNumber(value, fieldName = 'amount', max = 10000000) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0 || num > max) {
    const err = new Error(`Invalid ${fieldName}: must be greater than 0 and no more than ${max}`);
    err.exposed = true;
    throw err;
  }
  return Math.round(num * 100) / 100;
}

function parseNonNegativeNumber(value, fieldName = 'amount', max = 10000000) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > max) {
    const err = new Error(`Invalid ${fieldName}: must be between 0 and ${max}`);
    err.exposed = true;
    throw err;
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

/**
 * Normalizes an Indian mobile number to a standard 10-digit format.
 * Strips out +91, 0 prefixes, spaces, and dashes.
 */
function normalizeMobile(mobile) {
  if (!mobile) return null;
  let cleaned = String(mobile).trim().replace(/\D/g, ''); // Remove all non-digits
  
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.length === 13 && cleaned.startsWith('910')) {
    cleaned = cleaned.substring(3);
  }
  
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }
  return null; // Invalid Indian mobile number
}

/**
 * Generates a random 6-digit numeric OTP
 */
function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash an OTP for at-rest storage with a per-record random salt.
 * Returns { salt, hash } — the plaintext is never persisted.
 */
function hashOTP(otp) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
  return { salt, hash };
}

/**
 * Constant-time OTP verification against a salted SHA-256 record.
 * Returns false for malformed input so plaintext legacy/foreign records fail closed.
 */
function verifyOTP(otp, storedHash, storedSalt) {
  if (typeof otp !== 'string' || typeof storedHash !== 'string' || typeof storedSalt !== 'string') return false;
  const computed = crypto.createHash('sha256').update(`${storedSalt}:${otp}`).digest('hex');
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Validates password strength.
 * Returns { valid: boolean, errors: string[], strength: 'weak'|'medium'|'strong' }
 */
function validatePasswordStrength(password) {
  const errors = [];
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'], strength: 'weak' };
  }
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least one number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) errors.push('At least one special character');

  let strength = 'weak';
  const passed = 5 - errors.length;
  if (passed >= 5) strength = 'strong';
  else if (passed >= 3) strength = 'medium';

  return { valid: errors.length === 0, errors, strength };
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
  normalizeMobile,
  generateOTP,
  hashOTP,
  verifyOTP,
  validatePasswordStrength,
  DEFAULT_SORT_FIELDS
};
