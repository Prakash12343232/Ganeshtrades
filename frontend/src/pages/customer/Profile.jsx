import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, changePassword } from '../../services/api';
import toast from 'react-hot-toast';
import { FiUser, FiPhone, FiMail, FiMapPin, FiLock, FiSave } from 'react-icons/fi';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '',
    address: { street: user?.address?.street || '', area: user?.address?.area || '', city: user?.address?.city || '', pincode: user?.address?.pincode || '' }
  });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '' });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('profile');

  const handleProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await updateProfile(form);
      updateUser(data.user);
      toast.success('Profile updated!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    try {
      await changePassword(passForm);
      toast.success('Password changed!');
      setPassForm({ currentPassword: '', newPassword: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const TYPE_LABELS = { public: '👤 Public Customer', hotel: '🏨 Hotel Customer', pg_hostel: '🏠 PG/Hostel' };

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">My Profile</h1>

      {/* User Card */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold backdrop-blur-sm">{user?.name?.[0]}</div>
          <div>
            <h2 className="text-xl font-bold">{user?.name}</h2>
            <p className="text-primary-200 text-sm">📱 {user?.mobile}</p>
            <span className="inline-block mt-1 px-3 py-0.5 bg-white/20 rounded-full text-xs">{TYPE_LABELS[user?.customerType]}</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div className="bg-white/10 rounded-xl p-3"><p className="text-xl font-bold">{user?.totalOrders || 0}</p><p className="text-xs text-primary-200">Orders</p></div>
          <div className="bg-white/10 rounded-xl p-3"><p className="text-xl font-bold">₹{user?.totalSpent || 0}</p><p className="text-xs text-primary-200">Spent</p></div>
          <div className="bg-white/10 rounded-xl p-3"><p className="text-xl font-bold">₹{user?.pendingAmount || 0}</p><p className="text-xs text-primary-200">Pending</p></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('profile')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'profile' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'}`}>Edit Profile</button>
        <button onClick={() => setTab('password')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'password' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'}`}>Change Password</button>
      </div>

      {tab === 'profile' ? (
        <form onSubmit={handleProfile} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={form.address.street} onChange={e => setForm({...form, address: {...form.address, street: e.target.value}})}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Street" />
            <input type="text" value={form.address.area} onChange={e => setForm({...form, address: {...form.address, area: e.target.value}})}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Area" />
            <input type="text" value={form.address.city} onChange={e => setForm({...form, address: {...form.address, city: e.target.value}})}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="City" />
            <input type="text" value={form.address.pincode} onChange={e => setForm({...form, address: {...form.address, pincode: e.target.value}})}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Pincode" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 flex items-center justify-center gap-2">
            <FiSave /> {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      ) : (
        <form onSubmit={handlePassword} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input type="password" value={passForm.currentPassword} onChange={e => setPassForm({...passForm, currentPassword: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={passForm.newPassword} onChange={e => setPassForm({...passForm, newPassword: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" required minLength={6} />
          </div>
          <button type="submit" className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 flex items-center justify-center gap-2">
            <FiLock /> Change Password
          </button>
        </form>
      )}
    </div>
  );
}
