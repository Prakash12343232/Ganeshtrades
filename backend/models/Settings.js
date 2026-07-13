const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  shopName: {
    type: String,
    default: 'Ganesh Trades'
  },
  shopAddress: {
    type: String,
    default: 'HW4C+XJ Pune, Maharashtra, India'
  },
  shopPlusCode: {
    type: String,
    default: 'HW4C+XJ'
  },
  shopLocation: {
    lat: { type: Number, required: true, default: 18.5574375 },  // HW4C+XJ Pune, Maharashtra
    lng: { type: Number, required: true, default: 73.9215625 }   // HW4C+XJ Pune, Maharashtra
  },
  deliveryRadiusKm: {
    type: Number,
    required: true,
    default: 15,
    min: 1,
    max: 100
  },
  deliveryFeePerKm: {
    type: Number,
    default: 0
  },
  freeDeliveryWithinKm: {
    type: Number,
    default: 5
  },
  isDeliveryRestrictionActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
