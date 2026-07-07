const AuditLog = require('../models/AuditLog');

const createAuditLog = async (userId, action, entity, entityId, details, req) => {
  try {
    await AuditLog.create({
      user: userId,
      action,
      entity,
      entityId,
      details,
      ipAddress: req?.ip || 'unknown',
      userAgent: req?.get('user-agent') || 'unknown'
    });
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

module.exports = { createAuditLog };
