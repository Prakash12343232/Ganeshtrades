const Settings = require('../models/Settings');

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 * @param {number} lat1 Latitude of point 1 (decimal degrees)
 * @param {number} lon1 Longitude of point 1 (decimal degrees)
 * @param {number} lat2 Latitude of point 2 (decimal degrees)
 * @param {number} lon2 Longitude of point 2 (decimal degrees)
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Converts degrees to radians
 */
function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Validates if latitude and longitude values are valid geographic coordinates.
 * @param {number} lat Latitude (-90 to 90)
 * @param {number} lng Longitude (-180 to 180)
 * @returns {boolean}
 */
function isValidCoordinates(lat, lng) {
  return (
    typeof lat === 'number' && !isNaN(lat) &&
    typeof lng === 'number' && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/**
 * Checks whether a given set of coordinates falls within the delivery service area.
 * Returns an object with serviceability status, distance, and radius info.
 * @param {number} customerLat Customer latitude
 * @param {number} customerLng Customer longitude
 * @returns {Promise<{serviceable: boolean, distance: number, radius: number, shopLocation: object, message: string}>}
 */
async function checkServiceability(customerLat, customerLng) {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});

  if (!isValidCoordinates(customerLat, customerLng)) {
    return {
      serviceable: false,
      distance: 0,
      radius: settings.deliveryRadiusKm,
      shopLocation: settings.shopLocation,
      message: 'Invalid coordinates provided. Please enable location access.'
    };
  }

  const distance = calculateDistance(
    settings.shopLocation.lat, settings.shopLocation.lng,
    customerLat, customerLng
  );

  const roundedDistance = Math.round(distance * 10) / 10; // Round to 1 decimal

  // If delivery restriction is disabled, always allow
  if (!settings.isDeliveryRestrictionActive) {
    return {
      serviceable: true,
      distance: roundedDistance,
      radius: settings.deliveryRadiusKm,
      shopLocation: settings.shopLocation,
      message: `You are ${roundedDistance} KM from Ganesh Trades. Delivery restriction is currently disabled.`
    };
  }

  if (roundedDistance > settings.deliveryRadiusKm) {
    return {
      serviceable: false,
      distance: roundedDistance,
      radius: settings.deliveryRadiusKm,
      shopLocation: settings.shopLocation,
      message: `Sorry, Ganesh Trades currently delivers only within ${settings.deliveryRadiusKm} KM of our shop location. You are ${roundedDistance} KM away.`
    };
  }

  return {
    serviceable: true,
    distance: roundedDistance,
    radius: settings.deliveryRadiusKm,
    shopLocation: settings.shopLocation,
    message: `You are ${roundedDistance} KM from Ganesh Trades. Delivery available!`
  };
}

module.exports = { calculateDistance, isValidCoordinates, checkServiceability };
