import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getOrder, cancelOrder, downloadInvoice, rescheduleOrder } from '../../services/api';
import toast from 'react-hot-toast';
import { FiDownload, FiX, FiCheck, FiClock, FiTruck, FiPackage, FiCalendar, FiZap, FiEdit3 } from 'react-icons/fi';

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered'];
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

  useEffect(() => {
    getOrder(id).then(res => setOrder(res.data.data)).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [id]);

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

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;
  if (!order) return <div className="text-center py-20 text-gray-500">Order not found</div>;

  const currentStep = STATUS_STEPS.indexOf(order.orderStatus);
  const canReschedule = !['processing', 'out_for_delivery', 'delivered', 'cancelled'].includes(order.orderStatus);

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
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Order #{order.orderNumber}</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-gray-400">{new Date(order.createdAt).toLocaleString('en-IN')}</p>
              {order.deliveryType === 'scheduled' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                  <FiCalendar className="w-3 h-3" /> Scheduled
                </span>
              )}
              {order.deliveryType === 'instant' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                  <FiZap className="w-3 h-3" /> Instant
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleDownloadInvoice} className="flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-200 transition-all" id="download-invoice">
              <FiDownload /> Invoice
            </button>
            {canReschedule && (
              <button onClick={() => setShowReschedule(!showReschedule)} className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-200 transition-all">
                <FiEdit3 /> Reschedule
              </button>
            )}
            {!['delivered', 'cancelled'].includes(order.orderStatus) && (
              <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 transition-all">
                <FiX /> Cancel
              </button>
            )}
          </div>
        </div>

        {/* Reschedule Panel */}
        {showReschedule && (
          <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-200 animate-fadeIn">
            <h3 className="text-sm font-bold text-indigo-800 mb-3 flex items-center gap-2"><FiCalendar /> Reschedule Delivery</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-indigo-700 mb-1">New Date</label>
                <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)} min={todayStr} max={maxDateStr}
                  className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-indigo-700 mb-1">New Time Slot</label>
                <select value={reschedSlot} onChange={e => setReschedSlot(e.target.value)}
                  className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">Select slot</option>
                  {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleReschedule} disabled={rescheduling} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
              <button onClick={() => setShowReschedule(false)} className="px-4 py-2 text-indigo-600 text-sm font-medium hover:bg-indigo-100 rounded-lg">Cancel</button>
            </div>
          </div>
        )}

        {/* Status Tracker */}
        {order.orderStatus !== 'cancelled' && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              {STATUS_STEPS.map((step, i) => (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i <= currentStep ? 'bg-primary-600 text-white shadow-lg' : 'bg-gray-200 text-gray-400'}`}>
                    {STEP_ICONS[step]}
                  </div>
                  <span className={`text-xs mt-2 capitalize ${i <= currentStep ? 'text-primary-600 font-medium' : 'text-gray-400'}`}>{step.replace(/_/g, ' ')}</span>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`h-0.5 w-full mt-[-22px] mb-[22px] ${i < currentStep ? 'bg-primary-600' : 'bg-gray-200'}`} style={{ position: 'absolute' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {order.orderStatus === 'cancelled' && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg text-red-600 text-sm">❌ Order cancelled. {order.cancelReason && `Reason: ${order.cancelReason}`}</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4">Order Items</h2>
          <div className="space-y-3">
            {order.items?.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center text-lg">📦</div>
                  <div><p className="font-medium text-sm">{item.name}</p><p className="text-xs text-gray-400">₹{item.price} × {item.quantity}</p></div>
                </div>
                <span className="font-bold text-gray-800">₹{item.total?.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t mt-4 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{order.totalAmount?.toFixed(2)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{order.discount?.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-lg text-gray-800 pt-2 border-t"><span>Total</span><span className="text-primary-600">₹{order.finalAmount?.toFixed(2)}</span></div>
          </div>
        </div>

        {/* Details Sidebar */}
        <div className="space-y-4">
          {/* Scheduled Delivery Info */}
          {order.deliveryType === 'scheduled' && order.scheduledDelivery && (
            <div className="bg-gradient-to-br from-primary-50 to-indigo-50 rounded-2xl border border-primary-100 p-6">
              <h3 className="font-bold text-primary-800 mb-3 flex items-center gap-2"><FiCalendar /> Scheduled Delivery</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium text-primary-700">{new Date(order.scheduledDelivery.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time Slot</span>
                  <span className="font-medium text-primary-700">{order.scheduledDelivery.timeSlot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Scheduled At</span>
                  <span className="text-gray-600 text-xs">{new Date(order.scheduledDelivery.scheduledAt).toLocaleString('en-IN')}</span>
                </div>
                {order.scheduledDelivery.rescheduledAt && (
                  <div className="pt-2 border-t border-primary-100">
                    <p className="text-xs text-amber-600 font-medium">🔄 Rescheduled on {new Date(order.scheduledDelivery.rescheduledAt).toLocaleString('en-IN')}</p>
                    {order.scheduledDelivery.originalDate && (
                      <p className="text-xs text-gray-400 mt-0.5">Original: {new Date(order.scheduledDelivery.originalDate).toLocaleDateString('en-IN')} ({order.scheduledDelivery.originalTimeSlot})</p>
                    )}
                  </div>
                )}
              </div>
              {order.isDeliveryLate && (
                <div className="mt-3 p-2 bg-red-100 rounded-lg text-xs text-red-700 font-medium">⚠️ This delivery is past its scheduled date!</div>
              )}
            </div>
          )}

          {/* Instant delivery badge */}
          {order.deliveryType === 'instant' && (
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><FiZap className="text-amber-600" /></div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Instant Delivery</p>
                <p className="text-xs text-amber-600">Deliver as soon as possible</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 mb-3">Payment</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="capitalize">{order.paymentMethod}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span>
                <span className={`capitalize font-medium ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>{order.paymentStatus}</span>
              </div>
              {order.distanceFromShop > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">Distance</span><span>{order.distanceFromShop} KM</span></div>
              )}
            </div>
          </div>

          {order.deliveryAddress && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-3">Delivery Address</h3>
              <p className="text-sm text-gray-600">
                {[order.deliveryAddress.street, order.deliveryAddress.area, order.deliveryAddress.city, order.deliveryAddress.pincode].filter(Boolean).join(', ')}
              </p>
            </div>
          )}

          {order.notes && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-2">Notes</h3>
              <p className="text-sm text-gray-600">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
