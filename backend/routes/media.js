const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// @route   GET /api/media/:fileId
// @desc    Stream product image from MongoDB GridFS
// @access  Public
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!mongoose.connection || !mongoose.connection.db) {
      return res.status(503).json({ success: false, message: 'Database connection unavailable' });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'product_photos'
    });

    let queryId;
    if (mongoose.Types.ObjectId.isValid(fileId)) {
      queryId = new mongoose.Types.ObjectId(fileId);
    } else {
      // Find by filename if not an ObjectId
      const files = await bucket.find({ filename: fileId }).toArray();
      if (!files || files.length === 0) {
        return res.status(404).json({ success: false, message: 'Image not found' });
      }
      queryId = files[0]._id;
    }

    const files = await bucket.find({ _id: queryId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    const fileDoc = files[0];
    res.set('Content-Type', fileDoc.contentType || 'image/webp');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('X-Content-Type-Options', 'nosniff');

    const downloadStream = bucket.openDownloadStream(queryId);
    downloadStream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(404).json({ success: false, message: 'Error streaming image' });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
});

module.exports = router;
