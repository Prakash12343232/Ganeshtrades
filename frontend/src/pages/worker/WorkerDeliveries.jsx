import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getWorkerDeliveries, updateWorkerDeliveryStatus, workerCollectPayment } from '../../services/api';
import { FiPackage, FiMapPin, FiPhone, FiCheck, FiX, FiTruck, FiDollarSign, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  assigned:   'bg-blue-500/20 text-blue-300 border-blue-500/40',
  picked_up:  'bg-amber-500/20 text-amber-300 border-amber-500/40',
  on_the_way: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  delivered:  'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  failed:     'bg-rose-500/20 text-rose-300 border-rose-500/40',
};

const STATUS_LABELS = {
  assigned:   'Assigned',
  picked_up:  'Picked Up',
  on_the_way: 'On the Way',
  delivered:  'Delivered',
  failed:     'Failed',
};

const NEXT_ACTION = {
  assigned:   { label: 'Confirm Pickup', status: 'picked_up', icon: <FiPackage /> },
  picked_up:  { label: 'Start Delivery', status: 'on_the_way', icon: <FiTruck /> },
  on_the_way: null, // show Deliver + Failed buttons instead
  delivered:  null,
  failed:     null,
};

export default function WorkerDeliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // active | all | delivered
  const [actionModal, setActionModal] = useState(null); // { type: 'fail'|'pay'|'deliver', delivery }
  const [failureReason, setFailureReason] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);

  const loadDeliveries = async () => {
    setLoading(true);
    try {
      const statusParam = filter === 'active' ? undefined : filter === 'delivered' ? 'delivered' : undefined;
      const res = await getWorkerDeliveries(statusParam ? { status: statusParam } : {});
      let data = res.data.data || [];
      if (filter === 'active') {
        data = data.filter(d => !['delivered', 'failed'].includes(d.status));
      }
      setDeliveries(data);
    } catch {
      toast.error('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDeliveries(); }, [filter]);

  const doStatusUpdate = async (delivery, status, extra = {}) => {
    setSubmitting(true);
    try {
      await updateWorkerDeliveryStatus(delivery._id, { status, ...extra });
      toast.success(`Delivery marked as ${STATUS_LABELS[status]}`);
      setActionModal(null);
      setFailureReason('');
      loadDeliveries();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to update status');
    } finally {
      setSubmitting(false);
    }
  };

  const doPayment = async (delivery) => {
    if (!payAmount || isNaN(payAmount) || Number(payAmount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSubmitting(true);
    try {
      const key = `${delivery._id}-${Date.now()}`;
      await workerCollectPayment(delivery._id, {
        amount: Number(payAmount),
        paymentMethod: payMethod,
        idempotencyKey: key,
        notes: `Collected at door by ${delivery.deliveryPersonName}`
      });
      toast.success(`₹${payAmount} payment collected!`);
      setActionModal(null);
      setPayAmount('');
      loadDeliveries();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const outstanding = (order) => {
    if (!order) return 0;
    return Math.max(0, (order.finalAmount || 0));
  };

  return (
    <div className="space-y-4 pb-20 sm:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">My Deliveries</h1>
        <button onClick={loadDeliveries} className="p-2 text-slate-400 hover:text-purple-400 transition-colors">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 bg-slate-900 rounded-xl p-1">
        {[['active', 'Active'], ['all', 'All'], ['delivered', 'Completed']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${filter === val ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-400" />
        </div>
      ) : deliveries.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <FiPackage className="mx-auto text-4xl mb-3 opacity-40" />
          <p className="font-medium">No deliveries in this view</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deliveries.map(d => {
            const order = d.order || {};
            const customer = order.user || {};
            const nextAction = NEXT_ACTION[d.status];

            return (
              <div key={d._id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-white text-sm">#{order.orderNumber || '—'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">₹{order.finalAmount?.toFixed(2) || '0.00'}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${STATUS_COLORS[d.status]}`}>
                    {STATUS_LABELS[d.status]}
                  </span>
                </div>

                {/* Customer info */}
                {customer.name && (
                  <div className="flex items-center gap-4 text-xs text-slate-300">
                    <span className="flex items-center gap-1"><FiPhone className="text-purple-400" /> {customer.mobile}</span>
                    <span className="font-medium">{customer.name}</span>
                  </div>
                )}

                {/* Address */}
                {order.deliveryAddress && (
                  <div className="flex items-start gap-1.5 text-xs text-slate-400">
                    <FiMapPin className="text-purple-400 mt-0.5 shrink-0" />
                    <span>{[order.deliveryAddress.street, order.deliveryAddress.area, order.deliveryAddress.city].filter(Boolean).join(', ')}</span>
                  </div>
                )}

                {/* Failure reason if failed */}
                {d.status === 'failed' && d.failureReason && (
                  <div className="text-xs bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2 text-rose-300">
                    <FiAlertTriangle className="inline mr-1" /> {d.failureReason}
                  </div>
                )}

                {/* Actions */}
                {['assigned', 'picked_up'].includes(d.status) && nextAction && (
                  <button
                    onClick={() => doStatusUpdate(d, nextAction.status)}
                    disabled={submitting}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                    {nextAction.icon} {nextAction.label}
                  </button>
                )}

                {d.status === 'on_the_way' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setActionModal({ type: 'deliver', delivery: d })}
                      className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all">
                      <FiCheck /> Delivered
                    </button>
                    <button
                      onClick={() => setActionModal({ type: 'fail', delivery: d })}
                      className="py-2.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all">
                      <FiX /> Failed
                    </button>
                  </div>
                )}

                {/* Collect payment button (for cash orders not yet paid) */}
                {['on_the_way', 'delivered'].includes(d.status) && order.paymentStatus !== 'paid' && order.paymentMethod === 'cash' && (
                  <button
                    onClick={() => setActionModal({ type: 'pay', delivery: d })}
                    className="w-full py-2 border border-amber-500/50 text-amber-300 hover:bg-amber-500/10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all">
                    <FiDollarSign /> Collect Payment
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Action Modals ── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">

            {actionModal.type === 'fail' && (
              <>
                <h3 className="text-lg font-bold text-rose-400">Mark Delivery Failed</h3>
                <p className="text-sm text-slate-400">Please provide a reason for the failed delivery attempt.</p>
                <textarea
                  value={failureReason}
                  onChange={e => setFailureReason(e.target.value)}
                  placeholder="e.g. Customer not home, address not found..."
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 resize-none"
                />
                <div className="flex gap-2">
                  <button onClick={() => setActionModal(null)} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
                  <button
                    onClick={() => doStatusUpdate(actionModal.delivery, 'failed', { failureReason })}
                    disabled={submitting || failureReason.trim().length < 5}
                    className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold disabled:opacity-50 transition-all">
                    {submitting ? 'Saving...' : 'Confirm Failed'}
                  </button>
                </div>
              </>
            )}

            {actionModal.type === 'deliver' && (
              <>
                <h3 className="text-lg font-bold text-emerald-400">Confirm Delivery</h3>
                <p className="text-sm text-slate-400">Confirm that order <strong className="text-white">#{actionModal.delivery.order?.orderNumber}</strong> was delivered successfully.</p>
                <div className="flex gap-2">
                  <button onClick={() => setActionModal(null)} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
                  <button
                    onClick={() => doStatusUpdate(actionModal.delivery, 'delivered')}
                    disabled={submitting}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-50 transition-all">
                    {submitting ? 'Saving...' : '✓ Delivered'}
                  </button>
                </div>
              </>
            )}

            {actionModal.type === 'pay' && (
              <>
                <h3 className="text-lg font-bold text-amber-400">Collect Payment</h3>
                <p className="text-sm text-slate-400">
                  Order total: <strong className="text-white">₹{actionModal.delivery.order?.finalAmount?.toFixed(2)}</strong>
                </p>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder="Amount received (₹)"
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                <div className="flex gap-2">
                  {['cash', 'upi'].map(m => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${payMethod === m ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'border-slate-700 text-slate-400 hover:bg-slate-800'}`}>
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setActionModal(null)} className="flex-1 py-2 rounded-xl border border-slate-700 text-slate-400 hover:bg-slate-800 text-sm font-semibold transition-all">Cancel</button>
                  <button
                    onClick={() => doPayment(actionModal.delivery)}
                    disabled={submitting || !payAmount}
                    className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-bold disabled:opacity-50 transition-all">
                    {submitting ? 'Recording...' : 'Confirm Payment'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
