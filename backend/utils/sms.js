const https = require('https');
const querystring = require('querystring');

const maskMobile = (mobile) => mobile.replace(/^(\d{2})\d{4}(\d{4})$/, '$1****$2');

const isTwilioConfigured = () =>
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER;

const hasAnyGateway = () => Boolean(process.env.FAST2SMS_API_KEY || isTwilioConfigured());

/**
 * Send an OTP code as SMS via the configured gateway (Fast2SMS or Twilio).
 *
 * @param {string} mobile - normalized 10-digit Indian mobile number
 * @param {string} otpCode - OTP to deliver
 * @returns {Promise<{smsSent: boolean, smsProvider: string|null, error: string|null, unconfigured: boolean, maskedMobile: string}>}
 *   - smsSent: true when the OTP was actually delivered (or mocked in dev)
 *   - unconfigured: true only in production when no SMS gateway is configured
 */
async function sendOtpSms(mobile, otpCode) {
  const maskedMobile = maskMobile(mobile);
  let smsSent = false;
  let smsProvider = null;
  let error = null;
  let unconfigured = false;

  if (process.env.FAST2SMS_API_KEY) {
    smsProvider = 'FAST2SMS';
    try {
      const axios = require('axios');
      console.log(`[SMS FAST2SMS] Initiating OTP dispatch to ${maskedMobile}`);
      const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
        route: 'otp',
        variables_values: otpCode,
        numbers: mobile
      }, {
        headers: { authorization: process.env.FAST2SMS_API_KEY },
        timeout: 10000
      });
      if (response.data && (response.data.return === true || response.data.status_code === 200)) {
        smsSent = true;
        console.log(`[SMS FAST2SMS SUCCESS] OTP dispatched to ${maskedMobile}. Status: ${response.data.message || 'Accepted'}`);
      } else {
        error = response.data?.message || 'Provider response error';
        console.error(`[SMS FAST2SMS FAILURE] Provider response error for ${maskedMobile}:`, response.data);
      }
    } catch (err) {
      error = err.response?.data?.message || err.response?.data || err.message;
      console.error(`[SMS FAST2SMS ERROR] Failed to send OTP to ${maskedMobile}:`, error);
    }
  } else if (isTwilioConfigured()) {
    smsProvider = 'TWILIO';
    try {
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID.trim();
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN.trim();
      const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER.trim();
      const twilioTemplate = (process.env.TWILIO_TEMPLATE_NAME || '').trim();

      const smsBody = twilioTemplate || `Your Ganesh Trades OTP code is ${otpCode}. Valid for 5 minutes.`;
      const postData = querystring.stringify({
        To: `+91${mobile}`,
        From: twilioPhoneNumber,
        Body: smsBody
      });

      const authHeader = 'Basic ' + Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');

      console.log(`[SMS TWILIO] Initiating OTP dispatch to ${maskedMobile}`);

      await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.twilio.com',
          path: `/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
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
                smsSent = true;
                console.log(`[SMS TWILIO SUCCESS] OTP dispatched to ${maskedMobile}. SID: ${parsed.sid}, Status: ${parsed.status}`);
                resolve();
              } else {
                error = parsed.message || `HTTP ${res.statusCode}`;
                console.error(`[SMS TWILIO FAILURE] Provider response error for ${maskedMobile}:`, parsed);
                reject(new Error(error));
              }
            } catch (e) {
              error = e.message;
              reject(e);
            }
          });
        });
        req.on('error', (err) => {
          error = err.message;
          reject(err);
        });
        req.on('timeout', () => {
          req.destroy();
          error = 'Twilio HTTP request timed out';
          reject(new Error(error));
        });
        req.write(postData);
        req.end();
      });
    } catch (err) {
      error = error || err.message;
      console.error(`[SMS TWILIO ERROR] Failed to send OTP to ${maskedMobile}:`, err.message);
    }
  } else if (process.env.NODE_ENV === 'production') {
    unconfigured = true;
    error = 'No SMS Gateway API keys configured (FAST2SMS_API_KEY or Twilio credentials)';
    console.error(`[SMS PRODUCTION ERROR] No SMS Gateway API keys configured (FAST2SMS_API_KEY or Twilio) for ${maskedMobile}. Cannot deliver SMS in production.`);
  } else {
    console.log(`[SMS DEV LOG] OTP for ${maskedMobile}: ${otpCode} (dev mock — no SMS gateway configured)`);
    smsSent = true;
  }

  return { smsSent, smsProvider, error, unconfigured, maskedMobile };
}

module.exports = { sendOtpSms, maskMobile, isTwilioConfigured, hasAnyGateway };