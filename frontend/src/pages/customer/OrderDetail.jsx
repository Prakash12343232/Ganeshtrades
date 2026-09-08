import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getOrder, cancelOrder, downloadInvoice, rescheduleOrder, createPaymentOrder } from '../../services/api';
import toast from 'react-hot-toast';
import { FiDownload, FiX, FiCheck, FiClock, FiTruck, FiPackage, FiCalendar, FiZap, FiEdit3, FiCreditCard, FiSmartphone, FiGlobe } from 'react-icons/fi';
import ProductImage from '../../components/common/ProductImage';
import PaymentGatewayModal from '../../components/common/PaymentGatewayModal';

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered'];
const STEP_LABELS = {
  pending: 'Order Received',
  confirmed: 'Order Confirmed',
  processing: 'Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered'
};
const STEP_ICONS = { pending: <FiClock />, confirmed: <FiCheck />, processing: <FiPackage />, out_for_delivery: <FiTruck />, delivered: <FiCheck /> };

const TIME_SLOTS = [
  '8 AM - 10 AM', '10 AM - 12 PM', '12 PM - 2 PM',
  '2 PM - 4 PM', '4 PM - 6 PM', '6 PM - 8 PM', '8 PM - 10 PM'
];

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReschedule, setShowReschedule] = useState(false);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedSlot, setReschedSlot] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Online payment resume
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payingMode, setPayingMode] = useState('upi');
  const [pendingGateway, setPendingGateway] = useState(null);
  const [payingLoading, setPayingLoading] = useState(false);

  const refreshOrder = async () => {
    const { data } = await getOrder(id);
    setOrder(data.data);
  };

  useEffect(() => {
    getOrder(id).then(res => setOrder(res.data.data)).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [id]);

  const handlePayNow = async () => {
    if (!order) return;
    setPayingLoading(true);
    try {
      const { data } = await createPaymentOrder({ orderId: order._id, paymentMode: payingMode });
      setPendingGateway(data.data);
      setShowPaymentModal(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start payment');
    } finally { setPayingLoading(false); }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this order?')) return;
    try {
      await cancelOrder(id, { reason: 'Cancelled by customer' });
      toast.success('Order cancelled');
      const { data } = await getOrder(id);
      setOrder(data.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDownloadInvoice = async () => {
    try {
      const res = await downloadInvoice(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${order.orderNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Invoice downloaded!');
    } catch { toast.error('Failed to download invoice'); }
  };

  const handleReschedule = async () => {
    if (!reschedDate || !reschedSlot) return toast.error('Select both date and time slot');
    setRescheduling(true);
    try {
      await rescheduleOrder(id, { scheduledDate: reschedDate, timeSlot: reschedSlot });
      toast.success('Delivery rescheduled!');
      const { data } = await getOrder(id);
      setOrder(data.data);
      setShowReschedule(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to reschedule'); }
    finally { setRescheduling(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-mint-400"></div></div>;
  if (!order) return <div className="text-center py-20 text-slate-400">Order not found</div>;

  const currentStep = STATUS_STEPS.indexOf(order.orderStatus);
  const canReschedule = !['processing', 'out_for_delivery', 'delivered', 'cancelled'].includes(order.orderStatus);
  const payableOnline = !['paid', 'refunded'].includes(order.paymentStatus)
    && ['upi', 'card', 'bank_transfer'].includes(order.paymentMethod)
    && order.orderStatus !== 'cancelled';

  const PAYMENT_MODES = [
    { id: 'upi', label: 'UPI', icon: <FiSmartphone /> },
    { id: 'debit_card', label: 'Debit Card', icon: <FiCreditCard /> },
    { id: 'credit_card', label: 'Credit Card', icon: <FiCreditCard /> },
    { id: 'net_banking', label: 'Net Banking', icon: <FiGlobe /> },
  ];

  const getLocalYMD = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const todayStr = getLocalYMD(new Date());
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = getLocalYMD(maxDate);

  return (
    <div className="animate-fadeIn space-y-6">
      {/* Header */}
      <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Order #{order.orderNumber}</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-slate-400">{new Date(order.createdAt).toLocaleString('en-IN')}</p>
              {order.deliveryType === 'scheduled' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-mint-500/10 border border-mint-500/30 text-mint-400 text-xs font-medium rounded-full">
                  <FiCalendar className="w-3 h-3" /> Scheduled
                </span>
              )}
              {order.deliveryType === 'instant' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium rounded-full">
                  <FiZap className="w-3 h-3" /> Instant
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleDownloadInvoice} className="flex items-center gap-2 px-4 py-2 bg-navy-800 text-mint-300 border border-mint-500/30 rounded-xl text-sm font-semibold hover:bg-navy-750 transition-all" id="download-invoice">
              <FiDownload /> Invoice
            </button>
            {canReschedule && (
              <button onClick={() => setShowReschedule(!showReschedule)} className="flex items-center gap-2 px-4 py-2 bg-mint-500/10 text-mint-400 border border-mint-500/30 rounded-xl text-sm font-semibold hover:bg-mint-500/20 transition-all">
                <FiEdit3 /> Reschedule
              </button>
            )}
            {['pending', 'confirmed'].includes(order.orderStatus) && (
              <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-xl text-sm font-semibold hover:bg-rose-500/20 transition-all">
                <FiX /> Cancel
              </button>
            )}
          </div>
        </div>

        {/* Reschedule Panel */}
        {showReschedule && (
          <div className="mt-4 p-4 bg-navy-950 rounded-xl border border-mint-500/30 animate-fadeIn">
            <h3 className="text-sm font-bold text-mint-300 mb-3 flex items-center gap-2"><FiCalendar /> Reschedule Delivery</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">New Date</label>
                <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)} min={todayStr} max={maxDateStr}
                  className="w-full px-3 py-2 bg-navy-900 border border-navy-700 text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mint-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">New Time Slot</label>
                <select value={reschedSlot} onChange={e => setReschedSlot(e.target.value)}
                  className="w-full px-3 py-2 bg-navy-900 border border-navy-700 text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mint-500">
                  <option value="">Select slot</option>
                  {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleReschedule} disabled={rescheduling} className="px-4 py-2 bg-mint-500 text-navy-950 font-bold rounded-lg text-sm hover:bg-mint-400 disabled:opacity-50">
                {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
              <button onClick={() => setShowReschedule(false)} className="px-4 py-2 text-slate-300 text-sm font-medium hover:bg-navy-800 rounded-lg">Cancel</button>
            </div>
          </div>
        )}

        {/* Estimated Delivery Time Banner */}
        {order.orderStatus !== 'cancelled' && (
          <div className="mt-6 p-4 bg-gradient-to-r from-navy-850 via-navy-800 to-navy-900 border border-mint-500/30 rounded-2xl text-white flex items-center justify-between flex-wrap gap-3 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-mint-500/10 border border-mint-500/30 rounded-xl flex items-center justify-center text-xl text-mint-400">
                <FiClock />
              </div>
              <div>
                <p className="text-xs text-mint-300 font-medium">Estimated Delivery Time</p>
                <p className="text-lg font-bold text-white">
                  {order.estimatedDeliveryTime
                    ? new Date(order.estimatedDeliveryTime).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : order.scheduledDelivery
                      ? `${new Date(order.scheduledDelivery.date).toLocaleDateString('en-IN')} (${order.scheduledDelivery.timeSlot})`
                      : 'Calculating...'}
                </p>
              </div>
            </div>
            {order.scheduledDelivery?.timeSlot && (
              <span className="px-3.5 py-1 bg-mint-500/10 border border-mint-500/30 text-mint-300 rounded-full text-xs font-semibold">
                Slot: {order.scheduledDelivery.timeSlot}
              </span>
            )}
          </div>
        )}

        {/* Status Tracker */}
        {order.orderStatus !== 'cancelled' && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              {STATUS_STEPS.map((step, i) => (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i <= currentStep ? 'bg-mint-500 text-navy-950 shadow-lg shadow-mint-500/20 ring-4 ring-mint-500/20' : 'bg-navy-950 text-slate-600 border border-navy-800'}`}>
                    {STEP_ICONS[step]}
                  </div>
                  <span className={`text-xs mt-2 text-center font-semibold ${i <= currentStep ? 'text-mint-300' : 'text-slate-500'}`}>
                    {STEP_LABELS[step]}
                  </span>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`h-0.5 w-full mt-[-22px] mb-[22px] ${i < currentStep ? 'bg-mint-500' : 'bg-navy-800'}`} style={{ position: 'absolute' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {order.orderStatus === 'cancelled' && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-sm">❌ Order cancelled. {order.cancelReason && `Reason: ${order.cancelReason}`}</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 bg-navy-900 rounded-2xl border border-navy-800 p-6">
          <h2 className="font-bold text-white mb-4">Order Items</h2>
          <div className="space-y-3">
            {order.items?.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-navy-950 rounded-xl border border-navy-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-navy-900 rounded-lg border border-navy-800 overflow-hidden flex-shrink-0">
                    <ProductImage src={item.product?.image || item.image} alt={item.name} showFallbackLabel={false} />
                  </div>
                  <div><p className="font-medium text-sm text-white">{item.name}</p><p className="text-xs text-slate-400">₹{item.price} × {item.quantity}</p></div>
                </div>
                <span className="font-bold text-mint-400">₹{item.total?.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-navy-800 mt-4 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>₹{order.totalAmount?.toFixed(2)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-mint-400"><span>Discount</span><span>-₹{order.discount?.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-lg text-white pt-2 border-t border-navy-800"><span>Total</span><span className="text-mint-400">₹{order.finalAmount?.toFixed(2)}</span></div>
          </div>
        </div>

        {/* Details Sidebar */}
        <div className="space-y-4">
          {/* Scheduled Delivery Info */}
          {order.deliveryType === 'scheduled' && order.scheduledDelivery && (
            <div className="bg-navy-900 rounded-2xl border border-mint-500/30 p-6">
              <h3 className="font-bold text-mint-300 mb-3 flex items-center gap-2"><FiCalendar className="text-mint-400" /> Scheduled Delivery</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Date</span>
                  <span className="font-medium text-mint-300">{new Date(order.scheduledDelivery.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Time Slot</span>
                  <span className="font-medium text-mint-300">{order.scheduledDelivery.timeSlot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Scheduled At</span>
                  <span className="text-slate-400 text-xs">{new Date(order.scheduledDelivery.scheduledAt).toLocaleString('en-IN')}</span>
                </div>
                {order.scheduledDelivery.rescheduledAt && (
                  <div className="pt-2 border-t border-navy-800">
                    <p className="text-xs text-amber-300 font-medium">🔄 Rescheduled on {new Date(order.scheduledDelivery.rescheduledAt).toLocaleString('en-IN')}</p>
                    {order.scheduledDelivery.originalDate && (
                      <p className="text-xs text-slate-500 mt-0.5">Original: {new Date(order.scheduledDelivery.originalDate).toLocaleDateString('en-IN')} ({order.scheduledDelivery.originalTimeSlot})</p>
                    )}
                  </div>
                )}
              </div>
              {order.isDeliveryLate && (
                <div className="mt-3 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300 font-medium">⚠️ This delivery is past its scheduled date!</div>
              )}
            </div>
          )}

          {/* Instant delivery badge */}
          {order.deliveryType === 'instant' && (
            <div className="bg-navy-900 rounded-2xl border border-amber-500/30 p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center"><FiZap className="text-amber-400" /></div>
              <div>
                <p className="text-sm font-semibold text-amber-300">Instant Delivery</p>
                <p className="text-xs text-slate-400">Deliver as soon as possible</p>
              </div>
            </div>
          )}

          <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6">
            <h3 className="font-bold text-white mb-3">Payment</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Method</span><span className="capitalize text-slate-200">{order.paymentMethod}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Status</span>
                <span className={`capitalize font-medium ${order.paymentStatus === 'paid' ? 'text-mint-400' : 'text-amber-400'}`}>{order.paymentStatus}</span>
              </div>
              {order.distanceFromShop > 0 && (
                <div className="flex justify-between"><span className="text-slate-400">Distance</span><span className="text-slate-200">{order.distanceFromShop} KM</span></div>
              )}
            </div>
          </div>

          {payableOnline && (
            <div className="bg-navy-900 rounded-2xl border border-mint-500/40 p-6">
              <h3 className="font-bold text-mint-300 mb-1">💳 Payment Required</h3>
              <p className="text-xs text-slate-400 mb-4">Your order is on hold until payment is completed. Resume your payment to confirm it.</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {PAYMENT_MODES.map(mode => (
                  <button key={mode.id} type="button" onClick={() => setPayingMode(mode.id)}
                    className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      payingMode === mode.id ? 'bg-mint-500 text-navy-950 border-mint-500 font-bold shadow-sm' : 'bg-navy-950 text-slate-300 border-navy-800 hover:border-mint-500/30'
                    }`}>
                    {mode.icon} {mode.label}
                  </button>
                ))}
              </div>
              <button onClick={handlePayNow} disabled={payingLoading}
                className={`w-full py-3 rounded-xl font-bold text-navy-950 bg-mint-500 hover:bg-mint-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-mint-500/20`}>
                {payingLoading ? <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-navy-950"></span> : null}
                Pay Now ₹{order.finalAmount?.toFixed(2)}
              </button>
            </div>
          )}

          {order.deliveryAddress && (
            <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6">
              <h3 className="font-bold text-white mb-3">Delivery Address</h3>
              <p className="text-sm text-slate-300">
                {[order.deliveryAddress.street, order.deliveryAddress.area, order.deliveryAddress.city, order.deliveryAddress.pincode].filter(Boolean).join(', ')}
              </p>
            </div>
          )}

          {order.notes && (
            <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6">
              <h3 className="font-bold text-white mb-2">Notes</h3>
              <p className="text-sm text-slate-300">{order.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Online Payment Resume Modal */}
      {showPaymentModal && pendingGateway && (
        <PaymentGatewayModal
          open={showPaymentModal}
          onClose={() => { setShowPaymentModal(false); setPendingGateway(null); }}
          orderNumber={order.orderNumber}
          amount={order.finalAmount}
          paymentMode={payingMode}
          gatewayData={pendingGateway}
          onSuccess={async () => {
            setShowPaymentModal(false);
            setPendingGateway(null);
            await refreshOrder();
          }}
        />
      )}
    </div>
  );
}
