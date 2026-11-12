/**
 * Backfill per-order attribution for settlements created before Phase 1.
 *
 * Phase 1 added `Settlement.allocations` so cancellations and (later) aging can
 * tell which invoice a settlement paid. Historical settlements reduced the
 * customer ledger without recording that attribution, so this script replays
 * each affected customer's payments and settlements chronologically and
 * allocates every unattributed settlement to the oldest open orders (FIFO).
 *
 * Safety:
 * - Dry-run by default. Nothing is written unless `--apply` is passed.
 * - Only settlements with an empty/missing `allocations` array are written.
 * - Existing allocations are treated as authoritative and are never rewritten.
 * - Cancelled orders are skipped; any amount that cannot be attributed is
 *   reported, not forced onto an order.
 *
 * Usage:
 *   node scripts/backfill_settlement_allocations.js            # dry run
 *   node scripts/backfill_settlement_allocations.js --apply    # write
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Settlement = require('../models/Settlement');

const EPSILON = 0.005;
const APPLY = process.argv.includes('--apply');
const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const timeOf = (doc) => (doc.createdAt ? new Date(doc.createdAt).getTime() : 0);

async function backfillUser(userId) {
  const orders = await Order.find({ user: userId }).sort({ createdAt: 1, _id: 1 }).lean();
  if (!orders.length) return { updated: 0, unallocated: 0 };

  const payments = await Payment.find({ user: userId, paymentStatus: 'completed' }).lean();
  const settlements = await Settlement.find({ user: userId, status: 'completed' });

  const paidByOrder = new Map();
  const settledByOrder = new Map();

  const events = [
    ...payments.map((doc) => ({ kind: 'payment', doc })),
    ...settlements.map((doc) => ({ kind: 'settlement', doc }))
  ].sort((a, b) => (timeOf(a.doc) - timeOf(b.doc)) || String(a.doc._id).localeCompare(String(b.doc._id)));

  let updated = 0;
  let unallocatedTotal = 0;

  for (const event of events) {
    if (event.kind === 'payment') {
      const key = String(event.doc.order);
      paidByOrder.set(key, round2((paidByOrder.get(key) || 0) + round2(event.doc.amount)));
      continue;
    }

    const settlement = event.doc;
    if (settlement.allocations && settlement.allocations.length) {
      for (const allocation of settlement.allocations) {
        const key = String(allocation.order);
        settledByOrder.set(key, round2((settledByOrder.get(key) || 0) + round2(allocation.amount)));
      }
      continue;
    }

    let remaining = round2(settlement.amount);
    const allocations = [];

    for (const order of orders) {
      if (remaining <= EPSILON) break;
      if (order.orderStatus === 'cancelled') continue;

      const key = String(order._id);
      const paid = paidByOrder.get(key) || 0;
      const settled = settledByOrder.get(key) || 0;
      const outstanding = round2(Math.max(0, round2(order.finalAmount) - paid - settled));
      if (outstanding <= EPSILON) continue;

      const take = round2(Math.min(remaining, outstanding));
      allocations.push({ order: order._id, amount: take });
      settledByOrder.set(key, round2(settled + take));
      remaining = round2(remaining - take);
    }

    unallocatedTotal = round2(unallocatedTotal + remaining);
    const detail = allocations.map((a) => `${a.order}=₹${a.amount}`).join(', ') || 'no open orders';
    const leftover = remaining > EPSILON ? ` (unallocated ₹${remaining})` : '';
    console.log(`  settlement ${settlement._id} ₹${settlement.amount} -> ${detail}${leftover}`);

    if (allocations.length) {
      if (APPLY) {
        await Settlement.updateOne({ _id: settlement._id }, { $set: { allocations } });
      }
      updated += 1;
    }
  }

  return { updated, unallocated: unallocatedTotal };
}

async function main() {
  console.log(APPLY ? 'MODE: APPLY (writing allocations)' : 'MODE: DRY RUN (pass --apply to write)');
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected');

  const userIds = await Settlement.distinct('user', {
    status: 'completed',
    $or: [{ allocations: { $exists: false } }, { allocations: { $size: 0 } }]
  });

  console.log(`Found ${userIds.length} customer(s) with unattributed settlements.`);

  let totalUpdated = 0;
  let totalUnallocated = 0;
  for (const userId of userIds) {
    console.log(`\nCustomer ${userId}`);
    const result = await backfillUser(userId);
    totalUpdated += result.updated;
    totalUnallocated = round2(totalUnallocated + result.unallocated);
  }

  console.log('\n──────────────────────────────────────────────');
  console.log(`Settlements ${APPLY ? 'backfilled' : 'to backfill'}: ${totalUpdated}`);
  console.log(`Amount that could not be attributed: ₹${totalUnallocated}`);
  if (!APPLY) console.log('No changes written. Re-run with --apply to persist.');
  console.log('✅ Done');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  });
