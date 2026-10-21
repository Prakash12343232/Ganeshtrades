const { OAuth2Client } = require('google-auth-library');

let cachedClient = null;
let cachedClientId = null;

/**
 * Parse GOOGLE_CLIENT_ID — supports comma-separated Web client IDs (e.g. prod + preview).
 */
function getGoogleClientIds() {
  const raw = process.env.GOOGLE_CLIENT_ID || '';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function getPrimaryGoogleClientId() {
  return getGoogleClientIds()[0] || '';
}

function getOAuthClient(clientId) {
  if (!cachedClient || cachedClientId !== clientId) {
    cachedClient = new OAuth2Client(clientId);
    cachedClientId = clientId;
  }
  return cachedClient;
}

/**
 * Verify a Google ID token from Google Identity Services
 * @param {string} idToken Google ID token (JWT)
 * @param {string} [customAudience] Optional custom audience (defaults to GOOGLE_CLIENT_ID env var)
 * @returns {Promise<{ sub: string, email: string, emailVerified: boolean, name: string, picture: string }>}
 */
async function verifyGoogleToken(idToken, customAudience) {
  if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
    const err = new Error('Google credential token is required');
    err.statusCode = 400;
    err.exposed = true;
    throw err;
  }

  const allowedAudiences = customAudience
    ? [String(customAudience).trim()]
    : getGoogleClientIds();

  if (!allowedAudiences.length) {
    const err = new Error('Google authentication is not configured on this server. Please set GOOGLE_CLIENT_ID in environment variables.');
    err.statusCode = 503;
    err.exposed = true;
    throw err;
  }

  const client = getOAuthClient(allowedAudiences[0]);

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: idToken.trim(),
      audience: allowedAudiences.length === 1 ? allowedAudiences[0] : allowedAudiences
    });
  } catch (verifyError) {
    console.error('Google token verification failed:', verifyError.message);
    const err = new Error('Invalid or expired Google token. Please try again or use mobile & password sign-in.');
    err.statusCode = 401;
    err.exposed = true;
    throw err;
  }

  const payload = ticket.getPayload();
  if (!payload) {
    const err = new Error('Invalid token payload received from Google');
    err.statusCode = 401;
    err.exposed = true;
    throw err;
  }

  // Validate issuer
  const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
  if (!validIssuers.includes(payload.iss)) {
    const err = new Error('Invalid token issuer. Token was not issued by Google.');
    err.statusCode = 401;
    err.exposed = true;
    throw err;
  }

  // Validate email presence and verification status
  if (!payload.email || typeof payload.email !== 'string') {
    const err = new Error('Google token does not contain an email address');
    err.statusCode = 400;
    err.exposed = true;
    throw err;
  }

  if (payload.email_verified !== true) {
    const err = new Error('Google account email is not verified. Please verify your email with Google first.');
    err.statusCode = 400;
    err.exposed = true;
    throw err;
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase().trim(),
    emailVerified: true,
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture || ''
  };
}

module.exports = {
  verifyGoogleToken,
  getOAuthClient,
  getGoogleClientIds,
  getPrimaryGoogleClientId
};
