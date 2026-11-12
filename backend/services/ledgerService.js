const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Settlement = require('../models/Settlement');
const Order = require('../models/Order');

const EPSILON = 0.005;

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const toObjectId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id));

const aggregateOptions = (session) => (session ? { session } : {});

const queryOptions = (session) => (session ? { session } : undefined);

async function getOrderPaidTotal(orderId, session) {
  const order = toObjectId(orderId);
  const rows = await Payment.aggregate([
    { $match: { order, paymentStatus: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ], aggregateOptions(session));
  return round2(rows[0]?.total);
}

async function getOrderSettledTotal(orderId, session) {
  const order = toObjectId(orderId);
  const rows = await Settlement.aggregate([
    { $match: { status: 'completed', allocations: { $elemMatch: { order } } } },
    { $unwind: '$allocations' },
    { $match: { 'allocations.order': order } },
    { $group: { _id: null, total: { $sum: '$allocations.amount' } } }
  ], aggregateOptions(session));
  return round2(rows[0]?.total);
}

async function getOrderOutstanding(order, session) {
  const paid = await getOrderPaidTotal(order._id, session);
  const settled = await getOrderSettledTotal(order._id, session);
  return round2(Math.max(0, round2(order.finalAmount) - paid - settled));
}

/**
 * Open (non-cancelled) orders with their true per-order outstanding balance,
 * ordered oldest-first so payments can be allocated FIFO.
 */
async function getOpenOrderBalances(userId, session) {
  const user = toObjectId(userId);

  const orderQuery = Order.find({ user, orderStatus: { $ne: 'cancelled' } }).sort({ createdAt: 1, _id: 1 });
  if (session) orderQuery.session(session);
  const orders = await orderQuery.lean();

  const paymentRows = await Payment.aggregate([
    { $match: { user, paymentStatus: 'completed' } },
    { $group: { _id: '$order', total: { $sum: '$amount' } } }
  ], aggregateOptions(session));

  const settlementRows = await Settlement.aggregate([
    { $match: { user, status: 'completed' } },
    { $unwind: '$allocations' },
    { $group: { _id: '$allocations.order', total: { $sum: '$allocations.amount' } } }
  ], aggregateOptions(session));

  const paidByOrder = new Map(paymentRows.map((row) => [String(row._id), round2(row.total)]));
  const settledByOrder = new Map(settlementRows.map((row) => [String(row._id), round2(row.total)]));

  return orders
    .map((order) => {
      const paid = paidByOrder.get(String(order._id)) || 0;
      const settled = settledByOrder.get(String(order._id)) || 0;
      const outstanding = round2(Math.max(0, round2(order.finalAmount) - paid - settled));
      return { ...order, paid, settled, outstanding };
    })
    .filter((order) => order.outstanding > EPSILON);
}

/**
 * Split an amount across a customer's open orders, oldest-first. The returned
 * allocations are not persisted; callers attach them to the Settlement.
 */
async function allocateToOrders(userId, amount, session) {
  const openOrders = await getOpenOrderBalances(userId, session);
  let remaining = round2(amount);
  const allocations = [];

  for (const order of openOrders) {
    if (remaining <= EPSILON) break;
    const take = round2(Math.min(remaining, order.outstanding));
    if (take <= EPSILON) continue;
    allocations.push({ order: order._id, amount: take, paymentMethod: order.paymentMethod });
    remaining = round2(remaining - take);
  }

  return { allocations, unallocated: remaining };
}

async function recomputeOrderPaymentStatus(order, session) {
  const paid = await getOrderPaidTotal(order._id, session);
  const settled = await getOrderSettledTotal(order._id, session);
  const total = round2(paid + settled);
  const finalAmount = round2(order.finalAmount);
  const nextStatus = total >= finalAmount - EPSILON ? 'paid' : total > EPSILON ? 'partial' : 'pending';

  if (order.paymentStatus !== nextStatus) {
    order.paymentStatus = nextStatus;
    await order.save(queryOptions(session));
  }

  return nextStatus;
}

module.exports = {
  EPSILON,
  round2,
  getOrderPaidTotal,
  getOrderSettledTotal,
  getOrderOutstanding,
  getOpenOrderBalances,
  allocateToOrders,
  recomputeOrderPaymentStatus
};
