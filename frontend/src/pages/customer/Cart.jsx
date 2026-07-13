import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { createOrder, checkServiceability } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { useState, useEffect, useMemo } from 'react';
import { FiTrash2, FiMinus, FiPlus, FiShoppingBag, FiAlertTriangle, FiCheckCircle, FiNavigation, FiMapPin, FiClock, FiCalendar, FiZap } from 'react-icons/fi';

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
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [serviceInfo, setServiceInfo] = useState(null);
  const [checkingService, setCheckingService] = useState(false);

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
    setCheckingService(true);
    try {
      const { data } = await checkServiceability(user.address.lat, user.address.lng);
      setServiceInfo(data.data);
    } catch { setServiceInfo(null); }
    finally { setCheckingService(false); }
  };

  // Min date = today, max = 30 days from now
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

  // Filter available slots for today (exclude past slots)
  const availableSlots = useMemo(() => {
    if (!scheduledDate || scheduledDate !== todayStr) return TIME_SLOTS;
    const now = new Date();
    const currentHour = now.getHours();
    return TIME_SLOTS.filter(slot => parseSlotStartHour(slot) > currentHour);
  }, [scheduledDate, todayStr]);

  // Reset timeSlot if it became unavailable
  useEffect(() => {
    if (timeSlot && !availableSlots.includes(timeSlot)) setTimeSlot('');
  }, [availableSlots, timeSlot]);

  const handlePlaceOrder = async () => {
    if (items.length === 0) return toast.error('Cart is empty');

    // Validate schedule
    if (deliveryType === 'scheduled') {
      if (!scheduledDate) return toast.error('Please select a delivery date');
      if (!timeSlot) return toast.error('Please select a time slot');
    }

    // Re-verify serviceability
    if (user?.address?.lat && user?.address?.lng) {
      try {
        const { data } = await checkServiceability(user.address.lat, user.address.lng);
        if (!data.data.serviceable) { toast.error(data.data.message); setServiceInfo(data.data); return; }
      } catch { /* continue */ }
    }

    setLoading(true);
    try {
      const orderData = {
        items: items.map(i => ({ product: i.product, quantity: i.quantity })),
        paymentMethod, notes,
        deliveryAddress: user?.address,
        deliveryType,
        ...(deliveryType === 'scheduled' && { scheduledDate, timeSlot })
      };
      const { data } = await createOrder(orderData);
      clearCart();
      toast.success(deliveryType === 'scheduled' ? '📅 Order scheduled successfully!' : 'Order placed successfully!');
      navigate(`/orders/${data.data._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally { setLoading(false); }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-20 animate-fadeIn">
        <span className="text-6xl mb-4 block">🛒</span>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Add some products to get started</p>
        <button onClick={() => navigate('/products')} className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all">Browse Products</button>
      </div>
    );
  }

  const isOutOfRange = serviceInfo && !serviceInfo.serviceable;
  const noLocation = !user?.address?.lat || !user?.address?.lng;
  const scheduleIncomplete = deliveryType === 'scheduled' && (!scheduledDate || !timeSlot);

  return (
    <div className="animate-fadeIn">
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
            {serviceInfo && !serviceInfo.serviceable && (
              <div className="flex items-center gap-3 mt-2 text-xs text-red-500">
                <span className="flex items-center gap-1"><FiNavigation className="w-3 h-3" /> {serviceInfo.distance} KM away</span>
                <span>•</span><span>Max radius: {serviceInfo.radius} KM</span>
              </div>
            )}
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
            <div key={item.product} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-sm transition-all">
              <div className="w-16 h-16 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-2xl">📦</span></div>
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

        {/* Order Summary + Delivery Scheduling */}
        <div className="space-y-4">
          {/* ─── Delivery Type Selector ─── */}
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

            {/* Schedule Form */}
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
                      {availableSlots.map((slot, i) => (
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
                {scheduledDate && timeSlot && (
                  <div className="p-2.5 bg-primary-50 rounded-lg border border-primary-100 flex items-center gap-2">
                    <FiCalendar className="text-primary-500 flex-shrink-0" />
                    <span className="text-xs text-primary-700 font-medium">
                      📅 {new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — {timeSlot}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Order Summary ─── */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Order Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{totalAmount.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Delivery</span><span className="text-green-600">Free</span></div>
              {serviceInfo?.serviceable && (
                <div className="flex justify-between text-gray-500 text-xs">
                  <span className="flex items-center gap-1"><FiMapPin className="w-3 h-3" /> Distance</span>
                  <span>{serviceInfo.distance} KM</span>
                </div>
              )}
              {deliveryType === 'scheduled' && scheduledDate && timeSlot && (
                <div className="flex justify-between text-primary-600 text-xs font-medium">
                  <span className="flex items-center gap-1"><FiCalendar className="w-3 h-3" /> Scheduled</span>
                  <span>{new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {timeSlot}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between font-bold text-gray-800 text-lg"><span>Total</span><span className="text-primary-600">₹{totalAmount.toFixed(2)}</span></div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="cash">Cash on Delivery</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="credit">Credit (Pay Later)</option>
              </select>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" rows={2} placeholder="Delivery instructions..." />
            </div>

            <button onClick={handlePlaceOrder} disabled={loading || isOutOfRange || noLocation || scheduleIncomplete}
              className={`w-full mt-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 ${
                isOutOfRange || noLocation ? 'bg-red-500 text-white cursor-not-allowed shadow-red-200'
                : 'bg-primary-600 text-white hover:bg-primary-700 shadow-primary-200'
              }`} id="place-order-btn">
              {isOutOfRange ? <><FiAlertTriangle /> Outside Service Area</>
              : noLocation ? <><FiMapPin /> Location Required</>
              : scheduleIncomplete ? <><FiCalendar /> Select Date & Time</>
              : deliveryType === 'scheduled'
                ? <><FiCalendar /> {loading ? 'Scheduling...' : 'Schedule Order'}</>
                : <><FiShoppingBag /> {loading ? 'Placing Order...' : 'Place Order'}</>
              }
            </button>

            <button onClick={clearCart} className="w-full mt-2 py-2 text-red-500 text-sm font-medium hover:bg-red-50 rounded-lg transition-colors">Clear Cart</button>
          </div>
        </div>
      </div>
    </div>
  );
}
