# Ganesh Trades — Independent OTP Authentication Server (`ganesh-otp-server`)

This repository contains the standalone, production-ready **OTP Authentication Microservice** for Ganesh Trades.

## Architecture & Security

```
Customer Mobile
      ▲
      │ SMS
 SMS Provider (Fast2SMS / Twilio)
      ▲
      │ HTTP API
 OTP Server Microservice (Render)
      │
      ├── MongoDB Atlas (OTP Collection)
      ▲
      │ HTTPS Server-to-Server
      │ Authorization: Bearer <OTP_SERVICE_API_KEY>
 Ganesh Trades Backend (Render)
      ▲
      │ HTTPS API
 Ganesh Trades Frontend (Vercel)
```

- **Complete Independence**: Zero code or runtime dependencies on Ganesh Trades frontend or backend.
- **Crypto-Secure**: Generates 6-digit numeric OTPs via Node.js `crypto.randomInt` (no `Math.random()`).
- **Hashed Storage**: Plaintext OTPs are NEVER stored or logged. Stored as SHA-256 hashes in MongoDB with automatic TTL cleanup (`expiresAt`).
- **Timing-Safe Verification**: Verifies OTP hashes using `crypto.timingSafeEqual`.
- **Anti-Abuse**: Resend cooldown (60s), hourly send limit (5/hr), max verification attempts (5), and IP rate limiters.
- **Server-to-Server Auth**: Secured with `Authorization: Bearer <OTP_SERVICE_API_KEY>`.

---

## Environment Variables

Copy `.env.example` to `.env`:

```env
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/ganeshtrades_otp?retryWrites=true&w=majority
OTP_EXPIRY_SECONDS=300
OTP_RESEND_COOLDOWN_SECONDS=60
OTP_MAX_VERIFY_ATTEMPTS=5
OTP_MAX_SENDS_PER_HOUR=5
OTP_HASH_SECRET=your_super_secret_sha256_salt
OTP_SERVICE_API_KEY=your_secure_server_to_server_api_key

# SMS Provider (fast2sms, twilio, or mock)
SMS_PROVIDER=fast2sms
FAST2SMS_API_KEY=your_fast2sms_api_key
```

---

## API Endpoints

### 1. Health Check
`GET /api/health`
- Response: `{ "success": true, "service": "otp-service", "status": "healthy" }`

### 2. Send OTP
`POST /api/otp/send`
- Headers: `Authorization: Bearer <OTP_SERVICE_API_KEY>`
- Body: `{ "mobile": "9876543210", "purpose": "login" }`
- Response: `{ "success": true, "message": "OTP sent successfully" }`

### 3. Verify OTP
`POST /api/otp/verify`
- Headers: `Authorization: Bearer <OTP_SERVICE_API_KEY>`
- Body: `{ "mobile": "9876543210", "otp": "482731", "purpose": "login" }`
- Response: `{ "success": true, "verified": true }`

---

## Deployment to Render

1. Create a new repository on GitHub: `ganesh-otp-server`.
2. Push the contents of `/otp-server` to the new GitHub repository.
3. In Render Dashboard, click **New + -> Web Service**.
4. Connect `ganesh-otp-server` repository.
5. Set Build Command: `npm install`, Start Command: `npm start`.
6. Add the environment variables specified in `.env.example`.
