import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getUsers, updateUser, getUserStats } from '../../services/api';
import toast from 'react-hot-toast';
import { FiSearch, FiUsers, FiUserCheck, FiUserX, FiUserPlus, FiEye } from 'react-icons/fi';

const STAT_COLORS = [
  { key: 'public', label: 'Public', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
  { key: 'hotel', label: 'Hotel / Restaurants', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
  { key: 'pg_hostel', label: 'PG / Hostel', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' }
];

export default function AdminCustomers() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchUsers = useCallback((page = 1) => {
    const params = { page, limit: 20 };
    if (search) params.search = search;
    if (typeFilter) params.customerType = typeFilter;
    getUsers(params).then(res => {
      setUsers(res.data.data);
      setPagination(res.data.pagination);
    }).catch(() => {});
  }, [search, typeFilter]);

  const handleToggleActive = async (user) => {
    try {
      await updateUser(user._id, { isActive: !user.isActive });
      toast.success(user.isActive ? 'User deactivated' : 'User activated');
      fetchUsers();
    } catch { toast.error('Failed'); }
  };

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => { getUserStats().then(res => setStats(res.data.data)).catch(() => {}); }, []);

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Customers</h1>

      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-primary-50 rounded-lg text-primary-600"><FiUsers className="w-4 h-4" /></div>
        <h2 className="text-base font-bold text-gray-800">Customer Summary</h2>
      </div>
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {STAT_COLORS.map((c) => {
            const row = stats.stats.find(s => s._id === c.key) || { _id: c.key, count: 0, totalSpent: 0, totalPending: 0 };
            return (
              <div key={c.label} className={`${c.bg} rounded-2xl p-5 ${c.border}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wider ${c.text}`}>{c.label}</p>
                    <p className="text-2xl font-bold text-gray-800">{row.count} <span className="text-xs text-gray-500 font-normal">customers</span></p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center ${c.text}`}><FiUserPlus className="w-5 h-5" /></div>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <p className="flex justify-between"><span>Revenue</span><span className="font-semibold">₹{row.totalSpent.toLocaleString('en-IN')}</span></p>
                  <p className="flex justify-between"><span>Outstanding</span><span className={`font-semibold ${row.totalPending > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{row.totalPending.toLocaleString('en-IN')}</span></p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm flex-1 min-w-[160px]">
          <div className="p-2.5 bg-primary-50 rounded-lg text-primary-600"><FiUsers className="w-5 h-5" /></div>
          <div><p className="text-xs text-gray-500">Total Customers</p><p className="text-xl font-bold text-gray-800">{stats?.totalCustomers ?? '—'}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm flex-1 min-w-[160px]">
          <div className="p-2.5 bg-green-50 rounded-lg text-green-600"><FiUserCheck className="w-5 h-5" /></div>
          <div><p className="text-xs text-gray-500">Active Customers</p><p className="text-xl font-bold text-gray-800">{stats?.activeCustomers ?? '—'}</p></div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <form onSubmit={(e) => { e.preventDefault(); fetchUsers(); }} className="relative flex-1">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Search by name, mobile..." />
        </form>
        <div className="flex gap-2">
          {['', 'public', 'hotel', 'pg_hostel'].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize ${typeFilter === t ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'}`}>
              {t ? t.replace(/_/g, '/') : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b">
              <th className="text-left py-3 px-4 font-medium text-gray-500">Customer</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Mobile</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Orders</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Total Spent</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Pending</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
            </tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold text-sm">{u.name?.[0]}</div>
                      <div><p className="font-medium">{u.name}</p><p className="text-xs text-gray-400">{u.email}</p></div>
                    </div>
                  </td>
                  <td className="py-3 px-4">{u.mobile}</td>
                  <td className="py-3 px-4 capitalize text-xs">{u.customerType?.replace(/_/g, '/')}</td>
                  <td className="py-3 px-4">{u.totalOrders}</td>
                  <td className="py-3 px-4 font-semibold">₹{u.totalSpent}</td>
                  <td className="py-3 px-4"><span className={u.pendingAmount > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>₹{u.pendingAmount}</span></td>
                  <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <Link to={`/admin/customers/${u._id}`} title="View details"
                        className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200">
                        <FiEye className="w-3.5 h-3.5" />
                      </Link>
                      <button onClick={() => handleToggleActive(u)} title="Toggle active status"
                        className={`p-1.5 rounded-lg ${u.isActive ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}>
                        {u.isActive ? <FiUserX className="w-3.5 h-3.5" /> : <FiUserCheck className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <div className="text-center py-10 text-gray-400">No customers found</div>}
      </div>

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          {Array.from({ length: pagination.pages }, (_, i) => (
            <button key={i + 1} onClick={() => fetchUsers(i + 1)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${pagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
