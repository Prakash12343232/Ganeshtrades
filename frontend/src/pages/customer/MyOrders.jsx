import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../../services/api';
import { FiEye, FiPackage } from 'react-icons/fi';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700', out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700'
};

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const params = {};
    if (filter) params.status = filter;
    getOrders(params).then(res => setOrders(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, [filter]);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Orders</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['', 'pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all capitalize ${filter === s ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16"><span className="text-5xl mb-4 block">📦</span><p className="text-gray-500">No orders found</p>
          <Link to="/products" className="inline-block mt-4 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700">Shop Now</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <Link key={order._id} to={`/orders/${order._id}`}
              className="block bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md hover:border-primary-200 transition-all">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center"><FiPackage className="text-primary-600" /></div>
                  <div>
                    <p className="font-semibold text-gray-800">#{order.orderNumber}</p>
                    <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[order.orderStatus]}`}>
                    {order.orderStatus?.replace(/_/g, ' ')}
                  </span>
                  <span className="font-bold text-primary-600">₹{order.finalAmount?.toFixed(2)}</span>
                  <FiEye className="text-gray-400" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span>{order.items?.length} items</span>
                <span className={`capitalize ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>
                  Payment: {order.paymentStatus}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
