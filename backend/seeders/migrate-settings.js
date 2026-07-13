/**
 * Migration: Update Settings to Ganesh Trades Pune location
 * Plus Code: HW4C+XJ Pune, Maharashtra, India
 * Coordinates: 18.5574375, 73.9215625
 * 
 * Run with: node seeders/migrate-settings.js
 */
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const Settings = require('../models/Settings');

const migrate = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected');

    let settings = await Settings.findOne();
    
    if (!settings) {
      settings = await Settings.create({
        shopName: 'Ganesh Trades',
        shopAddress: 'HW4C+XJ Pune, Maharashtra, India',
        shopPlusCode: 'HW4C+XJ',
        shopLocation: { lat: 18.5574375, lng: 73.9215625 },
        deliveryRadiusKm: 15,
        isDeliveryRestrictionActive: true,
        deliveryFeePerKm: 0,
        freeDeliveryWithinKm: 5
      });
      console.log('✅ Created new settings with Pune coordinates');
    } else {
      const oldLat = settings.shopLocation.lat;
      const oldLng = settings.shopLocation.lng;

      settings.shopName = settings.shopName || 'Ganesh Trades';
      settings.shopAddress = 'HW4C+XJ Pune, Maharashtra, India';
      settings.shopPlusCode = 'HW4C+XJ';
      settings.shopLocation = { lat: 18.5574375, lng: 73.9215625 };
      if (settings.isDeliveryRestrictionActive === undefined) {
        settings.isDeliveryRestrictionActive = true;
      }
      if (settings.deliveryFeePerKm === undefined) {
        settings.deliveryFeePerKm = 0;
      }
      if (settings.freeDeliveryWithinKm === undefined) {
        settings.freeDeliveryWithinKm = 5;
      }

      await settings.save();
      console.log(`✅ Updated settings:`);
      console.log(`   Old coordinates: ${oldLat}, ${oldLng}`);
      console.log(`   New coordinates: 18.5574375, 73.9215625 (Pune, HW4C+XJ)`);
      console.log(`   Delivery radius: ${settings.deliveryRadiusKm} KM`);
    }

    console.log('\n📍 Ganesh Trades Location:');
    console.log(`   Plus Code: HW4C+XJ`);
    console.log(`   Lat: 18.5574375`);
    console.log(`   Lng: 73.9215625`);
    console.log(`   City: Pune, Maharashtra, India`);
    console.log(`   Delivery Radius: ${settings.deliveryRadiusKm} KM`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
};

migrate();
