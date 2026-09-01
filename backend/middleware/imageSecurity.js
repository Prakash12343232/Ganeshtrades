const path = require('path');
const crypto = require('crypto');

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Check magic bytes of buffer to ensure true image format
 */
function validateMagicBytes(buffer) {
  if (!buffer || buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 &&
    buffer[2] === 0x4E && buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // WebP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return false;
}

/**
 * Sanitize filename to eliminate path traversal or malicious injection
 */
function sanitizeFilename(originalName, mimeType) {
  const extMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
  };

  const safeExt = extMap[mimeType] || '.jpg';
  const randomHash = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  
  // Clean base name, removing path traversal characters
  const cleanBase = path.basename(originalName || 'image')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .substring(0, 30);

  return `product-${timestamp}-${randomHash}-${cleanBase || 'img'}${safeExt}`;
}

/**
 * Validate image file object (from multer memoryStorage or diskStorage)
 */
function validateImageFile(file) {
  if (!file) {
    throw new Error('No file provided');
  }

  // Check file size limit
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds maximum limit of 10MB');
  }

  // Check extension
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    throw new Error(`Invalid file extension '${ext}'. Allowed: JPG, JPEG, PNG, WebP`);
  }

  // Check reported MIME type
  if (!ALLOWED_MIMES.has(file.mimetype)) {
    throw new Error(`Invalid file type '${file.mimetype}'. Allowed: image/jpeg, image/png, image/webp`);
  }

  // If buffer is available (memory storage or read from disk), validate magic bytes
  if (file.buffer) {
    const magicMime = validateMagicBytes(file.buffer);
    if (!magicMime) {
      throw new Error('File content validation failed. The uploaded file is not a valid image format.');
    }
  }

  return true;
}

module.exports = {
  validateMagicBytes,
  sanitizeFilename,
  validateImageFile,
  ALLOWED_MIMES,
  ALLOWED_EXTS
};
