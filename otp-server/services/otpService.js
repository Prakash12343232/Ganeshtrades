const crypto = require('crypto');
const Otp = require('../models/Otp');

/**
 * Secret salt used for hashing OTPs. Can be configured via environment variables.
 */
const OTP_HASH_SECRET = process.env.OTP_HASH_SECRET || 'ganesh_trades_otp_secure_salt_2026';

/**
 * Normalizes Indian mobile numbers to 10 digits.
 * Strips out +91, 0, spaces, and dashes.
 */
function normalizeMobile(mobile) {
  if (!mobile) return null;
  let cleaned = String(mobile).trim().replace(/\D/g, '');

  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.length === 13 && cleaned.startsWith('910')) {
    cleaned = cleaned.substring(3);
  }

  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 * Uses crypto.randomInt (NOT Math.random()).
 */
function generateCryptoOtp() {
  const otpNumber = crypto.randomInt(100000, 1000000);
  return otpNumber.toString();
}

/**
 * Hashes an OTP string using SHA-256 with HMAC secret salt.
 */
function hashOtp(otp) {
  return crypto
    .createHmac('sha256', OTP_HASH_SECRET)
    .update(String(otp).trim())
    .digest('hex');
}

/**
 * Timing-safe hash comparison to prevent timing side-channel attacks.
 */
function safeCompareHash(hashA, hashB) {
  if (!hashA || !hashB || typeof hashA !== 'string' || typeof hashB !== 'string') {
    return false;
  }
  const bufA = Buffer.from(hashA, 'utf8');
  const bufB = Buffer.from(hashB, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

class OtpService {
  /**
   * Normalize mobile number helper
   */
  static normalizeMobile(mobile) {
    return normalizeMobile(mobile);
  }

  /**
   * Process OTP generation, rate limit & cooldown checks, hashing, and database save.
   * Returns { otpCode, normMobile } where otpCode is strictly for SMS dispatch.
   */
  static async generateAndStoreOtp(mobile, purpose) {
    const normMobile = normalizeMobile(mobile);
    if (!normMobile) {
      throw new Error('Invalid mobile number format. Please provide a valid 10-digit Indian mobile number.');
    }

    if (!['login', 'register', 'password_reset'].includes(purpose)) {
      throw new Error('Invalid OTP purpose. Purpose must be one of: login, register, password_reset.');
    }

    const expirySeconds = parseInt(process.env.OTP_EXPIRY_SECONDS, 10) || 300; // default 5 min
    const cooldownSeconds = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10) || 60; // default 60 sec
    const maxSendsPerHour = parseInt(process.env.OTP_MAX_SENDS_PER_HOUR, 10) || 5; // default 5 per hour

    const now = new Date();

    // 1. Check Resend Cooldown (per mobile + purpose)
    const latestOtp = await Otp.findOne({ mobile: normMobile, purpose, verified: false })
      .sort({ createdAt: -1 });

    if (latestOtp) {
      const secondsSinceLastSend = (now.getTime() - new Date(latestOtp.createdAt).getTime()) / 1000;
      if (secondsSinceLastSend < cooldownSeconds) {
        const waitTime = Math.ceil(cooldownSeconds - secondsSinceLastSend);
        throw new Error(`Please wait ${waitTime} seconds before requesting a new OTP.`);
      }
    }

    // 2. Check Hourly Send Rate Limit (per mobile)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const hourlySendsCount = await Otp.countDocuments({
      mobile: normMobile,
      createdAt: { $gte: oneHourAgo }
    });

    if (hourlySendsCount >= maxSendsPerHour) {
      throw new Error(`Maximum OTP requests exceeded. You can request up to ${maxSendsPerHour} OTPs per hour.`);
    }

    // 3. Invalidate previous active unverified OTPs for this mobile + purpose
    await Otp.deleteMany({ mobile: normMobile, purpose, verified: false });

    // 4. Generate Cryptographically Secure OTP
    const otpCode = generateCryptoOtp();
    const otpHash = hashOtp(otpCode);
    const expiresAt = new Date(now.getTime() + expirySeconds * 1000);

    // 5. Save Hashed OTP Record in Database
    await Otp.create({
      mobile: normMobile,
      otpHash,
      purpose,
      verified: false,
      attempts: 0,
      expiresAt
    });

    return {
      otpCode,
      normMobile,
      expirySeconds
    };
  }

  /**
   * Verify an OTP against the stored SHA-256 hash.
   * Enforces attempt counts, expiration, and immediate invalidation on success.
   */
  static async verifyOtp(mobile, otp, purpose) {
    const normMobile = normalizeMobile(mobile);
    if (!normMobile || !otp || !purpose) {
      return {
        verified: false,
        message: 'Mobile number, OTP, and purpose are required.'
      };
    }

    const maxVerifyAttempts = parseInt(process.env.OTP_MAX_VERIFY_ATTEMPTS, 10) || 5;

    // Find the latest active unconsumed OTP record for mobile + purpose
    const otpRecord = await Otp.findOne({
      mobile: normMobile,
      purpose,
      verified: false
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return {
        verified: false,
        message: 'Invalid or expired OTP'
      };
    }

    // Check expiration
    if (new Date() > new Date(otpRecord.expiresAt)) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return {
        verified: false,
        message: 'Invalid or expired OTP'
      };
    }

    // Check maximum attempts
    if (otpRecord.attempts >= maxVerifyAttempts) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return {
        verified: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.'
      };
    }

    // Hash the input OTP and compare using timing-safe equality
    const inputHash = hashOtp(otp);
    const isMatch = safeCompareHash(inputHash, otpRecord.otpHash);

    if (!isMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      if (otpRecord.attempts >= maxVerifyAttempts) {
        await Otp.deleteOne({ _id: otpRecord._id });
        return {
          verified: false,
          message: 'Maximum verification attempts exceeded. Please request a new OTP.'
        };
      }

      return {
        verified: false,
        message: 'Invalid or expired OTP'
      };
    }

    // SUCCESS: Immediately mark verified/consumed (OTP can NEVER be reused)
    otpRecord.verified = true;
    await otpRecord.save();

    return {
      verified: true,
      message: 'OTP verified successfully'
    };
  }
}

module.exports = OtpService;
