import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { createOrder, checkServiceability, createPaymentOrder, verifyPayment } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { useState, useEffect, useMemo } from 'react';
import { FiTrash2, FiMinus, FiPlus, FiShoppingBag, FiAlertTriangle, FiCheckCircle, FiNavigation, FiMapPin, FiClock, FiCalendar, FiZap, FiCreditCard, FiSmartphone, FiGlobe, FiLock, FiCheck } from 'react-icons/fi';
import ProductImage from '../../components/common/ProductImage';

const TIME_SLOTS = [
  '8 AM - 10 AM', '10 AM - 12 PM', '12 PM - 2 PM',
  '2 PM - 4 PM', '4 PM - 6 PM', '6 PM - 8 PM', '8 PM - 10 PM'
];

const SLOT_ICONS = ['🌅', '☀️', '🌤️', '⛅', '🌇', '🌆', '🌙'];

function parseSlotStartHour(slot) {
  const match = slot.match(/^(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hour = parseInt(match[1]);
  const period = match[2].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour;
}

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
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [pendingOrderDetails, setPendingOrderDetails] = useState(null);
  const [cardForm, setCardForm] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [upiId, setUpiId] = useState('');
  const [selectedBank, setSelectedBank] = useState('');

  // Scheduling state
  const [deliveryType, setDeliveryType] = useState('instant');
  const [scheduledDate, setScheduledDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');

  useEffect(() => {
    if (items.length > 0 && user?.address?.lat && user?.address?.lng) verifyServiceability();
  }, []);

  const verifyServiceability = async () => {
    if (!user?.address?.lat || !user?.address?.lng) {
      setServiceInfo({ serviceable: false, message: 'Location not set.', distance: 0, radius: 15 });
      return;
    }
    try {
      const { data } = await checkServiceability(user.address.lat, user.address.lng);
      setServiceInfo(data.data);
    } catch { setServiceInfo(null); }
  };

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

  const availableSlots = useMemo(() => {
    if (!scheduledDate || scheduledDate !== todayStr) return TIME_SLOTS;
    const now = new Date();
    const currentHour = now.getHours();
    return TIME_SLOTS.filter(slot => parseSlotStartHour(slot) > currentHour);
  }, [scheduledDate, todayStr]);

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
      const createdOrder = data.data;

      // If online payment chosen, trigger gateway modal simulation
      if (paymentMethod === 'online') {
        const payRes = await createPaymentOrder({ orderId: createdOrder._id, paymentMode: onlineMode });
        setPendingOrderDetails({ order: createdOrder, gatewayData: payRes.data.data });
        setShowPaymentModal(true);
      } else {
        clearCart();
        toast.success(deliveryType === 'scheduled' ? '📅 Order scheduled successfully!' : 'Order placed successfully!');
        navigate(`/orders/${createdOrder._id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally { setLoading(false); }
  };

  const handleSimulatedPayment = async () => {
    if (!pendingOrderDetails) return;
    setPaymentProcessing(true);

    try {
      const { gatewayData, order } = pendingOrderDetails;
      // Simulate 1.5s gateway delay
      await new Promise(r => setTimeout(r, 1500));

      // Call verify endpoint
      await verifyPayment({
        gatewayOrderId: gatewayData.gatewayOrderId,
        gatewayPaymentId: 'pay_' + Math.random().toString(36).substring(2, 14),
        gatewaySignature: 'sig_' + Math.random().toString(36).substring(2, 18)
      });

      clearCart();
      setShowPaymentModal(false);
      toast.success('💳 Payment successful! Order confirmed.');
      navigate(`/orders/${order._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment verification failed');
    } finally {
      setPaymentProcessing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-20 animate-fadeIn">
        <span className="text-6xl mb-4 block">🛒</span>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Add some products to get started</p>
        <button onClick={() => navigate('/products')} className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all shadow-md">Browse Products</button>
      </div>
    );
  }

  const isOutOfRange = serviceInfo && !serviceInfo.serviceable;
  const noLocation = !user?.address?.lat || !user?.address?.lng;
  const scheduleIncomplete = deliveryType === 'scheduled' && (!scheduledDate || !timeSlot);

  return (
    <div className="animate-fadeIn relative">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Shopping Cart ({items.length} items)</h1>

      {/* Serviceability Alerts */}
      {(isOutOfRange || noLocation) && (
        <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${noLocation ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <FiAlertTriangle className={`mt-0.5 flex-shrink-0 ${noLocation ? 'text-amber-500' : 'text-red-500'}`} />
          <div>
            <p className={`font-semibold text-sm ${noLocation ? 'text-amber-800' : 'text-red-800'}`}>{noLocation ? 'Location Required' : 'Outside Delivery Area'}</p>
            <p className={`text-xs mt-0.5 ${noLocation ? 'text-amber-600' : 'text-red-600'}`}>
              {noLocation ? 'Please update your profile with location access to place orders.' : serviceInfo?.message}
            </p>
          </div>
        </div>
      )}

      {serviceInfo?.serviceable && (
        <div className="mb-6 p-3 rounded-xl border bg-green-50 border-green-200 flex items-center gap-2">
          <FiCheckCircle className="text-green-500 flex-shrink-0" />
          <span className="text-sm text-green-700 font-medium">Delivery available — {serviceInfo.distance} KM from Ganesh Trades</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(item => (
            <div key={item.product} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-sm transition-all">
              <div className="w-16 h-16 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100">
                <ProductImage src={item.image} alt={item.name} showFallbackLabel={false} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 text-sm truncate">{item.name}</h3>
                <p className="text-primary-600 font-bold">₹{item.price}</p>
              </div>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => updateQuantity(item.product, item.quantity - 1)} className="p-2 hover:bg-gray-100"><FiMinus className="w-3 h-3" /></button>
                <span className="px-3 text-sm font-semibold">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.product, item.quantity + 1)} className="p-2 hover:bg-gray-100"><FiPlus className="w-3 h-3" /></button>
              </div>
              <span className="font-bold text-gray-800 w-20 text-right">₹{(item.price * item.quantity).toFixed(2)}</span>
              <button onClick={() => removeFromCart(item.product)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><FiTrash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        {/* Order Summary & Payment Gateway */}
        <div className="space-y-4">
          {/* Delivery Option */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><FiClock className="text-primary-500" /> Delivery Option</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setDeliveryType('instant')}
                className={`p-3 rounded-xl border-2 text-center transition-all ${deliveryType === 'instant' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <FiZap className={`mx-auto mb-1 ${deliveryType === 'instant' ? 'text-primary-600' : 'text-gray-400'}`} />
                <p className={`text-sm font-semibold ${deliveryType === 'instant' ? 'text-primary-700' : 'text-gray-600'}`}>Deliver Now</p>
                <p className="text-xs text-gray-400 mt-0.5">ASAP delivery</p>
              </button>
              <button onClick={() => setDeliveryType('scheduled')}
                className={`p-3 rounded-xl border-2 text-center transition-all ${deliveryType === 'scheduled' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <FiCalendar className={`mx-auto mb-1 ${deliveryType === 'scheduled' ? 'text-primary-600' : 'text-gray-400'}`} />
                <p className={`text-sm font-semibold ${deliveryType === 'scheduled' ? 'text-primary-700' : 'text-gray-600'}`}>Schedule</p>
                <p className="text-xs text-gray-400 mt-0.5">Pick date & time</p>
              </button>
            </div>

            {deliveryType === 'scheduled' && (
              <div className="mt-4 space-y-3 animate-fadeIn">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Date</label>
                  <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                    min={todayStr} max={maxDateStr}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Time Slot</label>
                  {availableSlots.length === 0 ? (
                    <p className="text-xs text-red-500 p-2 bg-red-50 rounded-lg">No slots available for today. Please choose a future date.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                      {availableSlots.map(slot => (
                        <button key={slot} type="button" onClick={() => setTimeSlot(slot)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all ${
                            timeSlot === slot ? 'bg-primary-100 border-primary-400 border-2 text-primary-700 font-medium' : 'border border-gray-200 text-gray-600 hover:border-primary-200 hover:bg-primary-50'
                          }`}>
                          <span>{SLOT_ICONS[TIME_SLOTS.indexOf(slot)]}</span>
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
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-2">Payment Method</h2>

            <div className="space-y-2">
              {/* Online Payment Option */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'online' ? 'border-primary-500 bg-primary-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="payment" value="online" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} className="mt-1 text-primary-600 focus:ring-primary-500" />
                <div className="flex-1">
                  <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                    <FiLock className="text-green-600" /> Online Payment Gateway
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">Instant confirmation via UPI, Card, Net Banking</p>

                  {/* Sub-modes for Online */}
                  {paymentMethod === 'online' && (
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-primary-100 animate-fadeIn">
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
                          className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                            onlineMode === mode.id ? 'bg-primary-600 text-white border-primary-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300'
                          }`}
                        >
                          {mode.icon} {mode.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>

              {/* Cash on Delivery */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'cash' ? 'border-primary-500 bg-primary-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="payment" value="cash" checked={paymentMethod === 'cash'} onChange={() => setPaymentMethod('cash')} className="mt-1 text-primary-600 focus:ring-primary-500" />
                <div>
                  <span className="text-sm font-bold text-gray-800">💵 Cash on Delivery</span>
                  <p className="text-xs text-gray-500">Pay cash when order arrives</p>
                </div>
              </label>

              {/* Credit (Khata) System */}
              <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'credit' ? 'border-primary-500 bg-primary-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input type="radio" name="payment" value="credit" checked={paymentMethod === 'credit'} onChange={() => setPaymentMethod('credit')} className="mt-1 text-primary-600 focus:ring-primary-500" />
                <div>
                  <span className="text-sm font-bold text-gray-800">📖 Credit (Khata Account)</span>
                  <p className="text-xs text-gray-500">Add to your monthly Khata balance</p>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Order Notes (Optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" rows={2} placeholder="Instructions for seller/delivery rider..." />
            </div>

            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{totalAmount.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Delivery</span><span className="text-green-600">Free</span></div>
              <div className="flex justify-between font-bold text-gray-800 text-lg pt-2 border-t"><span>Total Payable</span><span className="text-primary-600">₹{totalAmount.toFixed(2)}</span></div>
            </div>

            <button onClick={handlePlaceOrder} disabled={loading || isOutOfRange || noLocation || scheduleIncomplete}
              className={`w-full mt-2 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 ${
                isOutOfRange || noLocation ? 'bg-red-500 text-white cursor-not-allowed'
                : 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800'
              }`} id="checkout-btn">
              {loading ? <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></span> : null}
              {paymentMethod === 'online' ? `Pay ₹${totalAmount.toFixed(2)} Online` : 'Place Order'}
            </button>
          </div>
        </div>
      </div>

      {/* Online Payment Simulated Gateway Modal */}
      {showPaymentModal && pendingOrderDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-gray-100">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">G</div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">Ganesh Trades Gateway</h3>
                  <p className="text-[10px] text-gray-400">Order #{pendingOrderDetails.order.orderNumber}</p>
                </div>
              </div>
              <span className="text-lg font-bold text-primary-600">₹{pendingOrderDetails.order.finalAmount?.toFixed(2)}</span>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs flex justify-between">
                <span className="text-gray-500">Selected Mode:</span>
                <span className="font-bold capitalize text-primary-700">{onlineMode.replace('_', ' ')}</span>
              </div>

              {/* Mode-specific input simulation */}
              {onlineMode === 'upi' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Enter VPA / UPI ID</label>
                  <input type="text" value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="username@upi or mobile@paytm"
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
              )}

              {(onlineMode === 'debit_card' || onlineMode === 'credit_card') && (
                <div className="space-y-2">
                  <input type="text" placeholder="Card Number (16 digits)" value={cardForm.number} onChange={e => setCardForm({...cardForm, number: e.target.value})}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" maxLength={16} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="MM/YY" value={cardForm.expiry} onChange={e => setCardForm({...cardForm, expiry: e.target.value})}
                      className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" maxLength={5} />
                    <input type="password" placeholder="CVV" value={cardForm.cvv} onChange={e => setCardForm({...cardForm, cvv: e.target.value})}
                      className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" maxLength={4} />
                  </div>
                </div>
              )}

              {onlineMode === 'net_banking' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Select Bank</label>
                  <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                    <option value="">Choose Bank</option>
                    <option value="sbi">State Bank of India</option>
                    <option value="hdfc">HDFC Bank</option>
                    <option value="icici">ICICI Bank</option>
                    <option value="axis">Axis Bank</option>
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <button onClick={handleSimulatedPayment} disabled={paymentProcessing}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2">
                {paymentProcessing ? (
                  <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></span> Processing Payment...</span>
                ) : (
                  <><FiCheck /> Authorize Payment of ₹{pendingOrderDetails.order.finalAmount?.toFixed(2)}</>
                )}
              </button>
              <button onClick={() => setShowPaymentModal(false)} disabled={paymentProcessing}
                className="w-full py-2 text-gray-400 hover:text-gray-600 text-xs text-center">
                Cancel Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
