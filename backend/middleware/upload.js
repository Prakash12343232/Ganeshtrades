const multer = require('multer');
const path = require('path');
const { ALLOWED_MIMES, ALLOWED_EXTS } = require('./imageSecurity');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const extValid = ALLOWED_EXTS.has(ext);
  const mimeValid = ALLOWED_MIMES.has(file.mimetype);

  if (extValid && mimeValid) {
    return cb(null, true);
  }
  cb(new Error(`Only image files (JPG, JPEG, PNG, WebP) are allowed. Received: ${ext || file.mimetype}`));
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter
});

module.exports = upload;
