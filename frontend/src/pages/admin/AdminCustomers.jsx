import { useState, useEffect } from 'react';
import { getUsers, updateUser } from '../../services/api';
import toast from 'react-hot-toast';
import { FiSearch, FiEdit2, FiUserCheck, FiUserX } from 'react-icons/fi';

export default function AdminCustomers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchUsers = () => {
    const params = { limit: 50 };
    if (search) params.search = search;
    if (typeFilter) params.customerType = typeFilter;
    getUsers(params).then(res => setUsers(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [typeFilter]);

  const handleToggleActive = async (user) => {
    try {
      await updateUser(user._id, { isActive: !user.isActive });
      toast.success(user.isActive ? 'User deactivated' : 'User activated');
      fetchUsers();
    } catch (err) { toast.error('Failed'); }
  };

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Customers</h1>

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
                    <button onClick={() => handleToggleActive(u)}
                      className={`p-1.5 rounded-lg ${u.isActive ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}>
                      {u.isActive ? <FiUserX className="w-3.5 h-3.5" /> : <FiUserCheck className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <div className="text-center py-10 text-gray-400">No customers found</div>}
      </div>
    </div>
  );
}
