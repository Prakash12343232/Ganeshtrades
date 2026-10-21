/**
 * /api/staff — Admin/Manager staff management
 * All routes require admin or manager authorization.
 * Managers cannot grant admin role; only admins can.
 */
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const StaffProfile = require('../models/StaffProfile');
const DeliveryPartner = require('../models/DeliveryPartner');
const { protect, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/auditLogger');
const { parsePagination } = require('../utils/security');
const { clientErrorMessage } = require('../utils/errors');

// All staff routes require authentication and admin or manager role
router.use(protect, authorize('admin', 'manager'));

// ─────────────────────────────────────────────────────────────────────────────
// STAFF PROFILES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/staff
 * Create a new staff User + StaffProfile.
 * Managers cannot create admin-role accounts.
 */
router.post('/', async (req, res) => {
  try {
    const {
      name, mobile, email, password,
      category, engagementType, partnerOrgId,
      employeeId, designation, joiningDate, notes
    } = req.body;

    // Security: managers cannot create admin accounts
    if (req.user.role === 'manager') {
      // Managers can only create staff
    }

    if (!name || !password) {
      return res.status(400).json({ success: false, message: 'Name and password are required' });
    }
    if (!mobile && !email) {
      return res.status(400).json({ success: false, message: 'Mobile or email is required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    // Check for duplicate mobile/email
    const mobileQuery = mobile ? { mobile } : null;
    const emailQuery = email ? { email: email.toLowerCase() } : null;
    const orQuery = [mobileQuery, emailQuery].filter(Boolean);
    if (orQuery.length > 0) {
      const existing = await User.findOne({ $or: orQuery });
      if (existing) {
        return res.status(400).json({ success: false, message: 'A user with this mobile or email already exists' });
      }
    }

    // External workers must be attached to an active partner organisation;
    // otherwise they could appear in the worker portal without a traceable
    // business owner.
    if (engagementType === 'external' && !partnerOrgId) {
      return res.status(400).json({ success: false, message: 'External staff must be assigned to a delivery partner' });
    }
    if (engagementType === 'external' && partnerOrgId) {
      const partner = await DeliveryPartner.findById(partnerOrgId);
      if (!partner || !partner.isActive) {
        return res.status(400).json({ success: false, message: 'Delivery partner not found or inactive' });
      }
    }

    // Create User with role=staff
    // The User pre-save hook will hash the password automatically
    const userDoc = {
      name: name.trim(),
      role: 'staff',
      isActive: true,
      authProvider: 'local',
      password
    };
    if (mobile) userDoc.mobile = mobile;
    if (email) userDoc.email = email.toLowerCase();

    const user = new User(userDoc);
    await user.save();


    // Create StaffProfile
    const profile = await StaffProfile.create({
      user: user._id,
      category: category || 'delivery',
      engagementType: engagementType || 'internal',
      partnerOrg: (engagementType === 'external' && partnerOrgId) ? partnerOrgId : null,
      employeeId,
      designation,
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
      notes,
      createdBy: req.user._id
    });

    await createAuditLog(req.user._id, 'staff_create', 'staff_profile', profile._id, { userId: user._id, category, engagementType }, req);

    res.status(201).json({
      success: true,
      data: {
        user: { _id: user._id, name: user.name, mobile: user.mobile, email: user.email, role: user.role, isActive: user.isActive },
        profile
      }
    });
  } catch (error) {
    console.error('❌ staff POST error:', error);
    res.status(400).json({ success: false, message: clientErrorMessage(error) });
  }
});

/**
 * GET /api/staff
 * List all staff with their profiles.
 */
router.get('/', async (req, res) => {
  try {
    const { category, engagementType, isActive, page = 1, limit = 50 } = req.query;
    const paging = parsePagination(page, limit, 100);

    const profileQuery = {};
    if (category) profileQuery.category = category;
    if (engagementType) profileQuery.engagementType = engagementType;
    if (isActive !== undefined) profileQuery.isActive = isActive === 'true';

    const total = await StaffProfile.countDocuments(profileQuery);
    const profiles = await StaffProfile.find(profileQuery)
      .populate('user', 'name mobile email role isActive avatar')
      .populate('partnerOrg', 'name mobile')
      .populate('createdBy', 'name')
      .sort('-createdAt')
      .skip(paging.skip)
      .limit(paging.limit);

    res.json({
      success: true,
      data: profiles,
      pagination: { total, page: paging.page, pages: Math.ceil(total / paging.limit) }
    });
  } catch (error) {
    console.error('❌ staff GET error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

/**
 * GET /api/staff/:id
 * Get one staff profile by StaffProfile ID.
 */
// This literal route must precede `/:id` so Express does not interpret
// "partners" as a StaffProfile ObjectId.
router.get('/partners', async (req, res) => {
  try {
    const { isActive, page = 1, limit = 50 } = req.query;
    const paging = parsePagination(page, limit, 100);
    const query = {};
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const total = await DeliveryPartner.countDocuments(query);
    const partners = await DeliveryPartner.find(query)
      .populate('createdBy', 'name')
      .sort('-createdAt')
      .skip(paging.skip)
      .limit(paging.limit);

    res.json({
      success: true,
      data: partners,
      pagination: { total, page: paging.page, pages: Math.ceil(total / paging.limit) }
    });
  } catch (error) {
    console.error('❌ partner GET error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const profile = await StaffProfile.findById(req.params.id)
      .populate('user', 'name mobile email role isActive avatar createdAt')
      .populate('partnerOrg', 'name mobile email address')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!profile) return res.status(404).json({ success: false, message: 'Staff profile not found' });

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('❌ staff GET/:id error:', error);
    res.status(500).json({ success: false, message: clientErrorMessage(error) });
  }
});

/**
 * PUT /api/staff/:id
 * Update staff profile fields. Managers cannot escalate to admin role.
 */
router.put('/:id', async (req, res) => {
  try {
    const { category, engagementType, partnerOrgId, employeeId, designation, joiningDate, notes, isActive } = req.body;

    const profile = await StaffProfile.findById(req.params.id).populate('user');
    if (!profile) return res.status(404).json({ success: false, message: 'Staff profile not found' });

    if (category !== undefined) profile.category = category;
    if (engagementType !== undefined) {
      profile.engagementType = engagementType;
      if (engagementType === 'external' && partnerOrgId) {
        const partner = await DeliveryPartner.findById(partnerOrgId);
        if (!partner || !partner.isActive) {
          return res.status(400).json({ success: false, message: 'Delivery partner not found or inactive' });
        }
        profile.partnerOrg = partnerOrgId;
      } else if (engagementType === 'internal') {
        profile.partnerOrg = null;
      }
    }
    if (employeeId !== undefined) profile.employeeId = employeeId;
    if (designation !== undefined) profile.designation = designation;
    if (joiningDate !== undefined) profile.joiningDate = joiningDate ? new Date(joiningDate) : null;
    if (notes !== undefined) profile.notes = notes;
    if (isActive !== undefined) {
      profile.isActive = Boolean(isActive);
      // Also sync User.isActive
      if (profile.user) {
        profile.user.isActive = Boolean(isActive);
        await profile.user.save();
      }
    }
    profile.updatedBy = req.user._id;
    await profile.save();

    const action = isActive === false ? 'staff_deactivate' : 'staff_update';
    await createAuditLog(req.user._id, action, 'staff_profile', profile._id, { isActive, category, engagementType }, req);

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('❌ staff PUT error:', error);
    res.status(400).json({ success: false, message: clientErrorMessage(error) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELIVERY PARTNERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/staff/partners
 * Create a new delivery partner organisation.
 */
router.post('/partners', async (req, res) => {
  try {
    const { name, contactPerson, mobile, email, address, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Partner name is required' });

    const partner = await DeliveryPartner.create({
      name: name.trim(),
      contactPerson,
      mobile,
      email: email ? email.toLowerCase() : undefined,
      address,
      notes,
      createdBy: req.user._id
    });

    await createAuditLog(req.user._id, 'partner_create', 'delivery_partner', partner._id, { name }, req);
    res.status(201).json({ success: true, data: partner });
  } catch (error) {
    console.error('❌ partner POST error:', error);
    res.status(400).json({ success: false, message: clientErrorMessage(error) });
  }
});

/**
 * PUT /api/staff/partners/:id
 * Update or deactivate a delivery partner.
 */
router.put('/partners/:id', async (req, res) => {
  try {
    const { name, contactPerson, mobile, email, address, notes, isActive } = req.body;
    const partner = await DeliveryPartner.findById(req.params.id);
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    if (name !== undefined) partner.name = name.trim();
    if (contactPerson !== undefined) partner.contactPerson = contactPerson;
    if (mobile !== undefined) partner.mobile = mobile;
    if (email !== undefined) partner.email = email ? email.toLowerCase() : undefined;
    if (address !== undefined) partner.address = address;
    if (notes !== undefined) partner.notes = notes;
    if (isActive !== undefined) partner.isActive = Boolean(isActive);
    await partner.save();

    const action = isActive === false ? 'partner_deactivate' : 'partner_update';
    await createAuditLog(req.user._id, action, 'delivery_partner', partner._id, { isActive }, req);
    res.json({ success: true, data: partner });
  } catch (error) {
    console.error('❌ partner PUT error:', error);
    res.status(400).json({ success: false, message: clientErrorMessage(error) });
  }
});

module.exports = router;
