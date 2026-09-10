const request = require('supertest');
const Otp = require('../models/Otp');
const { hashOTP, verifyOTP } = require('../utils/security');

// Pin the generator so the tests know the exact OTP code while proving the
// at-rest record only ever holds a salted hash.
jest.mock('../utils/security', () => {
  const actual = jest.requireActual('../utils/security');
  return { ...actual, generateOTP: jest.fn(() => '123456') };
});

const app = require('../server');

describe('OTP at-rest hashing', () => {
  it('stores a salted SHA-256 hash — never the plaintext code', async () => {
    const User = require('../models/User');
    await User.create({ name: 'OTP Hash User', mobile: '9876700001', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ mobile: '9876700001', purpose: 'login' });
    expect(res.statusCode).toEqual(200);

    const rec = await Otp.findOne({ mobile: '9876700001', purpose: 'login' });
    expect(rec).toBeTruthy();
    expect(rec.otp).not.toEqual('123456');
    expect(rec.otp).toMatch(/^[a-f0-9]{64}$/);
    expect(rec.salt).toBeTruthy();
    // The stored value is a verifiable hash of the pinned code.
    expect(verifyOTP('123456', rec.otp, rec.salt)).toBe(true);
    expect(verifyOTP('999999', rec.otp, rec.salt)).toBe(false);
  });

  it('verifies the correct OTP end-to-end and rejects a wrong one with an attempt count', async () => {
    const User = require('../models/User');
    await User.create({ name: 'OTP Verify User', mobile: '9876700002', password: 'password123' });

    await request(app).post('/api/auth/send-otp').send({ mobile: '9876700002', purpose: 'login' });

    const wrong = await request(app)
      .post('/api/auth/verify-otp')
      .send({ mobile: '9876700002', otp: '000000', purpose: 'login' });
    expect(wrong.statusCode).toEqual(400);
    expect(wrong.body.message).toContain('Incorrect OTP');

    let rec = await Otp.findOne({ mobile: '9876700002', purpose: 'login' });
    expect(rec.attempts).toEqual(1);
    expect(rec.verified).toBe(false);

    const ok = await request(app)
      .post('/api/auth/verify-otp')
      .send({ mobile: '9876700002', otp: '123456', purpose: 'login' });
    expect(ok.statusCode).toEqual(200);
    expect(ok.body.success).toBe(true);

    rec = await Otp.findOne({ mobile: '9876700002', purpose: 'login' });
    expect(rec.verified).toBe(true);
    // Successfully verified record still holds the hash, not the code.
    expect(rec.otp).toMatch(/^[a-f0-9]{64}$/);
  });

  it('randomizes the salt so identical codes never produce identical records', async () => {
    const User = require('../models/User');
    await User.create({ name: 'Salt User A', mobile: '9876700003', password: 'password123' });
    await User.create({ name: 'Salt User B', mobile: '9876700004', password: 'password123' });

    await request(app).post('/api/auth/send-otp').send({ mobile: '9876700003', purpose: 'login' });
    await request(app).post('/api/auth/send-otp').send({ mobile: '9876700004', purpose: 'login' });

    const recA = await Otp.findOne({ mobile: '9876700003', purpose: 'login' });
    const recB = await Otp.findOne({ mobile: '9876700004', purpose: 'login' });
    expect(recA.salt).not.toEqual(recB.salt);
    expect(recA.otp).not.toEqual(recB.otp);
  });

  it('fail-closes on malformed or legacy plaintext records', () => {
    const { salt, hash } = hashOTP('123456');
    expect(verifyOTP('123456', hash, salt)).toBe(true);
    expect(verifyOTP('123456', hash, undefined)).toBe(false); // legacy salt-less record
    expect(verifyOTP('123456', 'plaintext-otp', salt)).toBe(false);
    expect(verifyOTP(123456, hash, salt)).toBe(false); // non-string input
    expect(verifyOTP('123456', 'abc', 'xyz')).toBe(false); // malformed hash
  });
});