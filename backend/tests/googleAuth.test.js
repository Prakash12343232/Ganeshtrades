const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');
const { generateTestToken } = require('./setup');
const googleAuthUtils = require('../utils/googleAuth');

const SHOP_COORDS = { lat: 18.557473097373734, lng: 73.92156518195121 };

describe('Google Authentication Endpoints', () => {
  let originalVerifyGoogleToken;
  let originalEnvClientId;
  let originalAdminEmail;

  beforeAll(() => {
    originalVerifyGoogleToken = googleAuthUtils.verifyGoogleToken;
    originalEnvClientId = process.env.GOOGLE_CLIENT_ID;
    originalAdminEmail = process.env.ADMIN_GOOGLE_EMAIL;
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
  });

  afterAll(() => {
    googleAuthUtils.verifyGoogleToken = originalVerifyGoogleToken;
    process.env.GOOGLE_CLIENT_ID = originalEnvClientId;
    process.env.ADMIN_GOOGLE_EMAIL = originalAdminEmail;
  });

  afterEach(() => {
    delete process.env.ADMIN_GOOGLE_EMAIL;
    jest.clearAllMocks();
  });

  describe('GET /api/auth/google/config', () => {
    it('returns client ID configuration status', async () => {
      const res = await request(app).get('/api/auth/google/config');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.configured).toBe(true);
      expect(res.body.clientId).toBe('test-client-id.apps.googleusercontent.com');
    });
  });

  describe('POST /api/auth/google', () => {
    it('rejects request when credential token is missing', async () => {
      const res = await request(app)
        .post('/api/auth/google')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/credential token is required/i);
    });

    it('rejects when Google token verification fails', async () => {
      jest.spyOn(googleAuthUtils, 'verifyGoogleToken').mockImplementation(async () => {
        const err = new Error('Invalid or expired Google token');
        err.statusCode = 401;
        err.exposed = true;
        throw err;
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'invalid-fake-token' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid or expired Google token/i);
      expect(res.body.message).not.toMatch(/audience/i);
    });

    it('rejects when Google email is unverified', async () => {
      jest.spyOn(googleAuthUtils, 'verifyGoogleToken').mockImplementation(async () => {
        const err = new Error('Google account email is not verified');
        err.statusCode = 400;
        err.exposed = true;
        throw err;
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'unverified-email-token' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/email is not verified/i);
    });

    it('creates a new pending customer and returns a registration token instead of a session', async () => {
      const mockProfile = {
        sub: 'google-sub-new-12345',
        email: 'newcustomer@gmail.com',
        emailVerified: true,
        name: 'Ravi Kumar',
        picture: 'https://lh3.googleusercontent.com/photo.jpg'
      };

      jest.spyOn(googleAuthUtils, 'verifyGoogleToken').mockResolvedValue(mockProfile);

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'valid-token' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.requiresProfileCompletion).toBe(true);
      expect(res.body.registrationToken).toBeDefined();
      expect(res.body.token).toBeUndefined();
      expect(res.body.profile.email).toBe('newcustomer@gmail.com');
      expect(res.body.profile.name).toBe('Ravi Kumar');
      expect(res.body.profile.avatar).toBe(mockProfile.picture);

      // Confirm DB record is a customer awaiting profile completion.
      const dbUser = await User.findOne({ googleId: 'google-sub-new-12345' });
      expect(dbUser).not.toBeNull();
      expect(dbUser.role).toBe('customer');
      expect(dbUser.authProvider).toBe('google');
      expect(dbUser.isEmailVerified).toBe(true);
      expect(dbUser.profileCompleted).toBe(false);
      expect(dbUser.phoneVerified).toBe(false);
      expect(dbUser.mobile).toBeUndefined();
    });

    it('authenticates existing complete user by googleId', async () => {
      const existingUser = await User.create({
        name: 'Existing Google User',
        email: 'existing-google@gmail.com',
        googleId: 'google-sub-existing-999',
        mobile: '9876543288',
        address: { street: 'MG Road', area: 'Kothrud', city: 'Pune', state: 'Maharashtra', pincode: '411038', lat: 18.5074, lng: 73.8077 },
        profileCompleted: true,
        phoneVerified: false,
        role: 'customer',
        authProvider: 'google',
        isEmailVerified: true
      });

      jest.spyOn(googleAuthUtils, 'verifyGoogleToken').mockResolvedValue({
        sub: 'google-sub-existing-999',
        email: 'existing-google@gmail.com',
        emailVerified: true,
        name: 'Existing Google User'
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'valid-existing-token' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.requiresProfileCompletion).toBeUndefined();
      expect(res.body.user.id).toBe(existingUser._id.toString());
      expect(res.body.user.googleId).toBe('google-sub-existing-999');
      expect(res.body.token).toBeDefined();
    });

    it('treats a legacy Google-only customer without mobile as pending', async () => {
      await User.create({
        name: 'Legacy Google Only',
        email: 'legacy-google@gmail.com',
        googleId: 'google-sub-legacy-555',
        role: 'customer',
        authProvider: 'google'
      });

      jest.spyOn(googleAuthUtils, 'verifyGoogleToken').mockResolvedValue({
        sub: 'google-sub-legacy-555',
        email: 'legacy-google@gmail.com',
        emailVerified: true,
        name: 'Legacy Google Only'
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'legacy-token' });

      expect(res.statusCode).toBe(200);
      expect(res.body.requiresProfileCompletion).toBe(true);
      expect(res.body.registrationToken).toBeDefined();
      expect(res.body.token).toBeUndefined();
    });

    it('does not silently link a Google identity to an existing customer based only on email', async () => {
      const existingCustomer = await User.create({
        name: 'Pre-existing Customer',
        mobile: '9876543299',
        email: 'preexisting@gmail.com',
        password: 'password123',
        role: 'customer',
        customerType: 'hotel'
      });

      jest.spyOn(googleAuthUtils, 'verifyGoogleToken').mockResolvedValue({
        sub: 'google-sub-linked-777',
        email: 'preexisting@gmail.com',
        emailVerified: true,
        name: 'Pre-existing Customer'
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'link-token' });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/sign in with your existing account.*link google/i);

      const updated = await User.findById(existingCustomer._id);
      expect(updated.googleId).toBeUndefined();
      expect(updated.role).toBe('customer');
    });

    it('returns an actionable conflict when a concurrent or legacy account causes a duplicate key', async () => {
      jest.spyOn(googleAuthUtils, 'verifyGoogleToken').mockResolvedValue({
        sub: 'google-sub-duplicate-race',
        email: 'duplicate-race@gmail.com',
        emailVerified: true,
        name: 'Duplicate Race'
      });
      const createSpy = jest.spyOn(User, 'create').mockRejectedValueOnce({ code: 11000 });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'duplicate-race-token' });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already associated.*sign in with mobile.*link google/i);
      createSpy.mockRestore();
    });

    it('BLOCKS unauthorized Google sign-in for admin account without verified linking or env match', async () => {
      await User.create({
        name: 'Shop Admin',
        mobile: '9876543200',
        email: 'admin@ganeshtrades.com',
        password: 'AdminPassword@123',
        role: 'admin'
      });

      jest.spyOn(googleAuthUtils, 'verifyGoogleToken').mockResolvedValue({
        sub: 'attacker-sub-000',
        email: 'admin@ganeshtrades.com',
        emailVerified: true,
        name: 'Unverified Admin Claimant'
      });

      // No ADMIN_GOOGLE_EMAIL set
      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'admin-unlinked-token' });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/sign in with your existing account.*link google/i);

      // Verify DB was NOT linked
      const checkAdmin = await User.findOne({ email: 'admin@ganeshtrades.com' });
      expect(checkAdmin.googleId).toBeUndefined();
    });

    it('does not bypass authenticated linking for an admin when ADMIN_GOOGLE_EMAIL matches', async () => {
      process.env.ADMIN_GOOGLE_EMAIL = 'owner.verified@gmail.com';

      const adminUser = await User.create({
        name: 'Verified Owner Admin',
        mobile: '9876543201',
        email: 'owner.verified@gmail.com',
        password: 'AdminPassword@123',
        role: 'admin'
      });

      jest.spyOn(googleAuthUtils, 'verifyGoogleToken').mockResolvedValue({
        sub: 'owner-sub-111',
        email: 'owner.verified@gmail.com',
        emailVerified: true,
        name: 'Verified Owner'
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'owner-token' });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/sign in with your existing account.*link google/i);

      const updated = await User.findById(adminUser._id);
      expect(updated.googleId).toBeUndefined();
    });

    it('rejects deactivated user account', async () => {
      await User.create({
        name: 'Deactivated User',
        email: 'deactivated@gmail.com',
        googleId: 'google-sub-deactivated',
        isActive: false,
        role: 'customer'
      });

      jest.spyOn(googleAuthUtils, 'verifyGoogleToken').mockResolvedValue({
        sub: 'google-sub-deactivated',
        email: 'deactivated@gmail.com',
        emailVerified: true,
        name: 'Deactivated User'
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'deactivated-token' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/deactivated/i);
    });
  });

  describe('POST /api/auth/google/complete-profile', () => {
    const createPendingRegistrationToken = async ({ sub, email }) => {
      const pendingUser = await User.create({
        name: 'Pending Google Customer',
        email,
        googleId: sub,
        role: 'customer',
        authProvider: 'google',
        isEmailVerified: true,
        profileCompleted: false,
        phoneVerified: false
      });
      return jwt.sign(
        { id: pendingUser._id.toString(), scope: 'profile_completion' },
        process.env.JWT_SECRET || 'testsecret',
        { expiresIn: '30m', audience: 'profile-completion', algorithm: 'HS256' }
      );
    };

    it('finishes onboarding, saves details without OTP, and returns a normal session', async () => {
      const mockProfile = {
        sub: 'google-sub-complete-100',
        email: 'complete.me@gmail.com',
        emailVerified: true,
        name: 'Complete Me'
      };
      jest.spyOn(googleAuthUtils, 'verifyGoogleToken').mockResolvedValue(mockProfile);

      const loginRes = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'complete-token' });
      expect(loginRes.body.requiresProfileCompletion).toBe(true);

      const res = await request(app)
        .post('/api/auth/google/complete-profile')
        .send({
          registrationToken: loginRes.body.registrationToken,
          name: 'Ravi Kumar',
          mobile: '9876543210',
          customerType: 'hotel',
          address: {
            street: '12 Market Road',
            area: 'Kothrud',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411038',
            lat: SHOP_COORDS.lat,
            lng: SHOP_COORDS.lng
          }
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.mobile).toBe('9876543210');
      expect(res.body.user.customerType).toBe('hotel');
      expect(res.body.user.profileCompleted).toBe(true);
      expect(res.body.user.phoneVerified).toBe(false);
      expect(res.body.user.address.state).toBe('Maharashtra');

      const dbUser = await User.findOne({ googleId: 'google-sub-complete-100' });
      expect(dbUser.mobile).toBe('9876543210');
      expect(dbUser.profileCompleted).toBe(true);
      expect(dbUser.phoneVerified).toBe(false);
    });

    it('rejects a missing registration token', async () => {
      const res = await request(app)
        .post('/api/auth/google/complete-profile')
        .send({ name: 'No Token', mobile: '9876543211' });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects an invalid or expired registration token', async () => {
      const res = await request(app)
        .post('/api/auth/google/complete-profile')
        .send({ registrationToken: 'not-a-real-token', name: 'Bad Token', mobile: '9876543212' });

      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('REGISTRATION_SESSION_EXPIRED');
    });

    it('rejects a mobile number already used by another account', async () => {
      await User.create({
        name: 'Existing Mobile Owner',
        mobile: '9876543213',
        password: 'password123',
        role: 'customer'
      });

      const registrationToken = await createPendingRegistrationToken({
        sub: 'google-sub-complete-101',
        email: 'complete.mobile@gmail.com'
      });

      const res = await request(app)
        .post('/api/auth/google/complete-profile')
        .send({
          registrationToken,
          name: 'Mobile Conflict',
          mobile: '9876543213',
          customerType: 'public',
          address: {
            street: '12 Market Road',
            area: 'Kothrud',
            city: 'Pune',
            state: 'Maharashtra',
            pincode: '411038',
            lat: SHOP_COORDS.lat,
            lng: SHOP_COORDS.lng
          }
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('MOBILE_IN_USE');
    });

    it('rejects an address outside the delivery radius', async () => {
      const registrationToken = await createPendingRegistrationToken({
        sub: 'google-sub-complete-102',
        email: 'complete.far@gmail.com'
      });

      const res = await request(app)
        .post('/api/auth/google/complete-profile')
        .send({
          registrationToken,
          name: 'Far Away',
          mobile: '9876543214',
          customerType: 'public',
          address: {
            street: '1 India Gate',
            area: 'Rajpath',
            city: 'New Delhi',
            state: 'Delhi',
            pincode: '110001',
            lat: 28.6129,
            lng: 77.2295
          }
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('OUTSIDE_DELIVERY_AREA');
      expect(res.body.serviceability.serviceable).toBe(false);
    });

    it('does not accept a profile-completion token as a normal session', async () => {
      const pendingUser = await User.create({
        name: 'Pending User',
        email: 'pending.session@gmail.com',
        googleId: 'google-sub-pending-session',
        role: 'customer',
        authProvider: 'google',
        profileCompleted: false
      });

      const registrationToken = jwt.sign(
        { id: pendingUser._id.toString(), scope: 'profile_completion' },
        process.env.JWT_SECRET || 'testsecret',
        { expiresIn: '30m', audience: 'profile-completion', algorithm: 'HS256' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${registrationToken}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('REGISTRATION_SESSION_EXPIRED');
    });

    it('blocks incomplete customers from protected customer APIs but allows profile access', async () => {
      const incomplete = await User.create({
        name: 'Incomplete Customer',
        mobile: '9876543215',
        password: 'password123',
        role: 'customer',
        profileCompleted: false
      });
      const token = generateTestToken(incomplete._id);

      const blocked = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${token}`);
      expect(blocked.statusCode).toBe(403);
      expect(blocked.body.code).toBe('PROFILE_INCOMPLETE');
      expect(blocked.body.requiresProfileCompletion).toBe(true);

      const allowed = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(allowed.statusCode).toBe(200);
    });
  });

  describe('POST /api/auth/google/link', () => {
    it('requires authentication token', async () => {
      const res = await request(app)
        .post('/api/auth/google/link')
        .send({ credential: 'valid-token' });

      expect(res.statusCode).toBe(401);
    });

    it('allows an authenticated user to securely link their verified Google account', async () => {
      const user = await User.create({
        name: 'Auth Link User',
        mobile: '9876543202',
        password: 'password123',
        role: 'admin' // Even an admin can link when already authenticated with password!
      });

      const token = generateTestToken(user._id);

      jest.spyOn(googleAuthUtils, 'verifyGoogleToken').mockResolvedValue({
        sub: 'admin-google-sub-222',
        email: 'admin.personal@gmail.com',
        emailVerified: true,
        name: 'Admin Personal'
      });

      const res = await request(app)
        .post('/api/auth/google/link')
        .set('Authorization', `Bearer ${token}`)
        .send({ credential: 'admin-link-token' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.googleId).toBe('admin-google-sub-222');
      expect(res.body.user.email).toBe('admin.personal@gmail.com');
      expect(res.body.user.id).toBe(user._id.toString());
      expect(res.body.user.name).toBe('Auth Link User');
      expect(res.body.user.password).toBeUndefined();

      const updated = await User.findById(user._id);
      expect(updated.googleId).toBe('admin-google-sub-222');
      expect(updated.role).toBe('admin'); // Preserves admin role
    });

    it('rejects linking if the Google ID is already linked to another account', async () => {
      await User.create({
        name: 'Other User',
        email: 'other@gmail.com',
        googleId: 'already-taken-sub',
        role: 'customer'
      });

      const user = await User.create({
        name: 'Second User',
        mobile: '9876543203',
        password: 'password123',
        role: 'customer'
      });

      const token = generateTestToken(user._id);

      jest.spyOn(googleAuthUtils, 'verifyGoogleToken').mockResolvedValue({
        sub: 'already-taken-sub',
        email: 'other@gmail.com',
        emailVerified: true,
        name: 'Other'
      });

      const res = await request(app)
        .post('/api/auth/google/link')
        .set('Authorization', `Bearer ${token}`)
        .send({ credential: 'taken-token' });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already linked to another/i);
    });
  });
});
