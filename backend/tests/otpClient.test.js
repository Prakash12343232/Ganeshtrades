jest.mock('axios');
const axios = require('axios');
const request = require('supertest');
const OtpClient = require('../utils/otpClient');
const { clientErrorMessage } = require('../utils/errors');

describe('OtpClient server-to-server error sanitization', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  const connectionError = Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5001'), {});

  it('sendOtp hides connection internals behind a generic message', async () => {
    axios.post.mockRejectedValue(connectionError);

    await expect(OtpClient.sendOtp('9876000001', 'register')).rejects.toThrow('OTP service is temporarily unavailable. Please try again later.');
    try {
      await OtpClient.sendOtp('9876000001', 'register');
    } catch (err) {
      expect(err.message).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|5001/);
    }
  });

  it('sendOtp passes through a sanitized OTP-server message with its status code', async () => {
    axios.post.mockRejectedValue({
      response: { status: 429, data: { success: false, message: 'Please wait 30 seconds before requesting a new OTP.' } }
    });

    try {
      await OtpClient.sendOtp('9876000001', 'register');
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.message).toEqual('Please wait 30 seconds before requesting a new OTP.');
      expect(err.exposed).toBe(true);
      expect(err.statusCode).toEqual(429);
    }
  });

  it('sendOtp hides non-JSON error bodies from the OTP server', async () => {
    axios.post.mockRejectedValue({
      response: { status: 502, data: '<html>upstream error</html>' }
    });

    await expect(OtpClient.sendOtp('9876000001', 'register')).rejects.toThrow('OTP service is temporarily unavailable. Please try again later.');
  });

  it('verifyOtp hides connection internals behind a generic message', async () => {
    axios.post.mockRejectedValue(connectionError);

    const result = await OtpClient.verifyOtp('9876000001', '123456', 'login');
    expect(result.verified).toBe(false);
    expect(result.message).toEqual('OTP service is temporarily unavailable. Please try again later.');
    expect(result.message).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|5001/);
  });

  it('verifyOtp preserves a sanitized OTP-server response', async () => {
    axios.post.mockRejectedValue({
      response: { status: 400, data: { success: false, verified: false, message: 'Invalid or expired OTP' } }
    });

    const result = await OtpClient.verifyOtp('9876000001', '000000', 'login');
    expect(result.verified).toBe(false);
    expect(result.message).toEqual('Invalid or expired OTP');
  });

  it('verifyOtp handles non-JSON error bodies without throwing', async () => {
    axios.post.mockRejectedValue({
      response: { status: 502, data: '<html>gateway error</html>' }
    });

    const result = await OtpClient.verifyOtp('9876000001', '123456', 'login');
    expect(result.verified).toBe(false);
    expect(result.message).toEqual('OTP service is temporarily unavailable. Please try again later.');
  });
});

describe('clientErrorMessage', () => {
  it('hides internal error messages', () => {
    const internal = new Error('connect ECONNREFUSED mongodb://10.0.0.5:27017');
    expect(clientErrorMessage(internal)).toEqual('An unexpected error occurred. Please try again later.');
  });

  it('preserves Mongoose validation messages', () => {
    const validation = new Error('Please enter a valid name');
    validation.name = 'ValidationError';
    expect(clientErrorMessage(validation)).toEqual('Please enter a valid name');
  });

  it('preserves explicitly exposed messages', () => {
    const exposed = new Error('Please wait 30 seconds before requesting a new OTP.');
    exposed.exposed = true;
    expect(clientErrorMessage(exposed)).toEqual('Please wait 30 seconds before requesting a new OTP.');
  });

  it('returns a custom fallback when supplied', () => {
    expect(clientErrorMessage(new Error('x'), 'Registration failed. Please try again later.')).toEqual('Registration failed. Please try again later.');
  });
});

describe('auth endpoints never leak internal error details', () => {
  const app = require('../server');

  const originalEnv2 = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv2 };
  });

  it('returns a generic 500 when the backend OTP client throws an internal error', async () => {
    process.env.OTP_SERVICE_URL = 'http://otp.internal:5001';
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'testsecret';

    const OtpClientMock = require('../utils/otpClient');
    OtpClientMock.sendOtp = jest.fn().mockRejectedValue(new Error('OTP Service Connection Error: connect ECONNREFUSED http://otp.internal:5001'));

    const res = await request(app).post('/api/auth/send-otp').send({ mobile: '9876200001', purpose: 'register' });

    expect(res.statusCode).toEqual(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).not.toMatch(/ECONNREFUSED|otp\.internal|5001/);
  });

  it('propagates a sanitized cooldown message with its original 429 status', async () => {
    process.env.OTP_SERVICE_URL = 'http://otp.internal:5001';
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'testsecret';

    const OtpClientMock = require('../utils/otpClient');
    const cdErr = new Error('Please wait 30 seconds before requesting a new OTP.');
    cdErr.exposed = true;
    cdErr.statusCode = 429;
    OtpClientMock.sendOtp = jest.fn().mockRejectedValue(cdErr);

    const res = await request(app).post('/api/auth/send-otp').send({ mobile: '9876200002', purpose: 'register' });

    expect(res.statusCode).toEqual(429);
    expect(res.body.message).toEqual('Please wait 30 seconds before requesting a new OTP.');
  });

  it('verify-otp returns a generic 400 for a mismatching OTP', async () => {
    process.env.OTP_SERVICE_URL = 'http://otp.internal:5001';
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'testsecret';

    const OtpClientMock = require('../utils/otpClient');
    OtpClientMock.verifyOtp = jest.fn().mockResolvedValue({ success: false, verified: false, message: 'Invalid or expired OTP' });

    const res = await request(app).post('/api/auth/verify-otp').send({ mobile: '9876200003', otp: '000000', purpose: 'login' });

    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toEqual('Invalid or expired OTP');
  });
});