const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { checkServiceability, isValidCoordinates } = require('../utils/distance');
const { parsePositiveNumber, parseNonNegativeNumber } = require('../utils/security');

// @desc    Get global settings
// @route   GET /api/settings
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.status(200).json({ success: true, data: settings });
  } catch (error) { next(error); }
});

// @desc    Update settings (Admin only)
// @route   PUT /api/settings
// @access  Private/Admin
router.put('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    
    if (req.body.shopLocation) {
      const lat = Number(req.body.shopLocation.lat);
      const lng = Number(req.body.shopLocation.lng);
      if (!isValidCoordinates(lat, lng)) {
        return res.status(400).json({ success: false, message: 'Invalid shop coordinates' });
      }
      settings.shopLocation = { lat, lng };
    }
    if (req.body.deliveryRadiusKm !== undefined) settings.deliveryRadiusKm = parsePositiveNumber(req.body.deliveryRadiusKm, 'deliveryRadiusKm', 100);
    if (req.body.shopName) settings.shopName = req.body.shopName;
    if (req.body.shopAddress) settings.shopAddress = req.body.shopAddress;
    if (req.body.shopPlusCode) settings.shopPlusCode = req.body.shopPlusCode;
    if (req.body.deliveryFeePerKm !== undefined) settings.deliveryFeePerKm = parseNonNegativeNumber(req.body.deliveryFeePerKm, 'deliveryFeePerKm', 1000);
    if (req.body.freeDeliveryWithinKm !== undefined) settings.freeDeliveryWithinKm = parseNonNegativeNumber(req.body.freeDeliveryWithinKm, 'freeDeliveryWithinKm', 100);
    if (req.body.isDeliveryRestrictionActive !== undefined) {
      settings.isDeliveryRestrictionActive = req.body.isDeliveryRestrictionActive === true || req.body.isDeliveryRestrictionActive === 'true';
    }
    
    await settings.save();
    res.status(200).json({ success: true, data: settings, message: 'Settings updated successfully' });
  } catch (error) { next(error); }
});

// @desc    Check serviceability for a location
// @route   POST /api/settings/check-serviceability
// @access  Public
router.post('/check-serviceability', async (req, res, next) => {
  try {
    const { lat, lng } = req.body;

    if (lat == null || lng == null) {
      return res.status(400).json({
        success: false,
        message: 'Please provide lat and lng coordinates.'
      });
    }

    const result = await checkServiceability(parseFloat(lat), parseFloat(lng));

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) { next(error); }
});

// @desc    Get delivery coverage stats (Admin)
// @route   GET /api/settings/coverage-stats
// @access  Private/Admin
router.get('/coverage-stats', protect, authorize('admin', 'manager'), async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    // Get all customers with coordinates
    const customers = await User.find({
      role: 'customer',
      'address.lat': { $exists: true, $ne: null },
      'address.lng': { $exists: true, $ne: null }
    }).select('name mobile address distanceFromShop customerType isActive');

    const withinRadius = customers.filter(c => c.distanceFromShop <= settings.deliveryRadiusKm);
    const outsideRadius = customers.filter(c => c.distanceFromShop > settings.deliveryRadiusKm);

    // Distance distribution
    const distanceBuckets = [
      { label: '0-2 KM', min: 0, max: 2, count: 0 },
      { label: '2-5 KM', min: 2, max: 5, count: 0 },
      { label: '5-10 KM', min: 5, max: 10, count: 0 },
      { label: '10-15 KM', min: 10, max: 15, count: 0 },
      { label: '15+ KM', min: 15, max: Infinity, count: 0 }
    ];

    customers.forEach(c => {
      const dist = c.distanceFromShop || 0;
      const bucket = distanceBuckets.find(b => dist >= b.min && dist < b.max);
      if (bucket) bucket.count++;
    });

    // Build customer markers for map
    const customerMarkers = customers.map(c => ({
      id: c._id,
      name: c.name,
      mobile: c.mobile,
      lat: c.address.lat,
      lng: c.address.lng,
      distance: c.distanceFromShop,
      customerType: c.customerType,
      isActive: c.isActive,
      withinRadius: c.distanceFromShop <= settings.deliveryRadiusKm
    }));

    res.status(200).json({
      success: true,
      data: {
        settings: {
          shopLocation: settings.shopLocation,
          deliveryRadiusKm: settings.deliveryRadiusKm,
          shopName: settings.shopName,
          shopAddress: settings.shopAddress
        },
        stats: {
          totalCustomers: customers.length,
          withinRadius: withinRadius.length,
          outsideRadius: outsideRadius.length,
          avgDistance: customers.length > 0 
            ? Math.round((customers.reduce((sum, c) => sum + (c.distanceFromShop || 0), 0) / customers.length) * 10) / 10 
            : 0
        },
        distanceBuckets,
        customerMarkers
      }
    });
  } catch (error) { next(error); }
});

module.exports = router;
