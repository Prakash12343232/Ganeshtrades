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
      if (error.response && error.response.data) {
        throw new Error(error.response.data.message || 'OTP Service failed to send OTP');
      }
      throw new Error(`OTP Service Connection Error: ${error.message}`);
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
      if (error.response && error.response.data) {
        return error.response.data;
      }
      return {
        success: false,
        verified: false,
        message: `OTP Service Connection Error: ${error.message}`
      };
    }
  }
}

module.exports = OtpClient;
