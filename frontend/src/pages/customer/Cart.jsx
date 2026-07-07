import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { createOrder } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { FiTrash2, FiMinus, FiPlus, FiShoppingBag } from 'react-icons/fi';

export default function Cart() {
  const { items, removeFromCart, updateQuantity, clearCart, totalAmount } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');

  const handlePlaceOrder = async () => {
    if (items.length === 0) return toast.error('Cart is empty');
    setLoading(true);
    try {
      const orderData = {
        items: items.map(i => ({ product: i.product, quantity: i.quantity })),
        paymentMethod,
        notes,
        deliveryAddress: user?.address
      };
      const { data } = await createOrder(orderData);
      clearCart();
      toast.success('Order placed successfully!');
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
        <button onClick={() => navigate('/products')} className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all">
          Browse Products
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Shopping Cart ({items.length} items)</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(item => (
            <div key={item.product} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-sm transition-all">
              <div className="w-16 h-16 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">📦</span>
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
              <button onClick={() => removeFromCart(item.product)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 h-fit sticky top-24">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Order Summary</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{totalAmount.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-600"><span>Delivery</span><span className="text-green-600">Free</span></div>
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

          <button onClick={handlePlaceOrder} disabled={loading}
            className="w-full mt-4 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-200 disabled:opacity-50" id="place-order-btn">
            <FiShoppingBag /> {loading ? 'Placing Order...' : 'Place Order'}
          </button>

          <button onClick={clearCart} className="w-full mt-2 py-2 text-red-500 text-sm font-medium hover:bg-red-50 rounded-lg transition-colors">
            Clear Cart
          </button>
        </div>
      </div>
    </div>
  );
}
