const request = require('supertest');
const axios = require('axios');
const app = require('../server');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendOtpSms, maskMobile } = require('../utils/sms');

jest.mock('axios');

describe('SMS Gateway Integration (Fast2SMS & Twilio)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.FAST2SMS_API_KEY;
    delete process.env.FAST2SMS_ROUTE;
    delete process.env.FAST2SMS_SENDER_ID;
    delete process.env.FAST2SMS_TEMPLATE_ID;
    delete process.env.SMS_PROVIDER;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.OTP_SERVICE_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('maskMobile utility', () => {
    it('masks 10-digit mobile number properly', () => {
      expect(maskMobile('9876543210')).toBe('98****3210');
      expect(maskMobile('8010412539')).toBe('80****2539');
    });

    it('handles short or invalid numbers safely', () => {
      expect(maskMobile('')).toBe('**********');
      expect(maskMobile(null)).toBe('**********');
      expect(maskMobile('123')).toBe('**********');
    });
  });

  describe('Fast2SMS Adapter Unit Logic', () => {
    it('sends via Fast2SMS Quick OTP route when FAST2SMS_API_KEY is configured', async () => {
      process.env.FAST2SMS_API_KEY = 'test_fast2sms_key_123';
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          return: true,
          request_id: 'req_abc123',
          message: ['SMS sent successfully.']
        }
      });

      const res = await sendOtpSms('9876543210', '482910');

      expect(res.smsSent).toBe(true);
      expect(res.smsProvider).toBe('FAST2SMS');
      expect(res.error).toBeNull();
      expect(res.unconfigured).toBe(false);
      expect(res.maskedMobile).toBe('98****3210');

      expect(axios.post).toHaveBeenCalledWith(
        'https://www.fast2sms.com/dev/bulkV2',
        {
          route: 'otp',
          variables_values: '482910',
          numbers: '9876543210'
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: 'test_fast2sms_key_123'
          })
        })
      );
    });

    it('sends via Fast2SMS DLT route when template ID and sender ID are provided', async () => {
      process.env.FAST2SMS_API_KEY = 'test_fast2sms_key_123';
      process.env.FAST2SMS_ROUTE = 'dlt';
      process.env.FAST2SMS_SENDER_ID = 'GNTRAD';
      process.env.FAST2SMS_TEMPLATE_ID = '120716123456';

      axios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          return: true,
          status_code: 200,
          message: 'SMS sent successfully'
        }
      });

      const res = await sendOtpSms('9876543210', '654321');

      expect(res.smsSent).toBe(true);
      expect(res.smsProvider).toBe('FAST2SMS');
      expect(axios.post).toHaveBeenCalledWith(
        'https://www.fast2sms.com/dev/bulkV2',
        {
          route: 'dlt',
          sender_id: 'GNTRAD',
          message: '120716123456',
          variables_values: '654321',
          numbers: '9876543210',
          flash: 0
        },
        expect.any(Object)
      );
    });

    it('handles Fast2SMS rejected response (e.g. low balance or invalid numbers)', async () => {
      process.env.FAST2SMS_API_KEY = 'test_fast2sms_key_123';
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          return: false,
          status_code: 996,
          message: ['Low balance in your account']
        }
      });

      const res = await sendOtpSms('9876543210', '123456');

      expect(res.smsSent).toBe(false);
      expect(res.smsProvider).toBe('FAST2SMS');
      expect(res.error).toContain('Low balance in your account');
      expect(res.unconfigured).toBe(false);
    });

    it('handles Fast2SMS HTTP 401 invalid authorization key response', async () => {
      process.env.FAST2SMS_API_KEY = 'invalid_key';
      const error = new Error('Request failed with status code 401');
      error.response = {
        status: 401,
        data: {
          status: 401,
          message: 'Invalid API Key'
        }
      };
      axios.post.mockRejectedValueOnce(error);

      const res = await sendOtpSms('9876543210', '123456');

      expect(res.smsSent).toBe(false);
      expect(res.smsProvider).toBe('FAST2SMS');
      expect(res.error).toBe('Invalid API Key');
    });

    it('handles Fast2SMS network timeout safely', async () => {
      process.env.FAST2SMS_API_KEY = 'test_key';
      const timeoutErr = new Error('timeout of 10000ms exceeded');
      timeoutErr.code = 'ECONNABORTED';
      axios.post.mockRejectedValueOnce(timeoutErr);

      const res = await sendOtpSms('9876543210', '123456');

      expect(res.smsSent).toBe(false);
      expect(res.smsProvider).toBe('FAST2SMS');
      expect(res.error).toContain('timed out');
    });

    it('respects SMS_PROVIDER=fast2sms even when Twilio credentials are also present', async () => {
      process.env.SMS_PROVIDER = 'fast2sms';
      process.env.FAST2SMS_API_KEY = 'fast2sms_key';
      process.env.TWILIO_ACCOUNT_SID = 'AC123';
      process.env.TWILIO_AUTH_TOKEN = 'auth123';
      process.env.TWILIO_PHONE_NUMBER = '+1234567890';

      axios.post.mockResolvedValueOnce({
        status: 200,
        data: { return: true, message: ['Accepted'] }
      });

      const res = await sendOtpSms('9876543210', '112233');

      expect(res.smsSent).toBe(true);
      expect(res.smsProvider).toBe('FAST2SMS');
      expect(axios.post).toHaveBeenCalled();
    });
  });

  describe('Fast2SMS End-to-End Route Integration (/api/auth/send-otp)', () => {
    it('returns HTTP 200 when Fast2SMS successfully delivers the OTP', async () => {
      process.env.FAST2SMS_API_KEY = 'test_fast2sms_key';
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a_very_secure_and_long_jwt_secret_for_tests_32chars';

      axios.post.mockResolvedValueOnce({
        status: 200,
        data: { return: true, message: ['SMS sent successfully.'] }
      });

      const res = await request(app)
        .post('/api/auth/send-otp')
        .send({ mobile: '9876900001', purpose: 'register' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('OTP sent successfully');

      // Verify record is created with salted hash
      const otpRec = await Otp.findOne({ mobile: '9876900001', purpose: 'register' });
      expect(otpRec).toBeTruthy();
      expect(otpRec.salt).toBeTruthy();
      expect(otpRec.otp).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns HTTP 502 with clear provider error message when Fast2SMS rejects', async () => {
      process.env.FAST2SMS_API_KEY = 'test_fast2sms_key';
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a_very_secure_and_long_jwt_secret_for_tests_32chars';

      axios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          return: false,
          status_code: 996,
          message: ['Low balance in your account']
        }
      });

      const res = await request(app)
        .post('/api/auth/send-otp')
        .send({ mobile: '9876900002', purpose: 'register' });

      expect(res.statusCode).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Failed to deliver OTP SMS via FAST2SMS');
      expect(res.body.message).toContain('Low balance');
    });

    it('returns HTTP 503 when no SMS gateway is configured in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a_very_secure_and_long_jwt_secret_for_tests_32chars';

      const res = await request(app)
        .post('/api/auth/send-otp')
        .send({ mobile: '9876900003', purpose: 'register' });

      expect(res.statusCode).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('SMS service is currently unconfigured in production');
    });
  });
});
