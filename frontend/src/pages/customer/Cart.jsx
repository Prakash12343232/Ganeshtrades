import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { createOrder, checkServiceability, createPaymentOrder } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { FiTrash2, FiMinus, FiPlus, FiAlertTriangle, FiCheckCircle, FiClock, FiCalendar, FiZap, FiCreditCard, FiSmartphone, FiGlobe, FiLock } from 'react-icons/fi';
import ProductImage from '../../components/common/ProductImage';
import PaymentGatewayModal from '../../components/common/PaymentGatewayModal';
import { SLOT_ICON_MAP, getAvailableSlots } from '../../utils/timeSlots';
import { useTimeSlots } from '../../utils/useTimeSlots';

export default function Cart() {
  const { items, removeFromCart, updateQuantity, clearCart, totalAmount } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('online'); // 'online', 'cash', 'credit'
  const [onlineMode, setOnlineMode] = useState('upi'); // 'upi', 'debit_card', 'credit_card', 'net_banking'
  const [notes, setNotes] = useState('');
  const [serviceInfo, setServiceInfo] = useState(null);

  // Online Payment Simulation Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingOrderDetails, setPendingOrderDetails] = useState(null);

  // Scheduling state
  const [deliveryType, setDeliveryType] = useState('instant');
  const [scheduledDate, setScheduledDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');

  const verifyServiceability = useCallback(async () => {
    if (!user?.address?.lat || !user?.address?.lng) {
      setServiceInfo({ serviceable: false, message: 'Location not set.', distance: 0, radius: 15 });
      return;
    }
    try {
      const { data } = await checkServiceability(user.address.lat, user.address.lng);
      setServiceInfo(data.data);
    } catch { setServiceInfo(null); }
  }, [user?.address?.lat, user?.address?.lng]);

  useEffect(() => {
    if (items.length > 0 && user?.address?.lat && user?.address?.lng) verifyServiceability();
  }, [items.length, user?.address?.lat, user?.address?.lng, verifyServiceability]);

  const today = new Date();
  const getLocalYMD = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const todayStr = getLocalYMD(today);
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = getLocalYMD(maxDate);

  const timeSlots = useTimeSlots();

  const availableSlots = useMemo(() => getAvailableSlots(scheduledDate, todayStr, new Date(), timeSlots), [scheduledDate, todayStr, timeSlots]);

  useEffect(() => {
    if (timeSlot && !availableSlots.includes(timeSlot)) setTimeSlot('');
  }, [availableSlots, timeSlot]);

  const handlePlaceOrder = async () => {
    if (items.length === 0) return toast.error('Cart is empty');

    if (deliveryType === 'scheduled') {
      if (!scheduledDate) return toast.error('Please select a delivery date');
      if (!timeSlot) return toast.error('Please select a time slot');
    }

    if (user?.address?.lat && user?.address?.lng) {
      try {
        const { data } = await checkServiceability(user.address.lat, user.address.lng);
        if (!data.data.serviceable) { toast.error(data.data.message); setServiceInfo(data.data); return; }
      } catch { /* continue */ }
    }

    setLoading(true);
    let createdOrder = null;
    try {
      const backendPaymentMethod = paymentMethod === 'online'
        ? (onlineMode === 'upi' ? 'upi' : onlineMode === 'net_banking' ? 'bank_transfer' : 'card')
        : paymentMethod;

      const orderData = {
        items: items.map(i => ({ product: i.product, quantity: i.quantity })),
        paymentMethod: backendPaymentMethod,
        notes,
        deliveryAddress: user?.address,
        deliveryType,
        ...(deliveryType === 'scheduled' && { scheduledDate, timeSlot })
      };

      const { data } = await createOrder(orderData);
      createdOrder = data.data;
      // The order now owns these cart items. Clear immediately so a retry
      // after a failed gateway init (or closing the payment modal) can never
      // place a duplicate order.
      clearCart();

      // If online payment chosen, trigger gateway modal simulation
      if (paymentMethod === 'online') {
        const payRes = await createPaymentOrder({ orderId: createdOrder._id, paymentMode: onlineMode });
        setPendingOrderDetails({ order: createdOrder, gatewayData: payRes.data.data });
        setShowPaymentModal(true);
      } else {
        toast.success(deliveryType === 'scheduled' ? '📅 Order scheduled successfully!' : 'Order placed successfully!');
        navigate(`/orders/${createdOrder._id}`);
      }
    } catch (err) {
      if (createdOrder) {
        // The order was already placed, so taking the user to it (where the
        // payment can be resumed) beats telling them the order "failed".
        toast.error(err.response?.data?.message || 'Order placed; payment could not be started. Resume payment from the order page.');
        navigate(`/orders/${createdOrder._id}`);
      } else {
        toast.error(err.response?.data?.message || 'Failed to place order');
      }
    } finally { setLoading(false); }
  };

  const handlePaymentSuccess = async () => {
    if (!pendingOrderDetails) return;
    const { order } = pendingOrderDetails;
    setShowPaymentModal(false);
    clearCart();
    navigate(`/orders/${order._id}`);
  };

  // Show the empty-cart view unless the gateway modal is open — the order was
  // created and placed, so the modal (payment resume UPI/card/bank flow) must
  // stay visible even though the cart has already been cleared.
  if (items.length === 0 && !showPaymentModal) {
    return (
      <div className="text-center py-20 animate-fadeIn">
        <span className="text-6xl mb-4 block">🛒</span>
        <h2 className="text-2xl font-bold text-white mb-2">Your cart is empty</h2>
        <p className="text-slate-400 mb-6">Add some products to get started</p>
        <button onClick={() => navigate('/products')} className="px-6 py-3 bg-mint-500 text-navy-950 rounded-xl font-bold hover:bg-mint-400 transition-all shadow-lg shadow-mint-500/20">Browse Products</button>
      </div>
    );
  }

  const isOutOfRange = serviceInfo && !serviceInfo.serviceable;
  const noLocation = !user?.address?.lat || !user?.address?.lng;
  const scheduleIncomplete = deliveryType === 'scheduled' && (!scheduledDate || !timeSlot);

  return (
    <div className="animate-fadeIn relative">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Shopping Cart ({items.length} items)</h1>

      {/* Serviceability Alerts */}
      {(isOutOfRange || noLocation) && (
        <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${noLocation ? 'bg-amber-500/10 border-amber-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
          <FiAlertTriangle className={`mt-0.5 flex-shrink-0 ${noLocation ? 'text-amber-400' : 'text-rose-400'}`} />
          <div>
            <p className={`font-semibold text-sm ${noLocation ? 'text-amber-300' : 'text-rose-300'}`}>{noLocation ? 'Location Required' : 'Outside Delivery Area'}</p>
            <p className={`text-xs mt-0.5 ${noLocation ? 'text-amber-400/80' : 'text-rose-400/80'}`}>
              {noLocation ? 'Please update your profile with location access to place orders.' : serviceInfo?.message}
            </p>
          </div>
        </div>
      )}

      {serviceInfo?.serviceable && (
        <div className="mb-6 p-3 rounded-xl border bg-mint-500/10 border-mint-500/30 flex items-center gap-2">
          <FiCheckCircle className="text-mint-400 flex-shrink-0" />
          <span className="text-sm text-mint-300 font-medium">Delivery available — {serviceInfo.distance} KM from Ganesh Trades</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(item => (
            <div key={item.product} className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-mint-500/30 transition-all shadow-sm">
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <div className="w-16 h-16 bg-slate-100 dark:bg-navy-950 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-slate-200 dark:border-navy-800">
                  <ProductImage src={item.image} alt={item.name} showFallbackLabel={false} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm truncate">{item.name}</h3>
                  <p className="text-mint-600 dark:text-mint-400 font-bold">₹{item.price}</p>
                  {item.stock != null && item.quantity >= item.stock && item.stock > 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">Max available stock reached ({item.stock})</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-navy-800">
                <div className="flex items-center border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-navy-950">
                  <button onClick={() => updateQuantity(item.product, item.quantity - 1)} aria-label="Decrease quantity" className="p-2 hover:bg-slate-200 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 transition-colors"><FiMinus className="w-3 h-3" /></button>
                  <span className="px-3 text-sm font-bold text-slate-900 dark:text-white">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.product, item.quantity + 1)}
                    disabled={item.stock != null && item.quantity >= item.stock}
                    aria-label="Increase quantity"
                    className="p-2 hover:bg-slate-200 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  ><FiPlus className="w-3 h-3" /></button>
                </div>
                <span className="font-bold text-mint-600 dark:text-mint-400 min-w-20 text-right">₹{(item.price * item.quantity).toFixed(2)}</span>
                <button onClick={() => removeFromCart(item.product)} aria-label="Remove item" className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"><FiTrash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary & Payment Gateway */}
        <div className="space-y-4">
          {/* Delivery Option */}
          <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2"><FiClock className="text-mint-600 dark:text-mint-400" /> Delivery Option</h2>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeliveryType('instant')}
                className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  deliveryType === 'instant'
                    ? 'border-mint-500 dark:border-mint-400 bg-mint-50/80 dark:bg-mint-500/10 shadow-sm ring-1 ring-mint-500/20'
                    : 'border-slate-200 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950 hover:bg-slate-100 dark:hover:bg-navy-850 hover:border-slate-300 dark:hover:border-navy-700'
                }`}>
                <FiZap className={`mx-auto mb-1 ${deliveryType === 'instant' ? 'text-mint-600 dark:text-mint-400' : 'text-slate-500 dark:text-slate-400'}`} />
                <p className={`text-sm font-bold ${deliveryType === 'instant' ? 'text-slate-950 dark:text-mint-300' : 'text-slate-800 dark:text-slate-300'}`}>Deliver Now</p>
                <p className={`text-xs mt-0.5 ${deliveryType === 'instant' ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>ASAP delivery</p>
              </button>
              <button type="button" onClick={() => setDeliveryType('scheduled')}
                className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  deliveryType === 'scheduled'
                    ? 'border-mint-500 dark:border-mint-400 bg-mint-50/80 dark:bg-mint-500/10 shadow-sm ring-1 ring-mint-500/20'
                    : 'border-slate-200 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950 hover:bg-slate-100 dark:hover:bg-navy-850 hover:border-slate-300 dark:hover:border-navy-700'
                }`}>
                <FiCalendar className={`mx-auto mb-1 ${deliveryType === 'scheduled' ? 'text-mint-600 dark:text-mint-400' : 'text-slate-500 dark:text-slate-400'}`} />
                <p className={`text-sm font-bold ${deliveryType === 'scheduled' ? 'text-slate-950 dark:text-mint-300' : 'text-slate-800 dark:text-slate-300'}`}>Schedule</p>
                <p className={`text-xs mt-0.5 ${deliveryType === 'scheduled' ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>Pick date & time</p>
              </button>
            </div>

            {deliveryType === 'scheduled' && (
              <div className="mt-4 space-y-3 animate-fadeIn">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Delivery Date</label>
                  <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                    min={todayStr} max={maxDateStr}
                    className="w-full px-3 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-mint-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Time Slot</label>
                  {availableSlots.length === 0 ? (
                    <p className="text-xs text-rose-600 dark:text-rose-400 p-2.5 bg-rose-50 dark:bg-rose-500/10 rounded-lg border border-rose-200 dark:border-rose-500/20 font-medium">No slots available for today. Please choose a future date.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                      {availableSlots.map(slot => (
                        <button key={slot} type="button" onClick={() => setTimeSlot(slot)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all cursor-pointer ${
                            timeSlot === slot
                              ? 'bg-mint-50 dark:bg-mint-500/10 border-mint-500 dark:border-mint-400 border-2 text-slate-950 dark:text-mint-300 font-bold'
                              : 'border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950 text-slate-700 dark:text-slate-300 hover:border-mint-500/30'
                          }`}>
                          <span>{SLOT_ICON_MAP[slot] || '🕒'}</span>
                          <span>{slot}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Payment Method Selection */}
          <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 p-5 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-navy-800 pb-2">Payment Method</h2>

            <div className="space-y-2.5">
              {/* Online Payment Option */}
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                paymentMethod === 'online'
                  ? 'border-mint-500 dark:border-mint-400 bg-mint-50/80 dark:bg-mint-500/10 shadow-sm ring-1 ring-mint-500/20 dark:ring-transparent'
                  : 'border-slate-200 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950 hover:bg-slate-100 dark:hover:bg-navy-850 hover:border-slate-300 dark:hover:border-navy-700'
              }`}>
                <input type="radio" name="payment" value="online" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} className="mt-1 text-mint-600 focus:ring-mint-500 h-4 w-4" />
                <div className="flex-1">
                  <span className={`text-sm font-bold flex items-center gap-1.5 ${
                    paymentMethod === 'online' ? 'text-slate-950 dark:text-white' : 'text-slate-800 dark:text-slate-200'
                  }`}>
                    <FiLock className={paymentMethod === 'online' ? 'text-mint-600 dark:text-mint-400' : 'text-slate-500 dark:text-slate-400'} /> Online Payment Gateway
                  </span>
                  <p className={`text-xs mt-0.5 ${
                    paymentMethod === 'online' ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-400'
                  }`}>Instant confirmation via UPI, Card, Net Banking</p>

                  {/* Sub-modes for Online */}
                  {paymentMethod === 'online' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-mint-200/60 dark:border-navy-800 animate-fadeIn">
                      {[
                        { id: 'upi', label: 'UPI / GPay / PhonePe', icon: <FiSmartphone /> },
                        { id: 'debit_card', label: 'Debit Card', icon: <FiCreditCard /> },
                        { id: 'credit_card', label: 'Credit Card', icon: <FiCreditCard /> },
                        { id: 'net_banking', label: 'Net Banking', icon: <FiGlobe /> },
                      ].map(mode => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setOnlineMode(mode.id)}
                          className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                            onlineMode === mode.id
                              ? 'bg-mint-500 text-slate-950 border-mint-500 font-bold shadow-sm ring-1 ring-mint-600/30'
                              : 'bg-white dark:bg-navy-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-navy-800 hover:border-mint-500/40 hover:bg-slate-50 dark:hover:bg-navy-800'
                          }`}
                        >
                          <span className={onlineMode === mode.id ? 'text-slate-950' : 'text-mint-600 dark:text-mint-400'}>{mode.icon}</span>
                          <span>{mode.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>

              {/* Cash on Delivery */}
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                paymentMethod === 'cash'
                  ? 'border-mint-500 dark:border-mint-400 bg-mint-50/80 dark:bg-mint-500/10 shadow-sm ring-1 ring-mint-500/20 dark:ring-transparent'
                  : 'border-slate-200 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950 hover:bg-slate-100 dark:hover:bg-navy-850 hover:border-slate-300 dark:hover:border-navy-700'
              }`}>
                <input type="radio" name="payment" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="mt-1 text-mint-600 focus:ring-mint-500 h-4 w-4" />
                <div>
                  <span className={`text-sm font-bold flex items-center gap-1.5 ${
                    paymentMethod === 'cash' ? 'text-slate-950 dark:text-white' : 'text-slate-800 dark:text-slate-200'
                  }`}>💵 Cash on Delivery</span>
                  <p className={`text-xs mt-0.5 ${
                    paymentMethod === 'cash' ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-400'
                  }`}>Pay cash when order arrives</p>
                </div>
              </label>

              {/* Credit (Khata) System */}
              <label className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                paymentMethod === 'credit'
                  ? 'border-mint-500 dark:border-mint-400 bg-mint-50/80 dark:bg-mint-500/10 shadow-sm ring-1 ring-mint-500/20 dark:ring-transparent'
                  : 'border-slate-200 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-950 hover:bg-slate-100 dark:hover:bg-navy-850 hover:border-slate-300 dark:hover:border-navy-700'
              }`}>
                <input type="radio" name="payment" value="credit" checked={paymentMethod === 'credit'} onChange={() => setPaymentMethod('credit')} className="mt-1 text-mint-600 focus:ring-mint-500 h-4 w-4" />
                <div>
                  <span className={`text-sm font-bold flex items-center gap-1.5 ${
                    paymentMethod === 'credit' ? 'text-slate-950 dark:text-white' : 'text-slate-800 dark:text-slate-200'
                  }`}>📖 Credit (Khata Account)</span>
                  <p className={`text-xs mt-0.5 ${
                    paymentMethod === 'credit' ? 'text-slate-700 dark:text-slate-300 font-medium' : 'text-slate-500 dark:text-slate-400'
                  }`}>Add to your monthly Khata balance</p>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Order Notes (Optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-mint-500 placeholder-slate-400 dark:placeholder-slate-500" rows={2} placeholder="Instructions for seller/delivery rider..." />
            </div>

            <div className="border-t border-slate-200 dark:border-navy-800 pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Subtotal</span><span className="font-semibold text-slate-900 dark:text-slate-200">₹{totalAmount.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400"><span>Delivery</span><span className="text-mint-600 dark:text-mint-400 font-bold">Free</span></div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-white text-lg pt-2 border-t border-slate-200 dark:border-navy-800"><span>Total Payable</span><span className="text-mint-600 dark:text-mint-400">₹{totalAmount.toFixed(2)}</span></div>
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={loading || isOutOfRange || noLocation || scheduleIncomplete}
              className={`w-full mt-2 py-3.5 rounded-xl font-extrabold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 ${
                isOutOfRange || noLocation
                  ? 'bg-rose-600 text-white cursor-not-allowed shadow-rose-600/20'
                  : scheduleIncomplete
                    ? 'bg-slate-200 dark:bg-navy-800 text-slate-500 dark:text-slate-400 cursor-not-allowed border border-slate-300 dark:border-navy-700'
                    : loading
                      ? 'bg-mint-500 text-slate-950 cursor-wait shadow-mint-500/20'
                      : 'bg-mint-500 hover:bg-mint-400 active:scale-[0.99] text-slate-950 shadow-mint-500/25 cursor-pointer'
              }`}
              id="checkout-btn"
            >
              {loading ? (
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent"></span>
              ) : isOutOfRange || noLocation ? (
                <FiAlertTriangle className="w-4 h-4" />
              ) : scheduleIncomplete ? (
                <FiCalendar className="w-4 h-4" />
              ) : paymentMethod === 'online' ? (
                <FiLock className="w-4 h-4" />
              ) : null}

              {loading
                ? (paymentMethod === 'online' ? 'Initiating Payment...' : 'Placing Order...')
                : isOutOfRange
                  ? 'Outside Delivery Area'
                  : noLocation
                    ? 'Location Required to Order'
                    : scheduleIncomplete
                      ? 'Select Delivery Date & Time'
                      : paymentMethod === 'online'
                        ? `Pay ₹${totalAmount.toFixed(2)} Online`
                        : 'Place Order'}
            </button>
          </div>
        </div>
      </div>

      {/* Online Payment Simulated Gateway Modal */}
      {showPaymentModal && pendingOrderDetails && (
        <PaymentGatewayModal
          open={showPaymentModal}
          onClose={() => {
            // The order exists already; closing the modal drops the user onto
            // the order page where the aborted payment can be resumed.
            const orderId = pendingOrderDetails.order._id;
            setShowPaymentModal(false);
            setPendingOrderDetails(null);
            navigate(`/orders/${orderId}`);
          }}
          orderNumber={pendingOrderDetails.order.orderNumber}
          amount={pendingOrderDetails.order.finalAmount}
          paymentMode={onlineMode}
          gatewayData={pendingOrderDetails.gatewayData}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
