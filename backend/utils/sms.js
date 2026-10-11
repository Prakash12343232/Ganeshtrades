const https = require('https');
const querystring = require('querystring');
const axios = require('axios');

/**
 * Mask mobile number for secure logging (e.g. 9876543210 -> 98****3210)
 */
const maskMobile = (mobile) => {
  if (!mobile || typeof mobile !== 'string' || mobile.length < 10) return '**********';
  return mobile.replace(/^(\d{2})\d{4}(\d{4})$/, '$1****$2');
};

const isTwilioConfigured = () =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);

const isFast2SmsConfigured = () =>
  Boolean((process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY || '').trim());

const hasAnyGateway = () => isFast2SmsConfigured() || isTwilioConfigured();

/**
 * Safely extract message from Fast2SMS/Twilio response (handles arrays, strings, objects)
 */
function extractProviderMessage(data, fallback = 'Provider response error') {
  if (!data) return fallback;
  if (Array.isArray(data.message)) return data.message.join(', ');
  if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  if (typeof data === 'string' && data.trim()) return data.trim();
  return fallback;
}

/**
 * Send an OTP code via Fast2SMS (supports Quick OTP and DLT Template routes)
 */
async function sendViaFast2SMS(mobile, otpCode, maskedMobile) {
  const apiKey = (process.env.FAST2SMS_API_KEY || process.env.SMS_API_KEY || '').trim();
  if (!apiKey) {
    return {
      smsSent: false,
      smsProvider: 'FAST2SMS',
      error: 'FAST2SMS_API_KEY missing in environment variables',
      unconfigured: true,
      maskedMobile
    };
  }

  const senderId = (process.env.FAST2SMS_SENDER_ID || process.env.SMS_SENDER_ID || '').trim();
  const templateId = (process.env.FAST2SMS_TEMPLATE_ID || process.env.SMS_TEMPLATE_ID || '').trim();
  const explicitRoute = (process.env.FAST2SMS_ROUTE || '').trim().toLowerCase();

  // If DLT route requested or DLT template ID + sender ID provided, use 'dlt' route
  const useDlt = explicitRoute === 'dlt' || Boolean(templateId && senderId);

  const payload = useDlt
    ? {
        route: 'dlt',
        sender_id: senderId,
        message: templateId,
        variables_values: String(otpCode),
        numbers: String(mobile),
        flash: 0
      }
    : {
        route: 'otp',
        variables_values: String(otpCode),
        numbers: String(mobile)
      };

  console.log(`[SMS FAST2SMS] Initiating OTP dispatch to ${maskedMobile} using route '${payload.route}'`);

  try {
    const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', payload, {
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const data = response.data;
    const isSuccess = data && (data.return === true || data.status_code === 200);

    if (isSuccess) {
      const successMsg = extractProviderMessage(data, 'Accepted');
      console.log(`[SMS FAST2SMS SUCCESS] OTP dispatched to ${maskedMobile}. Status: ${successMsg}`);
      return {
        smsSent: true,
        smsProvider: 'FAST2SMS',
        error: null,
        unconfigured: false,
        maskedMobile
      };
    }

    const errDesc = extractProviderMessage(data, 'Fast2SMS returned failure status');
    console.error(`[SMS FAST2SMS FAILURE] Provider rejected request for ${maskedMobile}: ${errDesc}`);
    return {
      smsSent: false,
      smsProvider: 'FAST2SMS',
      error: errDesc,
      unconfigured: false,
      maskedMobile
    };
  } catch (err) {
    let errMsg = 'Fast2SMS network error';
    if (err.code === 'ECONNABORTED' || (err.message && err.message.includes('timeout'))) {
      errMsg = 'Fast2SMS HTTP request timed out after 10 seconds';
    } else if (err.response && err.response.data) {
      errMsg = extractProviderMessage(err.response.data, err.message);
    } else if (err.message) {
      errMsg = err.message;
    }

    console.error(`[SMS FAST2SMS ERROR] Failed to send OTP to ${maskedMobile}:`, errMsg);
    return {
      smsSent: false,
      smsProvider: 'FAST2SMS',
      error: errMsg,
      unconfigured: false,
      maskedMobile
    };
  }
}

/**
 * Send an OTP code via Twilio REST API
 */
async function sendViaTwilio(mobile, otpCode, maskedMobile) {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const phoneNumber = (process.env.TWILIO_PHONE_NUMBER || '').trim();
  const template = (process.env.TWILIO_TEMPLATE_NAME || '').trim();

  if (!accountSid || !authToken || !phoneNumber) {
    return {
      smsSent: false,
      smsProvider: 'TWILIO',
      error: 'Twilio SID, Auth Token, or Phone Number missing in environment',
      unconfigured: true,
      maskedMobile
    };
  }

  const smsBody = template ? `${template}: ${otpCode}` : `Your Ganesh Trades OTP code is ${otpCode}. Valid for 5 minutes.`;
  const postData = querystring.stringify({
    To: `+91${mobile}`,
    From: phoneNumber,
    Body: smsBody
  });

  const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  console.log(`[SMS TWILIO] Initiating OTP dispatch to ${maskedMobile}`);

  try {
    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.twilio.com',
        path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`[SMS TWILIO SUCCESS] OTP dispatched to ${maskedMobile}. SID: ${parsed.sid}, Status: ${parsed.status}`);
              resolve();
            } else {
              const err = parsed.message || `HTTP ${res.statusCode}`;
              console.error(`[SMS TWILIO FAILURE] Provider response error for ${maskedMobile}:`, parsed);
              reject(new Error(err));
            }
          } catch (e) {
            reject(new Error(`Failed to parse Twilio response: ${e.message}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Twilio HTTP request timed out after 10 seconds'));
      });

      req.write(postData);
      req.end();
    });

    return {
      smsSent: true,
      smsProvider: 'TWILIO',
      error: null,
      unconfigured: false,
      maskedMobile
    };
  } catch (err) {
    console.error(`[SMS TWILIO ERROR] Failed to send OTP to ${maskedMobile}:`, err.message);
    return {
      smsSent: false,
      smsProvider: 'TWILIO',
      error: err.message,
      unconfigured: false,
      maskedMobile
    };
  }
}

/**
 * Send an OTP code as SMS via the configured gateway (Fast2SMS or Twilio).
 *
 * @param {string} mobile - normalized 10-digit Indian mobile number
 * @param {string} otpCode - OTP to deliver
 * @returns {Promise<{smsSent: boolean, smsProvider: string|null, error: string|null, unconfigured: boolean, maskedMobile: string}>}
 */
async function sendOtpSms(mobile, otpCode) {
  const maskedMobile = maskMobile(mobile);
  const preferredProvider = (process.env.SMS_PROVIDER || '').trim().toLowerCase();

  // Determine provider:
  // 1. If explicitly set to 'fast2sms', use Fast2SMS
  // 2. If explicitly set to 'twilio', use Twilio
  // 3. Otherwise: prefer Fast2SMS if configured, else Twilio if configured
  if (preferredProvider === 'fast2sms' || (!preferredProvider && isFast2SmsConfigured())) {
    if (isFast2SmsConfigured()) {
      return await sendViaFast2SMS(mobile, otpCode, maskedMobile);
    }
    if (process.env.NODE_ENV === 'production') {
      return {
        smsSent: false,
        smsProvider: 'FAST2SMS',
        error: 'FAST2SMS_API_KEY is not configured in environment variables',
        unconfigured: true,
        maskedMobile
      };
    }
  } else if (preferredProvider === 'twilio' || (!preferredProvider && isTwilioConfigured())) {
    if (isTwilioConfigured()) {
      return await sendViaTwilio(mobile, otpCode, maskedMobile);
    }
    if (process.env.NODE_ENV === 'production') {
      return {
        smsSent: false,
        smsProvider: 'TWILIO',
        error: 'Twilio credentials are not fully configured in environment variables',
        unconfigured: true,
        maskedMobile
      };
    }
  }

  // If we reach here, neither gateway is configured:
  if (process.env.NODE_ENV === 'production') {
    const errorMsg = 'No SMS Gateway API keys configured (FAST2SMS_API_KEY or Twilio credentials)';
    console.error(`[SMS PRODUCTION ERROR] ${errorMsg} for ${maskedMobile}. Cannot deliver SMS in production.`);
    return {
      smsSent: false,
      smsProvider: null,
      error: errorMsg,
      unconfigured: true,
      maskedMobile
    };
  }

  // Development/Test simulated fallback:
  console.log(`[SMS DEV LOG] OTP for ${maskedMobile}: ${otpCode} (dev mock — no SMS gateway configured)`);
  return {
    smsSent: true,
    smsProvider: 'MOCK',
    error: null,
    unconfigured: false,
    maskedMobile
  };
}

module.exports = {
  sendOtpSms,
  maskMobile,
  isTwilioConfigured,
  isFast2SmsConfigured,
  hasAnyGateway,
  sendViaFast2SMS,
  sendViaTwilio
};