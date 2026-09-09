const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Otp = require('../models/Otp');
const AuditLog = require('../models/AuditLog');
const { sendOtpSms } = require('../utils/sms');

describe('OTP SMS delivery + password reset flow', () => {
  afterEach(() => {
    delete process.env.FAST2SMS_API_KEY;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    process.env.NODE_ENV = 'test';
  });

  describe('sendOtpSms utility', () => {
    it('mocks delivery in non-production when no gateway is configured', async () => {
      const res = await sendOtpSms('9876543210', '123456');
      expect(res.smsSent).toBe(true);
      expect(res.unconfigured).toBe(false);
    });

    it('reports unconfigured in production when no gateway is configured', async () => {
      process.env.NODE_ENV = 'production';
      const res = await sendOtpSms('9876543210', '123456');
      expect(res.smsSent).toBe(false);
      expect(res.unconfigured).toBe(true);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('creates an OTP record and responds success when an account exists', async () => {
      await User.create({ name: 'Reset User', mobile: '9876500000', password: 'OldPass@123' });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ mobile: '9876500000' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('If an account exists');

      const otp = await Otp.findOne({ mobile: '9876500000', purpose: 'password_reset' });
      expect(otp).toBeTruthy();
      expect(otp.otp).toMatch(/^\d{6}$/);
    });

    it('does not reveal whether an account exists', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ mobile: '9999900000' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('If an account exists');

      const otp = await Otp.findOne({ mobile: '9999900000', purpose: 'password_reset' });
      expect(otp).toBeFalsy();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('rejects an incorrect OTP', async () => {
      await User.create({ name: 'Reset User', mobile: '9876511111', password: 'OldPass@123' });
      await request(app).post('/api/auth/forgot-password').send({ mobile: '9876511111' });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ mobile: '9876511111', otp: '000000', newPassword: 'NewPass@12345' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Incorrect OTP');
    });

    it('resets the password end-to-end and allows login with the new password', async () => {
      await User.create({ name: 'Reset User', mobile: '9876522222', password: 'OldPass@123' });

      await request(app).post('/api/auth/forgot-password').send({ mobile: '9876522222' });

      const otp = await Otp.findOne({ mobile: '9876522222', purpose: 'password_reset' });
      expect(otp).toBeTruthy();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ mobile: '9876522222', otp: otp.otp, newPassword: 'NewPass@12345' });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);

      const audit = await AuditLog.findOne({ action: 'password_reset' });
      expect(audit).toBeTruthy();
      expect(audit.entity).toBe('user');

      const login = await request(app)
        .post('/api/auth/login')
        .send({ mobile: '9876522222', password: 'NewPass@12345' });

      expect(login.statusCode).toEqual(200);
      expect(login.body.success).toBe(true);
      expect(login.body.token).toBeDefined();
    });
  });

  describe('verify-otp integration with password reset', () => {
    it('marks the reset OTP verified, then reset-password with the same OTP still succeeds', async () => {
      await User.create({ name: 'Reset Verify User', mobile: '9876533333', password: 'OldPass@123' });
      await request(app).post('/api/auth/forgot-password').send({ mobile: '9876533333' });

      const otp = await Otp.findOne({ mobile: '9876533333', purpose: 'password_reset' });
      expect(otp).toBeTruthy();

      const verify = await request(app)
        .post('/api/auth/verify-otp')
        .send({ mobile: '9876533333', otp: otp.otp, purpose: 'password_reset' });
      expect(verify.statusCode).toEqual(200);

      const stored = await Otp.findOne({ mobile: '9876533333', purpose: 'password_reset' });
      expect(stored.verified).toBe(true);

      // Previously reset-password only looked up verified:false records, so a
      // record already confirmed by /verify-otp returned 'Invalid or expired OTP'.
      const reset = await request(app)
        .post('/api/auth/reset-password')
        .send({ mobile: '9876533333', otp: otp.otp, newPassword: 'NewPass@12345' });
      expect(reset.statusCode).toEqual(200);

      const login = await request(app)
        .post('/api/auth/login')
        .send({ mobile: '9876533333', password: 'NewPass@12345' });
      expect(login.statusCode).toEqual(200);
    });

    it('rejects a wrong OTP at the verify step and counts the attempt', async () => {
      await User.create({ name: 'Reset Wrong User', mobile: '9876544444', password: 'OldPass@123' });
      await request(app).post('/api/auth/forgot-password').send({ mobile: '9876544444' });

      const bad = await request(app)
        .post('/api/auth/verify-otp')
        .send({ mobile: '9876544444', otp: '000000', purpose: 'password_reset' });
      expect(bad.statusCode).toEqual(400);
      expect(bad.body.message).toContain('Incorrect OTP');

      const rec = await Otp.findOne({ mobile: '9876544444', purpose: 'password_reset' });
      expect(rec.attempts).toBe(1);
      expect(rec.verified).toBe(false);
    });
  });
});