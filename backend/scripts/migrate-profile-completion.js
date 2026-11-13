/**
 * Backfill `profileCompleted` for existing accounts after the Google onboarding
 * migration. This script is additive and never deletes users, orders, payments,
 * credit records, roles, passwords, or Google links.
 *
 * Behaviour:
 * - Customers that already have a mobile number are marked profileCompleted=true.
 * - Legacy Google-only customers without a mobile number are marked
 *   profileCompleted=false so their next Google sign-in opens onboarding.
 * - All other accounts are left untouched.
 *
 * Safety: dry-run by default. Nothing is written unless --apply is passed.
 *
 * Usage:
 *   node scripts/migrate-profile-completion.js            # dry run
 *   node scripts/migrate-profile-completion.js --apply    # write
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const User = require('../models/User');

const APPLY = process.argv.includes('--apply');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Refusing to run.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB (${APPLY ? 'APPLY' : 'DRY RUN'})`);

  const completeIds = await User.find({
    role: 'customer',
    mobile: { $exists: true, $nin: [null, ''] },
    profileCompleted: { $ne: true }
  }).distinct('_id');

  const pendingIds = await User.find({
    role: 'customer',
    googleId: { $exists: true, $nin: [null, ''] },
    mobile: { $in: [null, ''] },
    profileCompleted: { $ne: false }
  }).distinct('_id');

  console.log(`Customers to mark complete: ${completeIds.length}`);
  console.log(`Legacy Google customers to mark pending: ${pendingIds.length}`);

  if (!APPLY) {
    console.log('No changes written. Re-run with --apply to persist.');
    await mongoose.disconnect();
    return;
  }

  let modified = 0;
  if (completeIds.length) {
    const result = await User.updateMany(
      { _id: { $in: completeIds }, role: 'customer' },
      { $set: { profileCompleted: true } },
      { runValidators: false }
    );
    modified += result.modifiedCount || 0;
  }

  if (pendingIds.length) {
    const result = await User.updateMany(
      { _id: { $in: pendingIds }, role: 'customer' },
      { $set: { profileCompleted: false } },
      { runValidators: false }
    );
    modified += result.modifiedCount || 0;
  }

  console.log(`Updated ${modified} customer record(s).`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Migration failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors
  }
  process.exit(1);
});
