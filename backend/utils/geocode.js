const axios = require('axios');

const REQUEST_TIMEOUT_MS = 8000;
const NOMINATIM_USER_AGENT = 'GaneshTrades/1.0 (https://ganeshtrades.vercel.app)';
const INDIA_BOUNDS = { minLat: 6, maxLat: 38, minLng: 68, maxLng: 98 };

function isValidLatLng(lat, lng) {
  return (
    typeof lat === 'number' && Number.isFinite(lat) &&
    typeof lng === 'number' && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

function isInsideIndia(lat, lng) {
  return (
    lat >= INDIA_BOUNDS.minLat && lat <= INDIA_BOUNDS.maxLat &&
    lng >= INDIA_BOUNDS.minLng && lng <= INDIA_BOUNDS.maxLng
  );
}

function geocodeError(message = 'Address lookup is temporarily unavailable. Please use Detect My Location or try again.', statusCode = 502) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.exposed = true;
  return err;
}

function clean(value, max = 160) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
}

function roundCoord(value) {
  return Math.round(Number(value) * 1e6) / 1e6;
}

function pickGoogleComponent(components, preferredTypes) {
  for (const type of preferredTypes) {
    const match = components.find((component) => Array.isArray(component.types) && component.types.includes(type));
    if (match) return clean(match.long_name || match.short_name);
  }
  return '';
}

function normalizeGoogleResult(result) {
  if (!result || !result.geometry || !result.geometry.location) return null;
  const lat = Number(result.geometry.location.lat);
  const lng = Number(result.geometry.location.lng);
  if (!isValidLatLng(lat, lng) || !isInsideIndia(lat, lng)) return null;

  const components = Array.isArray(result.address_components) ? result.address_components : [];
  const streetNumber = pickGoogleComponent(components, ['street_number']);
  const route = pickGoogleComponent(components, ['route']);
  const street = [streetNumber, route].filter(Boolean).join(' ');

  return {
    street: clean(street),
    area: clean(pickGoogleComponent(components, ['sublocality_level_1', 'sublocality', 'neighborhood', 'premise'])),
    city: clean(pickGoogleComponent(components, ['locality', 'administrative_area_level_2', 'postal_town'])),
    state: clean(pickGoogleComponent(components, ['administrative_area_level_1'])),
    pincode: clean(pickGoogleComponent(components, ['postal_code']), 10),
    lat: roundCoord(lat),
    lng: roundCoord(lng),
    displayName: clean(result.formatted_address, 500),
    provider: 'google'
  };
}

function normalizeNominatimResult(result) {
  if (!result) return null;
  const lat = Number(result.lat);
  const lng = Number(result.lon);
  if (!isValidLatLng(lat, lng) || !isInsideIndia(lat, lng)) return null;

  const address = result.address && typeof result.address === 'object' ? result.address : {};
  const street = [clean(address.house_number, 32), clean(address.road)].filter(Boolean).join(' ');
  const area = clean(
    address.suburb || address.neighbourhood || address.quarter ||
    address.city_district || address.hamlet || address.village || ''
  );
  const city = clean(
    address.city || address.town || address.municipality ||
    address.village || address.county || ''
  );

  return {
    street: clean(street),
    area,
    city,
    state: clean(address.state || address.state_district || ''),
    pincode: clean(address.postcode, 10),
    lat: roundCoord(lat),
    lng: roundCoord(lng),
    displayName: clean(result.display_name, 500),
    provider: 'nominatim'
  };
}

async function googleRequest(params) {
  const apiKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
  if (!apiKey) return null;

  try {
    const { data } = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: { ...params, key: apiKey, region: 'in', language: 'en' },
      timeout: REQUEST_TIMEOUT_MS
    });
    if (!data || data.status !== 'OK' || !Array.isArray(data.results) || !data.results.length) return null;
    return normalizeGoogleResult(data.results[0]);
  } catch {
    return null;
  }
}

async function nominatimRequest(path, params) {
  try {
    const { data } = await axios.get(`https://nominatim.openstreetmap.org${path}`, {
      params,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        'Accept-Language': 'en'
      }
    });
    return data;
  } catch {
    return null;
  }
}

async function reverseGeocode(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!isValidLatLng(latitude, longitude)) {
    throw geocodeError('Invalid coordinates provided.', 400);
  }

  const fromGoogle = await googleRequest({ latlng: `${latitude},${longitude}` });
  if (fromGoogle) return fromGoogle;

  const data = await nominatimRequest('/reverse', {
    format: 'jsonv2',
    lat: latitude,
    lon: longitude,
    zoom: 18,
    addressdetails: 1
  });
  const fromNominatim = normalizeNominatimResult(data);
  if (fromNominatim) return fromNominatim;

  throw geocodeError('We could not find an address for this location. Please enter your address manually.');
}

async function forwardGeocode(address = {}) {
  const query = [
    clean(address.street),
    clean(address.area),
    clean(address.city),
    clean(address.state),
    clean(address.pincode, 10)
  ].filter(Boolean).join(', ');

  if (!query) {
    throw geocodeError('Please provide an address to look up.', 400);
  }

  const fromGoogle = await googleRequest({
    address: `${query}, India`,
    components: 'country:IN'
  });
  if (fromGoogle) return fromGoogle;

  const data = await nominatimRequest('/search', {
    format: 'jsonv2',
    q: `${query}, India`,
    addressdetails: 1,
    countrycodes: 'in',
    limit: 1
  });
  const fromNominatim = Array.isArray(data) ? normalizeNominatimResult(data[0]) : null;
  if (fromNominatim) return fromNominatim;

  throw geocodeError('We could not verify this address. Please check the details or use Detect My Location.');
}

module.exports = {
  reverseGeocode,
  forwardGeocode,
  isValidLatLng,
  isInsideIndia,
  normalizeGoogleResult,
  normalizeNominatimResult
};
