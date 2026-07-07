import { useState, useEffect } from 'react';
import { getOrders, updateOrderStatus } from '../../services/api';
import toast from 'react-hot-toast';
import { FiEye, FiCheck, FiTruck, FiX } from 'react-icons/fi';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700', out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700'
};

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = () => {
    const params = { limit: 50 };
    if (filter) params.status = filter;
    getOrders(params).then(res => setOrders(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, [filter]);

  const handleStatusUpdate = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, { orderStatus: status });
      toast.success(`Order ${status}`);
      fetchOrders();
      setSelectedOrder(null);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Orders</h1>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['', 'pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium capitalize ${filter === s ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-10">Loading...</div> : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Order #</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Customer</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Amount</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Payment</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
              </tr></thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order._id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">#{order.orderNumber}</td>
                    <td className="py-3 px-4">{order.user?.name}<br /><span className="text-xs text-gray-400">{order.user?.mobile}</span></td>
                    <td className="py-3 px-4 capitalize text-xs">{order.user?.customerType?.replace(/_/g, ' ')}</td>
                    <td className="py-3 px-4 font-semibold text-primary-600">₹{order.finalAmount}</td>
                    <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[order.orderStatus]}`}>{order.orderStatus?.replace(/_/g, ' ')}</span></td>
                    <td className="py-3 px-4"><span className={`capitalize text-xs font-medium ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>{order.paymentStatus}</span></td>
                    <td className="py-3 px-4 text-xs text-gray-500">{new Date(order.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {order.orderStatus === 'pending' && (
                          <button onClick={() => handleStatusUpdate(order._id, 'confirmed')} className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200" title="Confirm"><FiCheck className="w-3.5 h-3.5" /></button>
                        )}
                        {order.orderStatus === 'confirmed' && (
                          <button onClick={() => handleStatusUpdate(order._id, 'processing')} className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200" title="Process"><FiCheck className="w-3.5 h-3.5" /></button>
                        )}
                        {order.orderStatus === 'processing' && (
                          <button onClick={() => handleStatusUpdate(order._id, 'out_for_delivery')} className="p-1.5 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200" title="Out for Delivery"><FiTruck className="w-3.5 h-3.5" /></button>
                        )}
                        {order.orderStatus === 'out_for_delivery' && (
                          <button onClick={() => handleStatusUpdate(order._id, 'delivered')} className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Delivered"><FiCheck className="w-3.5 h-3.5" /></button>
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
    </div>
  );
}
