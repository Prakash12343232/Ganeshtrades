const request = require('supertest');
const Otp = require('../models/Otp');

// Simulate the production split-architecture: the backend forwards OTP
// send/verify to the standalone otp-server microservice, so the backend's
// own `otps` collection is never written by /send-otp or /verify-otp.
jest.mock('../utils/otpClient', () => ({
  isConfigured: () => true,
  sendOtp: async () => ({ success: true, message: 'OTP sent successfully' }),
  verifyOtp: async (mobile, otp, purpose) => ({
    verified: true,
    success: true,
    message: 'OTP verified successfully'
  })
}));

// Pin the generator so the tests know the exact password-reset OTP code
// without reading the DB (the at-rest value is a salted hash).
jest.mock('../utils/security', () => {
  const actual = jest.requireActual('../utils/security');
  return { ...actual, generateOTP: jest.fn(() => '123456') };
});

const app = require('../server');

describe('OTP split architecture (OTP_SERVICE_URL configured)', () => {
  const originalEnv = { ...process.env };

  const SHOP_LAT = 18.557473097373734;
  const SHOP_LNG = 73.92156518195121;

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('register succeeds after OTP verified through the microservice', async () => {
    process.env.OTP_SERVICE_URL = 'http://otp.local';
    process.env.OTP_SERVICE_API_KEY = 'test-key';
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'testsecret';

    const sendRes = await request(app)
      .post('/api/auth/send-otp')
      .send({ mobile: '9876000001', purpose: 'register' });
    expect(sendRes.statusCode).toBe(200);

    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ mobile: '9876000001', otp: '111111', purpose: 'register' });
    expect(verifyRes.statusCode).toBe(200);

    // The bridge receipt must be recorded locally so /register can confirm
    const receipt = await Otp.findOne({ mobile: '9876000001', purpose: 'register', verified: true });
    expect(receipt).toBeTruthy();

    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Split Register User',
        mobile: '9876000001',
        password: 'password123',
        customerType: 'public',
        address: { street: 'Test St', city: 'Pune', lat: SHOP_LAT, lng: SHOP_LNG }
      });
    expect(regRes.statusCode).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.token).toBeDefined();
  });

  it('OTP login succeeds after OTP verified through the microservice', async () => {
    process.env.OTP_SERVICE_URL = 'http://otp.local';
    process.env.OTP_SERVICE_API_KEY = 'test-key';
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'testsecret';

    const User = require('../models/User');
    await User.create({
      name: 'Split Login User',
      mobile: '9876000002',
      password: 'password123',
      address: { lat: SHOP_LAT, lng: SHOP_LNG, city: 'Pune' }
    });

    const sendRes = await request(app)
      .post('/api/auth/send-otp')
      .send({ mobile: '9876000002', purpose: 'login' });
    expect(sendRes.statusCode).toBe(200);

    const verifyRes = await request(app)
      .post('/api/auth/verify-otp')
      .send({ mobile: '9876000002', otp: '111111', purpose: 'login' });
    expect(verifyRes.statusCode).toBe(200);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ mobile: '9876000002', useOtp: true });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.token).toBeDefined();
  });

  it('register still rejected when the microservice did NOT verify the OTP', async () => {
    process.env.OTP_SERVICE_URL = 'http://otp.local';
    process.env.OTP_SERVICE_API_KEY = 'test-key';
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'testsecret';

    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Unverified User',
        mobile: '9876000003',
        password: 'password123',
        customerType: 'public',
        address: { street: 'Test St', city: 'Pune', lat: SHOP_LAT, lng: SHOP_LNG }
      });
    expect(regRes.statusCode).toBe(401);
  });

  it('verifies a password-reset OTP against the local store even in split mode', async () => {
    process.env.OTP_SERVICE_URL = 'http://otp.local';
    process.env.OTP_SERVICE_API_KEY = 'test-key';

    // forgot-password writes the OTP into the local Otp collection and the
    // backend's own SMS gateway delivers it — never the remote otp-server. So
    // /verify-otp for purpose 'password_reset' must NOT be forwarded, otherwise
    // the mocked remote (which auto-confirms everything) would accept a wrong code.
    const User = require('../models/User');
    await User.create({ name: 'Split Reset User', mobile: '9876000004', password: 'OldPass@123' });

    await request(app).post('/api/auth/forgot-password').send({ mobile: '9876000004' });
    const otp = await Otp.findOne({ mobile: '9876000004', purpose: 'password_reset' });
    expect(otp).toBeTruthy();

    const wrongVerify = await request(app)
      .post('/api/auth/verify-otp')
      .send({ mobile: '9876000004', otp: '000000', purpose: 'password_reset' });
    expect(wrongVerify.statusCode).toBe(400);

    const verify = await request(app)
      .post('/api/auth/verify-otp')
      .send({ mobile: '9876000004', otp: '123456', purpose: 'password_reset' });
    expect(verify.statusCode).toBe(200);

    const stored = await Otp.findOne({ mobile: '9876000004', purpose: 'password_reset' });
    expect(stored.verified).toBe(true);

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ mobile: '9876000004', otp: '123456', newPassword: 'NewPass@12345' });
    expect(reset.statusCode).toBe(200);
  });
});