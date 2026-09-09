const axios = require('axios');

/**
 * OTP Service Client for Ganesh Trades Backend.
 * Connects Ganesh Backend -> OTP Server using server-to-server HTTP API calls.
 */
class OtpClient {
  /**
   * Check if OTP Microservice URL is configured
   */
  static isConfigured() {
    return Boolean(process.env.OTP_SERVICE_URL);
  }

  /**
   * Request OTP Server to generate and send OTP via SMS
   * @param {string} mobile 10-digit mobile number
   * @param {string} purpose OTP purpose ('login', 'register', 'password_reset')
   */
  static async sendOtp(mobile, purpose) {
    const otpServiceUrl = (process.env.OTP_SERVICE_URL || 'http://localhost:5001').replace(/\/+$/, '');
    const apiKey = process.env.OTP_SERVICE_API_KEY || '';

    try {
      const response = await axios.post(
        `${otpServiceUrl}/api/otp/send`,
        { mobile, purpose },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 12000
        }
      );
      return response.data;
    } catch (error) {
      const serverMessage = error.response && error.response.data && error.response.data.message;
      if (typeof serverMessage === 'string' && serverMessage.trim()) {
        const serverError = new Error(serverMessage.trim());
        serverError.exposed = true;
        if (error.response && error.response.status) serverError.statusCode = error.response.status;
        throw serverError;
      }
      throw new Error('OTP service is temporarily unavailable. Please try again later.');
    }
  }

  /**
   * Request OTP Server to verify supplied OTP
   * @param {string} mobile 10-digit mobile number
   * @param {string} otp 6-digit OTP code
   * @param {string} purpose OTP purpose ('login', 'register', 'password_reset')
   */
  static async verifyOtp(mobile, otp, purpose) {
    const otpServiceUrl = (process.env.OTP_SERVICE_URL || 'http://localhost:5001').replace(/\/+$/, '');
    const apiKey = process.env.OTP_SERVICE_API_KEY || '';

    try {
      const response = await axios.post(
        `${otpServiceUrl}/api/otp/verify`,
        { mobile, otp, purpose },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 12000
        }
      );
      return response.data;
    } catch (error) {
      const serverData = error.response && error.response.data;
      if (serverData && typeof serverData.message === 'string' && serverData.message.trim()) {
        return {
          success: serverData.success === true,
          verified: serverData.verified === true,
          message: serverData.message.trim()
        };
      }
      return {
        success: false,
        verified: false,
        message: 'OTP service is temporarily unavailable. Please try again later.'
      };
    }
  }
}

module.exports = OtpClient;
