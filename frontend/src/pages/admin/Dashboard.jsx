import { useState, useEffect } from 'react';
import { getDashboardStats, getChartData, getAutoReorder } from '../../services/api';
import { Link } from 'react-router-dom';
import { FiShoppingBag, FiClock, FiTruck, FiXCircle, FiDollarSign, FiUsers, FiPackage, FiAlertTriangle, FiArrowRight, FiRefreshCw, FiCalendar } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#10b981', '#34d399', '#f59e0b', '#6366f1'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [reorderList, setReorderList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getChartData(), getAutoReorder()])
      .then(([sRes, cRes, rRes]) => { 
        setStats(sRes.data.data); 
        setChartData(cRes.data.data); 
        setReorderList(rRes.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-mint-400"></div></div>;

  const statCards = [
    { label: 'Total Orders', value: stats?.totalOrders || 0, icon: <FiShoppingBag />, color: 'from-blue-500 to-indigo-600', link: '/admin/orders' },
    { label: 'Pending', value: stats?.pendingOrders || 0, icon: <FiClock />, color: 'from-amber-500 to-orange-500', link: '/admin/orders' },
    { label: 'Delivered', value: stats?.deliveredOrders || 0, icon: <FiTruck />, color: 'from-mint-500 to-emerald-600', link: '/admin/orders' },
    { label: 'Cancelled', value: stats?.cancelledOrders || 0, icon: <FiXCircle />, color: 'from-rose-500 to-rose-600', link: '/admin/orders' },
    { label: 'Revenue', value: `₹${(stats?.totalRevenue || 0).toLocaleString('en-IN')}`, icon: <FiDollarSign />, color: 'from-mint-400 to-teal-500', link: '/admin/reports' },
    { label: 'Pending Payments', value: `₹${(stats?.totalPending || 0).toLocaleString('en-IN')}`, icon: <FiDollarSign />, color: 'from-amber-500 to-amber-600', link: '/admin/payments' },
    { label: 'Customers', value: stats?.totalCustomers || 0, icon: <FiUsers />, color: 'from-emerald-500 to-teal-600', link: '/admin/customers' },
    { label: 'Products', value: stats?.totalProducts || 0, icon: <FiPackage />, color: 'from-cyan-500 to-blue-600', link: '/admin/products' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Today */}
      <div className="bg-gradient-to-r from-navy-850 via-navy-900 to-navy-950 border border-mint-500/30 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-mint-500/10 rounded-full blur-2xl pointer-events-none" />
        <h2 className="text-lg font-bold mb-1 text-mint-300">Today's Summary</h2>
        <div className="flex gap-8 mt-3 flex-wrap items-center">
          <div><p className="text-3xl font-extrabold text-white">{stats?.todayOrders || 0}</p><p className="text-slate-400 text-sm">Orders Today</p></div>
          <div><p className="text-3xl font-extrabold text-mint-400">₹{(stats?.todayRevenue || 0).toLocaleString('en-IN')}</p><p className="text-slate-400 text-sm">Revenue Today</p></div>
          
          <div className="flex gap-3 ml-auto flex-wrap">
            {stats?.todayScheduled > 0 && (
              <Link to="/admin/deliveries" className="flex items-center gap-2 bg-mint-500/10 border border-mint-500/30 hover:bg-mint-500/20 transition-colors rounded-xl px-4 py-2">
                <FiCalendar className="text-mint-400" />
                <div><p className="text-sm font-bold text-white leading-tight">{stats.todayScheduled}</p><p className="text-[10px] text-mint-300 uppercase tracking-wider">Scheduled Today</p></div>
              </Link>
            )}
            {stats?.lateScheduled > 0 && (
              <Link to="/admin/deliveries" className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-colors rounded-xl px-4 py-2">
                <FiAlertTriangle className="text-rose-400" />
                <div><p className="text-sm font-bold text-white leading-tight">{stats.lateScheduled}</p><p className="text-[10px] text-rose-300 uppercase tracking-wider">Late Deliveries</p></div>
              </Link>
            )}
            {stats?.lowStockProducts > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2">
                <FiAlertTriangle className="text-amber-400" />
                <span className="text-sm text-amber-300 font-medium">{stats.lowStockProducts} low stock items</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <Link key={i} to={card.link} className="bg-navy-900 rounded-2xl border border-navy-800 p-5 hover:border-mint-500/40 hover:shadow-xl hover:shadow-mint-500/5 transition-all group">
            <div className={`w-10 h-10 bg-gradient-to-r ${card.color} rounded-xl flex items-center justify-center text-navy-950 font-bold mb-3 group-hover:scale-110 transition-transform shadow-md`}>
              {card.icon}
            </div>
            <p className="text-2xl font-extrabold text-white">{card.value}</p>
            <p className="text-sm text-slate-400 mt-1">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6">
          <h3 className="font-bold text-white mb-4">Last 7 Days Revenue</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData?.last7Days || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#f8fafc' }} />
              <Bar dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Types */}
        <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6">
          <h3 className="font-bold text-white mb-4">Customer Types</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={chartData?.customerTypes?.map(c => ({ name: c._id?.replace(/_/g, ' ') || 'Unknown', value: c.count })) || []}
                cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {(chartData?.customerTypes || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#f8fafc' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Recent Orders</h3>
          <Link to="/admin/orders" className="text-mint-400 text-sm font-semibold flex items-center gap-1 hover:text-mint-300">View All <FiArrowRight /></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-slate-300">
            <thead><tr className="border-b border-navy-800">
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Order</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Customer</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Amount</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium">Payment</th>
            </tr></thead>
            <tbody>
              {(stats?.recentOrders || []).slice(0, 5).map(order => (
                <tr key={order._id} className="border-b border-navy-800/60 hover:bg-navy-950/50">
                  <td className="py-3 px-4 font-semibold text-white">#{order.orderNumber}</td>
                  <td className="py-3 px-4">{order.user?.name}</td>
                  <td className="py-3 px-4 font-bold text-mint-400">₹{order.finalAmount}</td>
                  <td className="py-3 px-4"><span className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize bg-mint-500/10 border border-mint-500/20 text-mint-400">{order.orderStatus?.replace(/_/g, ' ')}</span></td>
                  <td className="py-3 px-4 capitalize">{order.paymentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Products & Reorder Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartData?.topProducts?.length > 0 && (
          <div className="bg-navy-900 rounded-2xl border border-navy-800 p-6">
            <h3 className="font-bold text-white mb-4">Top Selling Products</h3>
            <div className="space-y-3">
              {chartData.topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-navy-950 rounded-xl border border-navy-800">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-mint-500/10 border border-mint-500/20 rounded-lg flex items-center justify-center text-mint-400 font-bold text-sm">{i + 1}</span>
                    <span className="font-medium text-white">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-mint-400">{p.totalSold} sold</p>
                    <p className="text-xs text-slate-400">₹{p.price}/unit</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {reorderList.length > 0 && (
          <div className="bg-navy-900 rounded-2xl border border-rose-500/30 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-rose-300 flex items-center gap-2">
                <FiRefreshCw className="animate-spin-slow text-rose-400" /> Auto-Reorder Suggestions
              </h3>
              <Link to="/admin/suppliers" className="text-sm font-semibold text-rose-400 hover:text-rose-300">Create PO →</Link>
            </div>
            <div className="space-y-3">
              {reorderList.slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-navy-950 rounded-xl border border-rose-500/20">
                  <div>
                    <span className="font-medium text-white">{p.name}</span>
                    <p className="text-xs text-rose-300 mt-1">Stock: {p.stock} (Min: {p.minStock})</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-rose-400">{p.totalSold > 100 ? '🔥 High Demand' : '📉 Low Stock'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
