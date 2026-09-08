const axios = require('axios');
const https = require('https');
const querystring = require('querystring');

/**
 * Mask mobile number for secure logging (e.g. 9876543210 -> 98****3210)
 */
function maskMobile(mobile) {
  if (!mobile || typeof mobile !== 'string' || mobile.length < 10) return '**********';
  return mobile.replace(/^(\d{2})\d{4}(\d{4})$/, '$1****$2');
}

/**
 * SMS Provider Abstraction
 */
class SmsProvider {
  /**
   * Dispatch OTP SMS via configured provider (Fast2SMS, Twilio, or Mock)
   * @param {string} mobile 10-digit Indian mobile number
   * @param {string} otp 6-digit OTP code (only used for SMS body creation)
   * @param {string} purpose OTP purpose (login, register, password_reset)
   */
  static async sendOtp(mobile, otp, purpose = 'login') {
    const masked = maskMobile(mobile);
    const configuredProvider = (process.env.SMS_PROVIDER || '').toLowerCase();

    // 1. FAST2SMS Provider
    if (configuredProvider === 'fast2sms' || process.env.FAST2SMS_API_KEY) {
      return await SmsProvider.sendViaFast2SMS(mobile, otp, masked);
    }

    // 2. TWILIO Provider
    if (
      configuredProvider === 'twilio' ||
      (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER)
    ) {
      return await SmsProvider.sendViaTwilio(mobile, otp, masked);
    }

    // 3. Mock Provider (for development / test mode ONLY)
    if (configuredProvider === 'mock' || process.env.NODE_ENV !== 'production') {
      console.log(`[SMS MOCK] Simulated SMS delivery to ${masked} for purpose '${purpose}'. (OTP protected in production logs)`);
      return {
        success: true,
        provider: 'mock',
        message: 'OTP SMS simulated successfully'
      };
    }

    // 4. Production Error: Unconfigured Provider
    console.error(`[SMS ERROR] No SMS provider configured for ${masked} in production environment.`);
    throw new Error('SMS service is unconfigured in production. Please set SMS_PROVIDER credentials.');
  }

  static async sendViaFast2SMS(mobile, otp, masked) {
    const apiKey = process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY;
    if (!apiKey) {
      throw new Error('FAST2SMS API key missing in environment configuration.');
    }

    console.log(`[SMS FAST2SMS] Dispatching OTP SMS to ${masked}...`);
    try {
      const response = await axios.post(
        'https://www.fast2sms.com/dev/bulkV2',
        {
          route: 'otp',
          variables_values: otp,
          numbers: mobile
        },
        {
          headers: { authorization: apiKey },
          timeout: 10000
        }
      );

      if (response.data && (response.data.return === true || response.data.status_code === 200)) {
        console.log(`[SMS FAST2SMS SUCCESS] Dispatched to ${masked}. Message: ${response.data.message || 'Accepted'}`);
        return {
          success: true,
          provider: 'fast2sms',
          message: response.data.message || 'SMS sent successfully via Fast2SMS'
        };
      } else {
        const errDesc = response.data?.message || JSON.stringify(response.data);
        console.error(`[SMS FAST2SMS FAILURE] Provider error for ${masked}: ${errDesc}`);
        throw new Error(`Fast2SMS failed to deliver SMS: ${errDesc}`);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      console.error(`[SMS FAST2SMS ERROR] Request failed for ${masked}: ${errMsg}`);
      throw new Error(`Fast2SMS error: ${errMsg}`);
    }
  }

  static async sendViaTwilio(mobile, otp, masked) {
    const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
    const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
    const phoneNumber = (process.env.TWILIO_PHONE_NUMBER || '').trim();
    const template = (process.env.TWILIO_TEMPLATE_NAME || '').trim();

    if (!accountSid || !authToken || !phoneNumber) {
      throw new Error('Twilio SID, Auth Token, or Phone Number missing in environment.');
    }

    console.log(`[SMS TWILIO] Dispatching OTP SMS to ${masked}...`);
    const smsBody = template ? `${template}: ${otp}` : `Your Ganesh Trades OTP code is ${otp}. Valid for 5 minutes.`;
    const postData = querystring.stringify({
      To: `+91${mobile}`,
      From: phoneNumber,
      Body: smsBody
    });

    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.twilio.com',
          path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
          },
          timeout: 10000
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log(`[SMS TWILIO SUCCESS] Dispatched to ${masked}. SID: ${parsed.sid}, Status: ${parsed.status}`);
                resolve({
                  success: true,
                  provider: 'twilio',
                  sid: parsed.sid,
                  message: 'SMS sent successfully via Twilio'
                });
              } else {
                const twError = parsed.message || `HTTP ${res.statusCode}`;
                console.error(`[SMS TWILIO FAILURE] Provider response error for ${masked}:`, parsed);
                reject(new Error(`Twilio error: ${twError}`));
              }
            } catch (e) {
              reject(new Error(`Twilio parse error: ${e.message}`));
            }
          });
        }
      );

      req.on('error', (err) => reject(new Error(`Twilio request error: ${err.message}`)));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Twilio HTTP request timed out after 10 seconds'));
      });
      req.write(postData);
      req.end();
    });
  }
}

module.exports = SmsProvider;
