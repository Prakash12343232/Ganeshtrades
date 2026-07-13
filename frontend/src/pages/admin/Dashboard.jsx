import { useState, useEffect } from 'react';
import { getDashboardStats, getChartData, getAutoReorder } from '../../services/api';
import { Link } from 'react-router-dom';
import { FiShoppingBag, FiClock, FiTruck, FiXCircle, FiDollarSign, FiUsers, FiPackage, FiAlertTriangle, FiArrowRight, FiRefreshCw } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#7e22ce', '#a855f7', '#c084fc', '#e9d5ff'];

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

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;

  const statCards = [
    { label: 'Total Orders', value: stats?.totalOrders || 0, icon: <FiShoppingBag />, color: 'from-blue-500 to-blue-600', link: '/admin/orders' },
    { label: 'Pending', value: stats?.pendingOrders || 0, icon: <FiClock />, color: 'from-yellow-500 to-orange-500', link: '/admin/orders' },
    { label: 'Delivered', value: stats?.deliveredOrders || 0, icon: <FiTruck />, color: 'from-green-500 to-emerald-600', link: '/admin/orders' },
    { label: 'Cancelled', value: stats?.cancelledOrders || 0, icon: <FiXCircle />, color: 'from-red-500 to-red-600', link: '/admin/orders' },
    { label: 'Revenue', value: `₹${(stats?.totalRevenue || 0).toLocaleString('en-IN')}`, icon: <FiDollarSign />, color: 'from-primary-500 to-primary-700', link: '/admin/reports' },
    { label: 'Pending Payments', value: `₹${(stats?.totalPending || 0).toLocaleString('en-IN')}`, icon: <FiDollarSign />, color: 'from-orange-500 to-amber-600', link: '/admin/payments' },
    { label: 'Customers', value: stats?.totalCustomers || 0, icon: <FiUsers />, color: 'from-indigo-500 to-indigo-600', link: '/admin/customers' },
    { label: 'Products', value: stats?.totalProducts || 0, icon: <FiPackage />, color: 'from-teal-500 to-teal-600', link: '/admin/products' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Today */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white">
        <h2 className="text-lg font-semibold mb-1">Today's Summary</h2>
        <div className="flex gap-8 mt-3">
          <div><p className="text-3xl font-bold">{stats?.todayOrders || 0}</p><p className="text-primary-200 text-sm">Orders Today</p></div>
          <div><p className="text-3xl font-bold">₹{(stats?.todayRevenue || 0).toLocaleString('en-IN')}</p><p className="text-primary-200 text-sm">Revenue Today</p></div>
          
          <div className="flex gap-3 ml-auto">
            {stats?.todayScheduled > 0 && (
              <Link to="/admin/deliveries" className="flex items-center gap-2 bg-indigo-500/30 hover:bg-indigo-500/50 transition-colors rounded-xl px-4 py-2">
                <FiCalendar className="text-indigo-200" />
                <div><p className="text-sm font-bold text-white leading-tight">{stats.todayScheduled}</p><p className="text-[10px] text-indigo-100 uppercase tracking-wider">Scheduled Today</p></div>
              </Link>
            )}
            {stats?.lateScheduled > 0 && (
              <Link to="/admin/deliveries" className="flex items-center gap-2 bg-red-500/40 hover:bg-red-500/60 transition-colors rounded-xl px-4 py-2 border border-red-400/30">
                <FiAlertTriangle className="text-red-200" />
                <div><p className="text-sm font-bold text-white leading-tight">{stats.lateScheduled}</p><p className="text-[10px] text-red-100 uppercase tracking-wider">Late Deliveries</p></div>
              </Link>
            )}
            {stats?.lowStockProducts > 0 && (
              <div className="flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2">
                <FiAlertTriangle className="text-yellow-300" />
                <span className="text-sm">{stats.lowStockProducts} low stock items</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <Link key={i} to={card.link} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg transition-all group">
            <div className={`w-10 h-10 bg-gradient-to-r ${card.color} rounded-xl flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform`}>
              {card.icon}
            </div>
            <p className="text-2xl font-bold text-gray-800">{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">Last 7 Days Revenue</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData?.last7Days || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
              <Bar dataKey="revenue" fill="#7e22ce" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customer Types */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">Customer Types</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={chartData?.customerTypes?.map(c => ({ name: c._id?.replace(/_/g, ' ') || 'Unknown', value: c.count })) || []}
                cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {(chartData?.customerTypes || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Recent Orders</h3>
          <Link to="/admin/orders" className="text-primary-600 text-sm font-medium flex items-center gap-1 hover:text-primary-700">View All <FiArrowRight /></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left py-3 px-4 text-gray-500 font-medium">Order</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">Customer</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">Amount</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
              <th className="text-left py-3 px-4 text-gray-500 font-medium">Payment</th>
            </tr></thead>
            <tbody>
              {(stats?.recentOrders || []).slice(0, 5).map(order => (
                <tr key={order._id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">#{order.orderNumber}</td>
                  <td className="py-3 px-4">{order.user?.name}</td>
                  <td className="py-3 px-4 font-semibold text-primary-600">₹{order.finalAmount}</td>
                  <td className="py-3 px-4"><span className="px-2 py-1 rounded-full text-xs font-medium capitalize bg-primary-50 text-primary-700">{order.orderStatus?.replace(/_/g, ' ')}</span></td>
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
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 mb-4">Top Selling Products</h3>
            <div className="space-y-3">
              {chartData.topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 font-bold text-sm">{i + 1}</span>
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary-600">{p.totalSold} sold</p>
                    <p className="text-xs text-gray-400">₹{p.price}/unit</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {reorderList.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-red-800 flex items-center gap-2">
                <FiRefreshCw className="animate-spin-slow" /> Auto-Reorder Suggestions
              </h3>
              <Link to="/admin/suppliers" className="text-sm font-medium text-red-600 hover:text-red-700">Create PO →</Link>
            </div>
            <div className="space-y-3">
              {reorderList.slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                  <div>
                    <span className="font-medium text-red-900">{p.name}</span>
                    <p className="text-xs text-red-700 mt-1">Stock: {p.stock} (Min: {p.minStock})</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-800">{p.totalSold > 100 ? '🔥 High Demand' : '📉 Low Stock'}</p>
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
