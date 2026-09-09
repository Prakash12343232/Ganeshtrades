import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUser, updateUser, getOrders, getCreditHistory } from '../../services/api';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiPackage, FiCreditCard, FiEdit2, FiCheck, FiX } from 'react-icons/fi';

const ORDER_STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  out_for_delivery: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
};

const PAYMENT_STATUS_COLORS = {
  pending: 'text-yellow-600',
  partial: 'text-orange-600',
  paid: 'text-green-600',
  refunded: 'text-blue-600'
};

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [orderPagination, setOrderPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [creditHistory, setCreditHistory] = useState([]);
  const [creditPagination, setCreditPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  const fetchUser = useCallback(async () => {
    try {
      const { data } = await getUser(id);
      setUser(data.data);
      setEditForm({
        name: data.data.name || '',
        email: data.data.email || '',
        customerType: data.data.customerType || 'public',
        creditLimit: data.data.creditLimit ?? 0,
        role: data.data.role || 'customer'
      });
    } catch { toast.error('Failed to load customer'); }
  }, [id]);

  const fetchOrders = useCallback(async (page = 1) => {
    try {
      const { data } = await getOrders({ userId: id, page, limit: 10 });
      setOrders(data.data);
      setOrderPagination(data.pagination);
    } catch { /* silent */ }
  }, [id]);

  const fetchCreditHistory = useCallback(async (page = 1) => {
    try {
      const { data } = await getCreditHistory(id, { page, limit: 10 });
      setCreditHistory(data.data.transactions);
      setCreditPagination(data.data.pagination);
    } catch { /* silent */ }
  }, [id]);

  useEffect(() => {
    Promise.all([fetchUser(), fetchOrders(), fetchCreditHistory()])
      .finally(() => setLoading(false));
  }, [fetchUser, fetchOrders, fetchCreditHistory]);

  const handleSave = async () => {
    try {
      const payload = {
        name: editForm.name,
        email: editForm.email,
        customerType: editForm.customerType,
        creditLimit: parseFloat(editForm.creditLimit) || 0,
        role: editForm.role
      };
      await updateUser(id, payload);
      toast.success('Customer updated');
      setEditing(false);
      fetchUser();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const handleToggleActive = async () => {
    try {
      await updateUser(id, { isActive: !user.isActive });
      toast.success(user.isActive ? 'Deactivated' : 'Activated');
      fetchUser();
    } catch { toast.error('Failed'); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary-500" /></div>;
  }

  if (!user) {
    return <div className="text-center py-20 text-gray-500">Customer not found</div>;
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/customers')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><FiArrowLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{user.name}</h1>
          <p className="text-sm text-gray-500">{user.mobile} &middot; {user.email}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setEditing(!editing)} className="px-4 py-2 rounded-xl text-sm font-medium bg-primary-50 text-primary-600 hover:bg-primary-100 flex items-center gap-2">
            <FiEdit2 className="w-4 h-4" />{editing ? 'Cancel' : 'Edit'}
          </button>
          <button onClick={handleToggleActive}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${user.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
            {user.isActive ? <><FiX className="w-4 h-4" />Deactivate</> : <><FiCheck className="w-4 h-4" />Activate</>}
          </button>
        </div>
      </div>

      {editing && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">Edit Customer</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
              <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Customer Type</label>
              <select value={editForm.customerType} onChange={e => setEditForm({ ...editForm, customerType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="public">Public</option>
                <option value="hotel">Hotel / Restaurant</option>
                <option value="pg_hostel">PG / Hostel</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Credit Limit (₹)</label>
              <input type="number" min="0" value={editForm.creditLimit} onChange={e => setEditForm({ ...editForm, creditLimit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="customer">Customer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-700">Save Changes</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total Spent</p>
          <p className="text-xl font-bold text-gray-800">₹{(user.totalSpent || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Pending Amount</p>
          <p className={`text-xl font-bold ${(user.pendingAmount || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{(user.pendingAmount || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Credit Balance</p>
          <p className={`text-xl font-bold ${(user.creditBalance || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>₹{(user.creditBalance || 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Credit Limit</p>
          <p className="text-xl font-bold text-gray-800">₹{(user.creditLimit || 0).toLocaleString('en-IN')}</p>
        </div>
      </div>

      {user.address && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Delivery Address</p>
          <p className="text-sm text-gray-700">{user.address.street}{user.address.area ? `, ${user.address.area}` : ''}{user.address.city ? `, ${user.address.city}` : ''} {user.address.pincode}</p>
        </div>
      )}

      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {[{ key: 'orders', label: 'Orders', icon: <FiPackage className="w-4 h-4" /> },
          { key: 'credit', label: 'Credit History', icon: <FiCreditCard className="w-4 h-4" /> }
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Order #</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Amount</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Payment</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
              </tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o._id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/orders`)}>
                    <td className="py-3 px-4 font-medium">{o.orderNumber}</td>
                    <td className="py-3 px-4 text-gray-500">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="py-3 px-4 font-semibold">₹{o.finalAmount}</td>
                    <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[o.orderStatus] || 'bg-gray-100 text-gray-600'}`}>{o.orderStatus?.replace(/_/g, ' ')}</span></td>
                    <td className="py-3 px-4"><span className={`text-xs font-medium capitalize ${PAYMENT_STATUS_COLORS[o.paymentStatus] || ''}`}>{o.paymentStatus}</span></td>
                    <td className="py-3 px-4 text-xs capitalize">{o.deliveryType || 'instant'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {orders.length === 0 && <div className="text-center py-10 text-gray-400">No orders found</div>}
          {orderPagination.pages > 1 && (
            <div className="flex justify-center gap-2 py-4">
              {Array.from({ length: orderPagination.pages }, (_, i) => (
                <button key={i + 1} onClick={() => fetchOrders(i + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium ${orderPagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'credit' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Amount</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Description</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Reference</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Logged By</th>
              </tr></thead>
              <tbody>
                {creditHistory.map(t => (
                  <tr key={t._id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-500">{new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type === 'debit' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {t.type === 'debit' ? 'Debit' : 'Credit'}
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-semibold ${t.type === 'debit' ? 'text-red-600' : 'text-green-600'}`}>
                      {t.type === 'debit' ? '+' : '-'}₹{t.amount}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{t.description || '—'}</td>
                    <td className="py-3 px-4 text-xs">
                      {t.referenceOrder ? <span className="text-primary-600">{t.referenceOrder.orderNumber}</span> :
                       t.referenceSettlement ? <span className="text-blue-600">Settlement ₹{t.referenceSettlement.amount}</span> : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500">{t.loggedBy?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {creditHistory.length === 0 && <div className="text-center py-10 text-gray-400">No credit transactions</div>}
          {creditPagination.pages > 1 && (
            <div className="flex justify-center gap-2 py-4">
              {Array.from({ length: creditPagination.pages }, (_, i) => (
                <button key={i + 1} onClick={() => fetchCreditHistory(i + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium ${creditPagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
