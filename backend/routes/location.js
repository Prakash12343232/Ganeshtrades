const express = require('express');
const rateLimit = require('express-rate-limit');
const { reverseGeocode, forwardGeocode } = require('../utils/geocode');
const { clientErrorMessage } = require('../utils/errors');

const router = express.Router();

const locationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, trustProxy: false },
  message: { success: false, message: 'Too many location lookup requests. Please try again later.' }
});

// @route   POST /api/location/reverse-geocode
// @desc    Convert consented GPS coordinates into an editable address
// @access  Public (rate limited; no precise location is persisted)
router.post('/reverse-geocode', locationLimiter, async (req, res) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);

    if (req.body?.lat == null || req.body?.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required.' });
    }

    const address = await reverseGeocode(lat, lng);
    return res.json({ success: true, data: address });
  } catch (error) {
    const statusCode = error.statusCode || 502;
    return res.status(statusCode).json({
      success: false,
      message: error.exposed ? error.message : clientErrorMessage(error, 'Address lookup failed. Please enter your address manually.')
    });
  }
});

// @route   POST /api/location/geocode
// @desc    Convert a manually entered address into coordinates for delivery checks
// @access  Public (rate limited)
router.post('/geocode', locationLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const hasAnyAddressField = ['street', 'area', 'city', 'state', 'pincode']
      .some((field) => typeof body[field] === 'string' && body[field].trim());

    if (!hasAnyAddressField) {
      return res.status(400).json({ success: false, message: 'Please enter at least part of your address.' });
    }

    const address = await forwardGeocode(body);
    return res.json({ success: true, data: address });
  } catch (error) {
    const statusCode = error.statusCode || 502;
    return res.status(statusCode).json({
      success: false,
      message: error.exposed ? error.message : clientErrorMessage(error, 'Address lookup failed. Please use Detect My Location.')
    });
  }
});

module.exports = router;
