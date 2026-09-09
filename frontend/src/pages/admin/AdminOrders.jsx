import { useState, useEffect, useCallback } from 'react';
import { getOrders, updateOrderStatus, rescheduleOrder, assignDelivery, createPayment } from '../../services/api';
import toast from 'react-hot-toast';
import { FiCheck, FiTruck, FiX, FiCalendar, FiZap, FiEdit3, FiUser, FiDollarSign } from 'react-icons/fi';
import { useTimeSlots } from '../../utils/useTimeSlots';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-emerald-100 text-emerald-700', out_for_delivery: 'bg-orange-100 text-orange-700',
  delivered: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700'
};

export default function AdminOrders() {
  const timeSlots = useTimeSlots();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filter, setFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [slotFilter, setSlotFilter] = useState('');

  // Reschedule state
  const [rescheduleOrderModal, setRescheduleOrderModal] = useState(null);
  const [reschedDate, setReschedDate] = useState('');
  const [reschedSlot, setReschedSlot] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Assign delivery state
  const [assignModal, setAssignModal] = useState(null);
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryMobile, setDeliveryMobile] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Record payment state
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payNotes, setPayNotes] = useState('');
  const [recording, setRecording] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchOrders = useCallback((nextPage = 1) => {
    const params = { page: nextPage, limit: 50 };
    if (filter) params.status = filter;
    if (deliveryFilter) params.deliveryType = deliveryFilter;
    if (dateFilter) params.scheduledDate = dateFilter;
    if (slotFilter) params.timeSlot = slotFilter;
    
    getOrders(params).then(res => {
      setOrders(prev => nextPage === 1 ? res.data.data : [...prev, ...res.data.data]);
      setPage(nextPage);
      setHasMore(nextPage * 50 < res.data.pagination.total);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [filter, deliveryFilter, dateFilter, slotFilter]);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  const loadMoreOrders = () => {
    fetchOrders(page + 1);
  };

  const handleStatusUpdate = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, { orderStatus: status });
      toast.success(`Order ${status}`);
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleCancelOrder = async (order) => {
    if (!confirm(`Cancel order #${order.orderNumber}?`)) return;
    try {
      await updateOrderStatus(order._id, { orderStatus: 'cancelled' });
      toast.success('Order cancelled');
      fetchOrders();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to cancel order'); }
  };

  const handleReschedule = async () => {
    if (!reschedDate || !reschedSlot) return toast.error('Select both date and time slot');
    setRescheduling(true);
    try {
      await rescheduleOrder(rescheduleOrderModal._id, { scheduledDate: reschedDate, timeSlot: reschedSlot });
      toast.success('Delivery rescheduled!');
      fetchOrders();
      setRescheduleOrderModal(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to reschedule'); }
    finally { setRescheduling(false); }
  };

  const openRescheduleModal = (order) => {
    setRescheduleOrderModal(order);
    if (order.scheduledDelivery?.date) {
      const d = new Date(order.scheduledDelivery.date);
      setReschedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      setReschedSlot(order.scheduledDelivery.timeSlot || '');
    } else {
      setReschedDate('');
      setReschedSlot('');
    }
  };

  const openAssignModal = (order) => {
    setAssignModal(order);
    setDeliveryName('');
    setDeliveryMobile('');
    setDeliveryNotes('');
  };

  const openPayModal = (order) => {
    setPayModal(order);
    setPayAmount(String(order.outstandingAmount ?? order.finalAmount));
    setPayMethod('cash');
    setPayNotes('');
  };

  const handleRecordPayment = async () => {
    if (!payModal) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Enter a valid payment amount');
    const outstanding = payModal.outstandingAmount ?? payModal.finalAmount;
    if (amount > outstanding) return toast.error(`Amount exceeds outstanding balance of ₹${outstanding}`);
    setRecording(true);
    try {
      await createPayment({
        userId: payModal.user._id,
        orderId: payModal._id,
        amount,
        paymentMethod: payMethod,
        ...(payNotes.trim() ? { notes: payNotes.trim() } : {})
      });
      toast.success('Payment recorded');
      fetchOrders();
      setPayModal(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to record payment'); }
    finally { setRecording(false); }
  };

  const handleAssignDelivery = async () => {
    if (!deliveryName.trim()) return toast.error('Enter delivery person name');
    if (!/^[6-9]\d{9}$/.test(deliveryMobile)) return toast.error('Enter a valid 10-digit mobile number');
    setAssigning(true);
    try {
      const payload = { orderId: assignModal._id, deliveryPersonName: deliveryName.trim(), deliveryPersonMobile: deliveryMobile };
      if (deliveryNotes.trim()) payload.notes = deliveryNotes.trim();
      await assignDelivery(payload);
      toast.success('Delivery assigned!');
      fetchOrders();
      setAssignModal(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to assign delivery'); }
    finally { setAssigning(false); }
  };

  return (
    <div className="animate-fadeIn relative">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Orders</h1>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-100 mb-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap gap-2 overflow-x-auto">
          {['', 'pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium capitalize transition-all ${filter === s ? 'bg-primary-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
              {s || 'All Statuses'}
            </button>
          ))}
        </div>
        
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-100">
          <div className="flex gap-2">
            <button onClick={() => setDeliveryFilter('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${deliveryFilter === '' ? 'bg-primary-100 text-primary-700' : 'bg-gray-50 text-gray-600'}`}>All Types</button>
            <button onClick={() => setDeliveryFilter('instant')} className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-all ${deliveryFilter === 'instant' ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-600'}`}><FiZap /> Instant</button>
            <button onClick={() => setDeliveryFilter('scheduled')} className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-all ${deliveryFilter === 'scheduled' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-50 text-gray-600'}`}><FiCalendar /> Scheduled</button>
          </div>

          {deliveryFilter === 'scheduled' && (
            <div className="flex gap-3 items-center animate-fadeIn">
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} 
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
              <select value={slotFilter} onChange={e => setSlotFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="">All Slots</option>
                {timeSlots.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {(dateFilter || slotFilter) && (
                <button onClick={() => { setDateFilter(''); setSlotFilter(''); }} className="text-xs text-red-500 hover:underline">Clear</button>
              )}
            </div>
          )}
        </div>
      </div>

      {loading ? <div className="text-center py-10">Loading...</div> : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Order #</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Customer</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Delivery</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Amount</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
              </tr></thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order._id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-medium">#{order.orderNumber}</td>
                    <td className="py-3 px-4">{order.user?.name}<br /><span className="text-xs text-gray-400">{order.user?.mobile}</span></td>
                    <td className="py-3 px-4">
                      {order.deliveryType === 'scheduled' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium text-xs bg-emerald-50 px-2 py-0.5 rounded-full mb-1">
                            <FiCalendar className="w-3 h-3" /> Scheduled
                          </span>
                          {order.scheduledDelivery?.date && (
                            <p className="text-xs text-gray-600">
                              {new Date(order.scheduledDelivery.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}<br/>
                              <span className="text-gray-400">{order.scheduledDelivery.timeSlot}</span>
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium text-xs bg-amber-50 px-2 py-0.5 rounded-full">
                          <FiZap className="w-3 h-3" /> Instant
                        </span>
                      )}
                      {order.deliveryAssigned && (
                        <p className="text-xs text-green-600 font-medium mt-1.5 flex items-center gap-1">
                          <FiTruck className="w-3 h-3" /> {order.deliveryPersonName}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-primary-600">₹{order.finalAmount}</p>
                      <p className={`capitalize text-[10px] font-medium mt-0.5 ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>{order.paymentMethod} • {order.paymentStatus}</p>
                    </td>
                    <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-[11px] font-medium capitalize ${STATUS_COLORS[order.orderStatus]}`}>{order.orderStatus?.replace(/_/g, ' ')}</span></td>
                    <td className="py-3 px-4 text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1.5 items-center">
                        {order.orderStatus === 'pending' && (
                          <button onClick={() => handleStatusUpdate(order._id, 'confirmed')} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" title="Confirm"><FiCheck className="w-4 h-4" /></button>
                        )}
                        {order.orderStatus === 'confirmed' && (
                          <button onClick={() => handleStatusUpdate(order._id, 'processing')} className="p-1.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100" title="Process"><FiCheck className="w-4 h-4" /></button>
                        )}
                        {order.orderStatus === 'processing' && (
                          <button onClick={() => handleStatusUpdate(order._id, 'out_for_delivery')} className="p-1.5 bg-orange-50 text-orange-600 rounded hover:bg-orange-100" title="Out for Delivery"><FiTruck className="w-4 h-4" /></button>
                        )}
                        {order.orderStatus === 'out_for_delivery' && (
                          <button onClick={() => handleStatusUpdate(order._id, 'delivered')} className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100" title="Delivered"><FiCheck className="w-4 h-4" /></button>
                        )}
                        {(!order.deliveryAssigned || order.deliveryStatus === 'failed') && !['delivered', 'cancelled'].includes(order.orderStatus) && (
                          <button onClick={() => openAssignModal(order)} className="p-1.5 bg-teal-50 text-teal-600 rounded hover:bg-teal-100" title="Assign Delivery"><FiUser className="w-4 h-4" /></button>
                        )}
                        {order.deliveryType === 'scheduled' && !['delivered', 'cancelled'].includes(order.orderStatus) && (
                          <button onClick={() => openRescheduleModal(order)} className="p-1.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200" title="Reschedule"><FiEdit3 className="w-4 h-4" /></button>
                        )}
                        {order.paymentStatus !== 'paid' && order.orderStatus !== 'cancelled' && (
                          <button onClick={() => openPayModal(order)} className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100" title="Record Payment"><FiDollarSign className="w-4 h-4" /></button>
                        )}
                        {!['delivered', 'cancelled'].includes(order.orderStatus) && (
                          <button onClick={() => handleCancelOrder(order)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100" title="Cancel Order"><FiX className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orders.length === 0 && <div className="text-center py-10 text-gray-400">No orders found</div>}
        </div>
      )}

      {hasMore && !loading && (
        <div className="text-center mt-4">
          <button onClick={loadMoreOrders} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
            Load More Orders
          </button>
        </div>
      )}

      {/* Record Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fadeIn">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-800 flex items-center gap-2"><FiDollarSign className="text-green-500" /> Record Payment for Order #{payModal.orderNumber}</h2>
              <button onClick={() => setPayModal(null)} className="text-gray-400 hover:text-gray-600"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-800">
                Customer: <span className="font-semibold">{payModal.user?.name}</span>{payModal.user?.mobile ? ` (${payModal.user.mobile})` : ''} — Order total: <span className="font-semibold">₹{payModal.finalAmount}</span>
                {((payModal.outstandingAmount ?? payModal.finalAmount) < payModal.finalAmount) && (
                  <> · Already paid: <span className="font-semibold">₹{payModal.paidAmount || 0}</span> · Outstanding: <span className="font-semibold">₹{payModal.outstandingAmount}</span></>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} min="1" max={(payModal.outstandingAmount ?? payModal.finalAmount)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400">
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea value={payNotes} onChange={e => setPayNotes(e.target.value)} rows="2" placeholder="Any payment reference details"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3 bg-gray-50">
              <button onClick={handleRecordPayment} disabled={recording} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
                {recording ? 'Recording...' : 'Record Payment'}
              </button>
              <button onClick={() => setPayModal(null)} className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Delivery Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fadeIn">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-800 flex items-center gap-2"><FiTruck className="text-teal-500" /> Assign Delivery for Order #{assignModal.orderNumber}</h2>
              <button onClick={() => setAssignModal(null)} className="text-gray-400 hover:text-gray-600"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-sm text-teal-800">
                Assigning a delivery person will move the order to <span className="font-semibold capitalize">processing</span> and notify the customer.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Person Name</label>
                <input type="text" value={deliveryName} onChange={e => setDeliveryName(e.target.value)} placeholder="e.g. Rahul Sharma"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                <input type="tel" value={deliveryMobile} onChange={e => setDeliveryMobile(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} rows="2" placeholder="Any instructions for the delivery person"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3 bg-gray-50">
              <button onClick={handleAssignDelivery} disabled={assigning} className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors">
                {assigning ? 'Assigning...' : 'Assign Delivery'}
              </button>
              <button onClick={() => setAssignModal(null)} className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleOrderModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fadeIn">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-800 flex items-center gap-2"><FiCalendar className="text-primary-500" /> Reschedule Order #{rescheduleOrderModal.orderNumber}</h2>
              <button onClick={() => setRescheduleOrderModal(null)} className="text-gray-400 hover:text-gray-600"><FiX className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800">
                Rescheduling will notify the customer. Current status: <span className="font-semibold capitalize">{rescheduleOrderModal.orderStatus.replace(/_/g, ' ')}</span>.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Delivery Date</label>
                <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)}
                  min={
                    (() => {
                      const d = new Date();
                      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    })()
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Time Slot</label>
                <select value={reschedSlot} onChange={e => setReschedSlot(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400">
                  <option value="">Select a time slot...</option>
                  {timeSlots.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3 bg-gray-50">
              <button onClick={handleReschedule} disabled={rescheduling} className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors">
                {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
              <button onClick={() => setRescheduleOrderModal(null)} className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
