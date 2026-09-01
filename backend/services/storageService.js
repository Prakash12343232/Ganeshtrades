const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const { sanitizeFilename, validateMagicBytes } = require('../middleware/imageSecurity');

// Configure Cloudinary if env vars are present
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

/**
 * Helper to get MongoDB GridFSBucket
 */
function getGridFSBucket() {
  if (!mongoose.connection || !mongoose.connection.db) {
    throw new Error('Database connection not established for GridFS');
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'product_photos'
  });
}

/**
 * Optimize image buffer using Sharp
 * - Resizes max 1200x1200px maintaining aspect ratio
 * - Converts to WebP format (quality 82)
 */
async function optimizeImage(buffer) {
  try {
    const sharpInstance = sharp(buffer);
    const metadata = await sharpInstance.metadata();

    const pipeline = sharpInstance
      .resize({
        width: 1200,
        height: 1200,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 82 });

    const optimizedBuffer = await pipeline.toBuffer();
    const resultMeta = await sharp(optimizedBuffer).metadata();

    return {
      buffer: optimizedBuffer,
      width: resultMeta.width || metadata.width || 800,
      height: resultMeta.height || metadata.height || 800,
      format: 'webp',
      mimeType: 'image/webp',
      size: optimizedBuffer.length
    };
  } catch (err) {
    console.warn('⚠️ Sharp optimization failed, using original buffer:', err.message);
    return {
      buffer,
      width: 800,
      height: 800,
      format: 'jpeg',
      mimeType: 'image/jpeg',
      size: buffer.length
    };
  }
}

/**
 * Process & Upload Product Image
 * Choice of Cloudinary (Cloud CDN) or GridFS (Persistent MongoDB Atlas) or Local Disk
 */
async function uploadProductImage(fileBuffer, originalName = 'product.jpg') {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Empty file buffer provided for image upload');
  }

  // 1. Optimize image (resize & compress to webp)
  const optimized = await optimizeImage(fileBuffer);
  const fileName = sanitizeFilename(originalName, 'image/webp');

  // Check Cloudinary configuration first
  const hasCloudinary = process.env.CLOUDINARY_CLOUD_NAME &&
                        process.env.CLOUDINARY_API_KEY &&
                        process.env.CLOUDINARY_API_SECRET;

  if (hasCloudinary) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'ganesh_trades/products',
          format: 'webp',
          public_id: fileName.replace(/\.[^/.]+$/, "")
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            url: result.secure_url,
            public_id: result.public_id,
            storageProvider: 'cloudinary',
            width: result.width || optimized.width,
            height: result.height || optimized.height,
            mimeType: 'image/webp',
            size: result.bytes || optimized.size
          });
        }
      );
      uploadStream.end(optimized.buffer);
    });
  }

  // Fallback 1: MongoDB GridFS (Production-compatible, safe for Render/Vercel/Atlas)
  try {
    const bucket = getGridFSBucket();
    const uploadStream = bucket.openUploadStream(fileName, {
      contentType: 'image/webp',
      metadata: {
        originalName,
        width: optimized.width,
        height: optimized.height,
        uploadedAt: new Date()
      }
    });

    await new Promise((resolve, reject) => {
      uploadStream.on('error', reject);
      uploadStream.on('finish', resolve);
      uploadStream.end(optimized.buffer);
    });

    const fileId = uploadStream.id.toString();
    const mediaUrl = `/api/media/${fileId}`;

    // Also write to local uploads folder for dev convenience
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const localFilePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(localFilePath, optimized.buffer);

    return {
      url: mediaUrl,
      fileId,
      filename: fileName,
      storageProvider: 'gridfs',
      width: optimized.width,
      height: optimized.height,
      mimeType: 'image/webp',
      size: optimized.size
    };
  } catch (gridFsErr) {
    console.warn('⚠️ GridFS upload fallback to local disk:', gridFsErr.message);

    // Fallback 2: Local Filesystem
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const localFilePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(localFilePath, optimized.buffer);

    return {
      url: `/uploads/${fileName}`,
      filename: fileName,
      storageProvider: 'local',
      width: optimized.width,
      height: optimized.height,
      mimeType: 'image/webp',
      size: optimized.size
    };
  }
}

/**
 * Delete image from storage provider
 */
async function deleteProductImage(meta) {
  if (!meta) return;

  try {
    if (meta.storageProvider === 'cloudinary' && meta.public_id) {
      await cloudinary.uploader.destroy(meta.public_id);
    } else if (meta.storageProvider === 'gridfs' && meta.fileId) {
      const bucket = getGridFSBucket();
      await bucket.delete(new mongoose.Types.ObjectId(meta.fileId));
    }

    // Delete local file if present
    if (meta.url && meta.url.startsWith('/uploads/')) {
      const filename = path.basename(meta.url);
      const filePath = path.join(__dirname, '../uploads', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (err) {
    console.warn('⚠️ Delete product image notice:', err.message);
  }
}

module.exports = {
  uploadProductImage,
  deleteProductImage,
  optimizeImage
};
