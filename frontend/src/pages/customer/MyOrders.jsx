import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../../services/api';
import { FiEye, FiPackage, FiCalendar, FiZap, FiClock } from 'react-icons/fi';

const STATUS_COLORS = {
  pending: 'bg-amber-500/10 text-amber-300 border border-amber-500/30', confirmed: 'bg-blue-500/10 text-blue-300 border border-blue-500/30',
  processing: 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30', out_for_delivery: 'bg-purple-500/10 text-purple-300 border border-purple-500/30',
  delivered: 'bg-mint-500/10 text-mint-300 border border-mint-500/30', cancelled: 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
};

const STATUS_LABELS = {
  pending: 'Order Received', confirmed: 'Order Confirmed',
  processing: 'Preparing', out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered', cancelled: 'Cancelled'
};

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');

  const fetchOrders = useCallback(async (pageNum, append = false) => {
    const params = { page: pageNum, limit: 10 };
    if (filter) params.status = filter;
    if (deliveryFilter) params.deliveryType = deliveryFilter;
    try {
      const res = await getOrders(params);
      setOrders(prev => append ? [...prev, ...res.data.data] : res.data.data);
      setHasMore((res.data.pagination?.page || 1) < (res.data.pagination?.pages || 1));
      setPage(pageNum);
    } catch { if (!append) setOrders([]); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [filter, deliveryFilter]);

  useEffect(() => {
    setLoading(true);
    setLoadingMore(false);
    fetchOrders(1);
  }, [fetchOrders]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchOrders(page + 1, true);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-mint-400"></div></div>;

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold text-white mb-6">My Orders</h1>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {['', 'pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${filter === s ? 'bg-mint-500 text-navy-950 font-bold shadow-md shadow-mint-500/20' : 'bg-navy-900 text-slate-300 border border-navy-800 hover:border-mint-500/30'}`}>
              {STATUS_LABELS[s] || 'All'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {[{ v: '', l: 'All Types', icon: null }, { v: 'instant', l: 'Instant', icon: <FiZap className="w-3 h-3" /> }, { v: 'scheduled', l: 'Scheduled', icon: <FiCalendar className="w-3 h-3" /> }].map(dt => (
            <button key={dt.v} onClick={() => setDeliveryFilter(dt.v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${deliveryFilter === dt.v ? 'bg-mint-500/10 text-mint-400 border border-mint-500/30 font-semibold' : 'bg-navy-900 text-slate-400 border border-navy-800'}`}>
              {dt.icon} {dt.l}
            </button>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-navy-900 rounded-2xl border border-navy-800"><span className="text-5xl mb-4 block">📦</span><p className="text-slate-400">No orders found</p>
          <Link to="/products" className="inline-block mt-4 px-6 py-3 bg-mint-500 text-navy-950 rounded-xl font-bold hover:bg-mint-400 shadow-lg shadow-mint-500/20">Shop Now</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <Link key={order._id} to={`/orders/${order._id}`}
              className="block bg-navy-900 rounded-2xl border border-navy-800 p-5 hover:border-mint-500/40 hover:shadow-xl hover:shadow-mint-500/10 transition-all">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-mint-500/10 border border-mint-500/20 rounded-xl flex items-center justify-center text-mint-400"><FiPackage className="w-5 h-5" /></div>
                  <div>
                    <p className="font-semibold text-white">Order #{order.orderNumber}</p>
                    <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {order.deliveryType === 'scheduled' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-mint-500/10 border border-mint-500/20 text-mint-400 text-xs font-medium rounded-full">
                      <FiCalendar className="w-3 h-3" /> Scheduled
                    </span>
                  )}
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.orderStatus]}`}>
                    {STATUS_LABELS[order.orderStatus] || order.orderStatus}
                  </span>
                  <span className="font-bold text-mint-400">₹{order.finalAmount?.toFixed(2)}</span>
                  <FiEye className="text-slate-400" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-400 pt-3 border-t border-navy-800">
                <div className="flex items-center gap-3">
                  <span>{order.items?.length} item(s)</span>
                  <span className={`font-semibold capitalize ${order.paymentStatus === 'paid' ? 'text-mint-400' : 'text-amber-400'}`}>
                    Payment: {order.paymentStatus}
                  </span>
                </div>
                {order.estimatedDeliveryTime && order.orderStatus !== 'cancelled' && order.orderStatus !== 'delivered' && (
                  <span className="flex items-center gap-1 text-mint-300 font-semibold bg-mint-500/10 border border-mint-500/20 px-2.5 py-1 rounded-md">
                    <FiClock className="w-3 h-3 text-mint-400" />
                    ETA: {new Date(order.estimatedDeliveryTime).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
      {!loading && hasMore && (
        <div className="flex justify-center pt-6">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-6 py-2.5 bg-navy-900 border border-mint-500/40 text-mint-400 rounded-xl text-sm font-semibold hover:bg-mint-500/10 disabled:opacity-50 transition-all"
          >
            {loadingMore ? 'Loading...' : 'Load More Orders'}
          </button>
        </div>
      )}
    </div>
  );
}
