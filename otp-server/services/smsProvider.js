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
    const apiKey = (process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('FAST2SMS API key missing in environment configuration.');
    }

    const senderId = (process.env.FAST2SMS_SENDER_ID || process.env.SMS_SENDER_ID || '').trim();
    const templateId = (process.env.FAST2SMS_TEMPLATE_ID || process.env.SMS_TEMPLATE_ID || '').trim();
    const explicitRoute = (process.env.FAST2SMS_ROUTE || '').trim().toLowerCase();
    const useDlt = explicitRoute === 'dlt' || Boolean(templateId && senderId);

    const payload = useDlt
      ? {
          route: 'dlt',
          sender_id: senderId,
          message: templateId,
          variables_values: String(otp),
          numbers: String(mobile),
          flash: 0
        }
      : {
          route: 'otp',
          variables_values: String(otp),
          numbers: String(mobile)
        };

    console.log(`[SMS FAST2SMS] Dispatching OTP SMS to ${masked} using route '${payload.route}'...`);
    try {
      const response = await axios.post(
        'https://www.fast2sms.com/dev/bulkV2',
        payload,
        {
          headers: {
            authorization: apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const data = response.data;
      const isSuccess = data && (data.return === true || data.status_code === 200);

      const extractMsg = (d) => {
        if (!d) return 'Accepted';
        if (Array.isArray(d.message)) return d.message.join(', ');
        if (typeof d.message === 'string' && d.message.trim()) return d.message.trim();
        return 'Accepted';
      };

      if (isSuccess) {
        const msg = extractMsg(data);
        console.log(`[SMS FAST2SMS SUCCESS] Dispatched to ${masked}. Message: ${msg}`);
        return {
          success: true,
          provider: 'fast2sms',
          message: msg
        };
      } else {
        const errDesc = extractMsg(data);
        console.error(`[SMS FAST2SMS FAILURE] Provider error for ${masked}: ${errDesc}`);
        throw new Error(`Fast2SMS failed to deliver SMS: ${errDesc}`);
      }
    } catch (err) {
      let errMsg = 'Fast2SMS network error';
      if (err.code === 'ECONNABORTED' || (err.message && err.message.includes('timeout'))) {
        errMsg = 'Fast2SMS HTTP request timed out after 10 seconds';
      } else if (err.response && err.response.data) {
        const d = err.response.data;
        errMsg = Array.isArray(d.message) ? d.message.join(', ') : (d.message || err.message);
      } else if (err.message) {
        errMsg = err.message;
      }
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
