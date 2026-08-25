import { useState, useEffect } from 'react';
import { getNotifications, createNotification, deleteNotification, clearReadNotifications, markAllRead } from '../../services/api';
import toast from 'react-hot-toast';
import { FiBell, FiSend, FiTrash2, FiCheckCircle, FiFilter } from 'react-icons/fi';

const TYPES = ['general', 'promotion', 'new_product', 'payment_reminder', 'order', 'delivery', 'system'];
const TYPE_COLORS = {
  general: 'bg-blue-100 text-blue-700', order: 'bg-primary-100 text-primary-700',
  payment: 'bg-green-100 text-green-700', stock: 'bg-amber-100 text-amber-700',
  promotion: 'bg-pink-100 text-pink-700', delivery: 'bg-indigo-100 text-indigo-700',
  new_product: 'bg-teal-100 text-teal-700', payment_reminder: 'bg-orange-100 text-orange-700',
  system: 'bg-gray-100 text-gray-700'
};
const TYPE_ICONS = {
  general: '📢', order: '📦', payment: '💳', stock: '📊',
  promotion: '🎉', delivery: '🚚', new_product: '🆕', payment_reminder: '💰', system: '⚙️'
};

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', type: 'general', recipientRole: 'customer', priority: 'normal' });
  const [sending, setSending] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });

  const fetchNotifications = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await getNotifications({ page, limit: 30 });
      setNotifications(data.data);
      setPagination(data.pagination);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.title || !form.message) return toast.error('Title and message required');
    setSending(true);
    try {
      await createNotification(form);
      toast.success('Notification sent!');
      setShowForm(false);
      setForm({ title: '', message: '', type: 'general', recipientRole: 'customer', priority: 'normal' });
      fetchNotifications();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to send'); }
    finally { setSending(false); }
  };

  const handleClearRead = async () => {
    try {
      await clearReadNotifications();
      toast.success('Cleared read notifications');
      fetchNotifications();
    } catch { toast.error('Failed to clear'); }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      toast.success('All marked as read');
      fetchNotifications();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n._id !== id));
      toast.success('Deleted');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notification Center</h1>
          <p className="text-sm text-gray-400">Manage and send notifications</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleMarkAllRead} className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all flex items-center gap-1">
            <FiCheckCircle className="w-4 h-4" /> Mark All Read
          </button>
          <button onClick={handleClearRead} className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-all flex items-center gap-1">
            <FiTrash2 className="w-4 h-4" /> Clear Read
          </button>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-all flex items-center gap-1" id="send-notification-btn">
            <FiSend className="w-4 h-4" /> Send New
          </button>
        </div>
      </div>

      {/* Send Notification Form */}
      {showForm && (
        <form onSubmit={handleSend} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4 animate-fadeIn">
          <h3 className="font-bold text-gray-800">Send Notification</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Notification title" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                {TYPES.map(t => <option key={t} value={t}>{TYPE_ICONS[t]} {t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" rows={3} placeholder="Notification message" required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Send To</label>
              <select value={form.recipientRole} onChange={e => setForm(f => ({ ...f, recipientRole: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="customer">All Customers</option>
                <option value="admin">All Admins</option>
                <option value="all">Everyone</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={sending} className="px-6 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-all">
              {sending ? 'Sending...' : 'Send Notification'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500 text-sm hover:bg-gray-100 rounded-lg transition-all">Cancel</button>
          </div>
        </form>
      )}

      {/* Notifications List */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FiBell className="w-12 h-12 mx-auto text-gray-200 mb-3" />
          <p>No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n._id} className={`bg-white rounded-xl border p-4 flex items-start gap-3 transition-all hover:shadow-sm ${n.isRead ? 'border-gray-100 opacity-60' : 'border-primary-200 bg-primary-50/30'}`}>
              <span className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] || '📢'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={`text-sm font-semibold ${n.isRead ? 'text-gray-600' : 'text-gray-800'}`}>{n.title}</h4>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[n.type] || TYPE_COLORS.general}`}>
                    {n.type?.replace(/_/g, ' ')}
                  </span>
                  {n.priority === 'high' && <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full font-bold">HIGH</span>}
                </div>
                <p className="text-sm text-gray-500 mt-0.5 truncate">{n.message}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{new Date(n.createdAt).toLocaleString('en-IN')}</span>
                  {n.recipientRole && <span className="capitalize">→ {n.recipientRole}</span>}
                </div>
              </div>
              <button onClick={() => handleDelete(n._id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                <FiTrash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              {Array.from({ length: pagination.pages }, (_, i) => (
                <button key={i + 1} onClick={() => fetchNotifications(i + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${pagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
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
