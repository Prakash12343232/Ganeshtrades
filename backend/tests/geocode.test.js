jest.mock('axios');

const axios = require('axios');
const {
  reverseGeocode,
  forwardGeocode,
  isValidLatLng,
  isInsideIndia
} = require('../utils/geocode');

const googleResult = {
  geometry: { location: { lat: 18.5574, lng: 73.9215 } },
  address_components: [
    { long_name: '12', short_name: '12', types: ['street_number'] },
    { long_name: 'Market Road', short_name: 'Market Rd', types: ['route'] },
    { long_name: 'Kothrud', short_name: 'Kothrud', types: ['sublocality_level_1'] },
    { long_name: 'Pune', short_name: 'Pune', types: ['locality'] },
    { long_name: 'Maharashtra', short_name: 'MH', types: ['administrative_area_level_1'] },
    { long_name: '411038', short_name: '411038', types: ['postal_code'] }
  ],
  formatted_address: '12 Market Road, Kothrud, Pune, Maharashtra 411038, India'
};

const nominatimResult = {
  lat: '18.5574',
  lon: '73.9215',
  display_name: '12, Market Road, Kothrud, Pune, Maharashtra, 411038, India',
  address: {
    house_number: '12',
    road: 'Market Road',
    suburb: 'Kothrud',
    city: 'Pune',
    state: 'Maharashtra',
    postcode: '411038'
  }
};

describe('geocode utils', () => {
  const originalMapsKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  afterAll(() => {
    if (originalMapsKey === undefined) {
      delete process.env.GOOGLE_MAPS_API_KEY;
    } else {
      process.env.GOOGLE_MAPS_API_KEY = originalMapsKey;
    }
  });

  it('validates coordinates and the India bounding box', () => {
    expect(isValidLatLng(18.5, 73.9)).toBe(true);
    expect(isValidLatLng('18.5', '73.9')).toBe(false);
    expect(isValidLatLng(91, 73.9)).toBe(false);
    expect(isInsideIndia(18.5, 73.9)).toBe(true);
    expect(isInsideIndia(40.7, -74)).toBe(false);
  });

  it('uses Google first for reverse geocoding when a maps key is configured', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';
    axios.get.mockResolvedValueOnce({ data: { status: 'OK', results: [googleResult] } });

    const result = await reverseGeocode(18.5574, 73.9215);

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toContain('maps.googleapis.com');
    expect(result.provider).toBe('google');
    expect(result.city).toBe('Pune');
    expect(result.state).toBe('Maharashtra');
    expect(result.pincode).toBe('411038');
  });

  it('falls back to Nominatim for reverse geocoding without a maps key', async () => {
    axios.get.mockResolvedValueOnce({ data: nominatimResult });

    const result = await reverseGeocode(18.5574, 73.9215);

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toContain('nominatim.openstreetmap.org/reverse');
    expect(result.provider).toBe('nominatim');
    expect(result.area).toBe('Kothrud');
    expect(result.city).toBe('Pune');
  });

  it('uses the Google forward-geocode result for a manual address', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';
    axios.get.mockResolvedValueOnce({ data: { status: 'OK', results: [googleResult] } });

    const result = await forwardGeocode({
      street: '12 Market Road',
      area: 'Kothrud',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411038'
    });

    expect(result.provider).toBe('google');
    expect(result.lat).toBeCloseTo(18.5574, 3);
    expect(result.lng).toBeCloseTo(73.9215, 3);
  });

  it('falls back to Nominatim forward geocoding when Google has no result', async () => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-maps-key';
    axios.get
      .mockResolvedValueOnce({ data: { status: 'ZERO_RESULTS', results: [] } })
      .mockResolvedValueOnce({ data: [nominatimResult] });

    const result = await forwardGeocode({ city: 'Pune', pincode: '411038' });

    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(result.provider).toBe('nominatim');
  });

  it('rejects invalid coordinates and empty addresses', async () => {
    await expect(reverseGeocode('bad', 73.9)).rejects.toMatchObject({ statusCode: 400 });
    await expect(forwardGeocode({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns a sanitized error when no provider can resolve the address', async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    await expect(forwardGeocode({ city: 'Unknown' })).rejects.toMatchObject({
      statusCode: 502,
      exposed: true
    });
  });
});
