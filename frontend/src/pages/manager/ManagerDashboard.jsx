import { useState, useEffect } from 'react';
import { getDashboardStats, getChartData, getAuditLogs, getAllReviews, exportOrders, exportProducts } from '../../services/api';
import toast from 'react-hot-toast';
import { FiDownload, FiDatabase, FiActivity, FiStar, FiShield } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function ManagerDashboard() {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    Promise.all([getDashboardStats(), getChartData()])
      .then(([sRes, cRes]) => { setStats(sRes.data.data); setChartData(cRes.data.data); })
      .catch(() => {});

    getAuditLogs({ limit: 20 }).then(res => setAuditLogs(res.data.data)).catch(() => {});
    getAllReviews().then(res => setReviews(res.data.data)).catch(() => {});
  }, []);

  const handleExportOrders = async () => {
    try {
      const res = await exportOrders();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', 'orders-report.xlsx');
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('Exported!');
    } catch { toast.error('Failed'); }
  };

  const handleExportProducts = async () => {
    try {
      const res = await exportProducts();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', 'products-report.xlsx');
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('Exported!');
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Management Portal</h1>
          <p className="text-gray-500 text-sm">Centralized database management and analytics</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportOrders} className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl text-sm font-medium hover:bg-green-200"><FiDownload /> Orders Excel</button>
          <button onClick={handleExportProducts} className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-200"><FiDownload /> Products Excel</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {[{ key: 'overview', label: 'Overview', icon: <FiDatabase /> }, { key: 'analytics', label: 'Sales Analytics', icon: <FiActivity /> },
          { key: 'reviews', label: 'Reviews', icon: <FiStar /> }, { key: 'audit', label: 'Audit Logs', icon: <FiShield /> }
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Revenue', value: `₹${(stats.totalRevenue || 0).toLocaleString()}`, color: 'bg-primary-600' },
            { label: 'Total Orders', value: stats.totalOrders, color: 'bg-blue-600' },
            { label: 'Customers', value: stats.totalCustomers, color: 'bg-green-600' },
            { label: 'Products', value: stats.totalProducts, color: 'bg-indigo-600' },
            { label: 'Pending Orders', value: stats.pendingOrders, color: 'bg-yellow-600' },
            { label: 'Delivered', value: stats.deliveredOrders, color: 'bg-emerald-600' },
            { label: 'Cancelled', value: stats.cancelledOrders, color: 'bg-red-600' },
            { label: 'Low Stock', value: stats.lowStockProducts, color: 'bg-orange-600' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className={`w-3 h-3 ${s.color} rounded-full mb-3`}></div>
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'analytics' && chartData && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 mb-4">Revenue Trend (7 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.last7Days}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#7e22ce" strokeWidth={3} dot={{ fill: '#7e22ce', r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 mb-4">Orders Trend (7 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.last7Days}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="orders" fill="#a855f7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">Product Reviews ({reviews.length})</h3>
          <div className="space-y-4">
            {reviews.slice(0, 20).map(r => (
              <div key={r._id} className="border-b border-gray-100 pb-4 last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm">{r.user?.name}</span>
                    <span className="text-gray-400 mx-2">→</span>
                    <span className="text-sm text-primary-600">{r.product?.name}</span>
                  </div>
                  <div className="flex">{[...Array(5)].map((_, i) => <span key={i} className={`text-sm ${i < r.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>)}</div>
                </div>
                {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
                <p className="text-xs text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
            ))}
            {reviews.length === 0 && <p className="text-center text-gray-400">No reviews yet</p>}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">Audit Logs</h3>
          <div className="space-y-3">
            {auditLogs.map(log => (
              <div key={log._id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 text-sm">📋</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{log.action?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-400">{log.user?.name} • {log.entity}</p>
                </div>
                <span className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString('en-IN')}</span>
              </div>
            ))}
            {auditLogs.length === 0 && <p className="text-center text-gray-400">No audit logs yet</p>}
          </div>
        </div>
      )}
    </div>
  );
}
