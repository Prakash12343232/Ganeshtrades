/**
 * Decide whether a customer still needs to finish Google onboarding.
 *
 * Rules:
 * - Staff/admin/manager accounts are never gated by customer onboarding.
 * - New Google registrations are explicitly created with profileCompleted=false.
 * - Legacy Google-only accounts (created before this field existed) have no
 *   mobile number and must complete their profile before ordering.
 * - Local mobile/password accounts and accounts created before the field was
 *   introduced otherwise remain complete, so existing customers are not locked
 *   out of their order history or credit records.
 */
function needsProfileCompletion(user) {
  if (!user || user.role !== 'customer') return false;
  if (user.profileCompleted === false) return true;
  if (user.googleId && !user.mobile) return true;
  return false;
}

function isProfileComplete(user) {
  return !needsProfileCompletion(user);
}

module.exports = { needsProfileCompletion, isProfileComplete };
