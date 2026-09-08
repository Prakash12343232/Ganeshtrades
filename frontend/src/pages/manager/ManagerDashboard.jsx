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
          <h1 className="text-2xl font-bold text-white">Management Portal</h1>
          <p className="text-slate-400 text-sm">Centralized database management and analytics</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExportOrders} className="flex items-center gap-2 px-4 py-2 bg-mint-500/10 text-mint-400 border border-mint-500/30 rounded-xl text-sm font-semibold hover:bg-mint-500/20"><FiDownload /> Orders Excel</button>
          <button onClick={handleExportProducts} className="flex items-center gap-2 px-4 py-2 bg-navy-800 text-slate-200 border border-navy-700 rounded-xl text-sm font-semibold hover:bg-navy-750"><FiDownload /> Products Excel</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {[{ key: 'overview', label: 'Overview', icon: <FiDatabase /> }, { key: 'analytics', label: 'Sales Analytics', icon: <FiActivity /> },
          { key: 'reviews', label: 'Reviews', icon: <FiStar /> }, { key: 'audit', label: 'Audit Logs', icon: <FiShield /> }
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${tab === t.key ? 'bg-mint-500 text-navy-950 shadow-md shadow-mint-500/20 font-bold' : 'bg-navy-900 text-slate-300 border border-navy-800 hover:border-mint-500/30'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Revenue', value: `₹${(stats.totalRevenue || 0).toLocaleString()}`, color: 'bg-mint-400' },
            { label: 'Total Orders', value: stats.totalOrders, color: 'bg-blue-400' },
            { label: 'Customers', value: stats.totalCustomers, color: 'bg-emerald-400' },
            { label: 'Products', value: stats.totalProducts, color: 'bg-cyan-400' },
            { label: 'Pending Orders', value: stats.pendingOrders, color: 'bg-amber-400' },
            { label: 'Delivered', value: stats.deliveredOrders, color: 'bg-mint-500' },
            { label: 'Cancelled', value: stats.cancelledOrders, color: 'bg-rose-400' },
            { label: 'Low Stock', value: stats.lowStockProducts, color: 'bg-orange-400' },
          ].map((s, i) => (
            <div key={i} className="bg-navy-900 rounded-2xl border border-navy-800 p-5">
              <div className={`w-3 h-3 ${s.color} rounded-full mb-3`}></div>
              <p className="text-2xl font-extrabold text-white">{s.value}</p>
              <p className="text-sm text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'analytics' && chartData && (
        <div className="space-y-6">
          <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6">
            <h3 className="font-bold text-white mb-4">Revenue Trend (7 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.last7Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#f8fafc' }} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6">
            <h3 className="font-bold text-white mb-4">Orders Trend (7 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.last7Days}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#f8fafc' }} />
                <Bar dataKey="orders" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6">
          <h3 className="font-bold text-white mb-4">Product Reviews ({reviews.length})</h3>
          <div className="space-y-4">
            {reviews.slice(0, 20).map(r => (
              <div key={r._id} className="border-b border-navy-800 pb-4 last:border-0">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm text-white">{r.user?.name}</span>
                    <span className="text-slate-500 mx-2">→</span>
                    <span className="text-sm text-mint-400 font-medium">{r.product?.name}</span>
                  </div>
                  <div className="flex">{[...Array(5)].map((_, i) => <span key={i} className={`text-sm ${i < r.rating ? 'text-amber-400' : 'text-slate-600'}`}>★</span>)}</div>
                </div>
                {r.comment && <p className="text-sm text-slate-300 mt-1">{r.comment}</p>}
                <p className="text-xs text-slate-400 mt-1">{new Date(r.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
            ))}
            {reviews.length === 0 && <p className="text-center text-slate-400">No reviews yet</p>}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6">
          <h3 className="font-bold text-white mb-4">Audit Logs</h3>
          <div className="space-y-3">
            {auditLogs.map(log => (
              <div key={log._id} className="flex items-center gap-4 p-3 bg-navy-950 rounded-xl border border-navy-800">
                <div className="w-8 h-8 bg-mint-500/10 border border-mint-500/20 rounded-lg flex items-center justify-center text-mint-400 text-sm">📋</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{log.action?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-400">{log.user?.name} • {log.entity}</p>
                </div>
                <span className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString('en-IN')}</span>
              </div>
            ))}
            {auditLogs.length === 0 && <p className="text-center text-slate-400">No audit logs yet</p>}
          </div>
        </div>
      )}
    </div>
  );
}
