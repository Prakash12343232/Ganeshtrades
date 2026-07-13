import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, changePassword, checkServiceability } from '../../services/api';
import toast from 'react-hot-toast';
import { FiUser, FiPhone, FiMail, FiMapPin, FiLock, FiSave, FiCrosshair, FiNavigation, FiCheckCircle, FiXCircle } from 'react-icons/fi';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '', email: user?.email || '',
    address: {
      street: user?.address?.street || '', area: user?.address?.area || '',
      city: user?.address?.city || '', pincode: user?.address?.pincode || '',
      lat: user?.address?.lat || null, lng: user?.address?.lng || null
    }
  });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '' });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('profile');
  const [locating, setLocating] = useState(false);
  const [serviceInfo, setServiceInfo] = useState(null);
  const [locationStatus, setLocationStatus] = useState(
    user?.address?.lat ? `Location set (${user?.distanceFromShop || 0} KM from shop)` : ''
  );

  const detectLocation = () => {
    setLocating(true);
    setLocationStatus('Detecting your location...');
    setServiceInfo(null);
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      setLocating(false);
      setLocationStatus('Not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setForm(prev => ({ ...prev, address: { ...prev.address, lat, lng } }));
        setLocationStatus('Checking delivery serviceability...');

        try {
          const { data } = await checkServiceability(lat, lng);
          setServiceInfo(data.data);
          if (data.data.serviceable) {
            setLocationStatus(`✓ Within service area (${data.data.distance} KM)`);
            toast.success(`You are ${data.data.distance} KM from Ganesh Trades. Delivery available!`);
          } else {
            setLocationStatus(`✗ Outside service area (${data.data.distance} KM)`);
            toast.error(data.data.message);
          }
        } catch {
          setLocationStatus('Location acquired');
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationStatus('Failed to detect');
        toast.error('Failed to get location. Please allow location access.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleProfile = async (e) => {
    e.preventDefault();
    if (serviceInfo && !serviceInfo.serviceable) {
      toast.error('Cannot update address — location is outside the delivery area.');
      return;
    }
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
  const isOutOfRange = serviceInfo && !serviceInfo.serviceable;

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
        <div className="mt-4 grid grid-cols-4 gap-3 text-center">
          <div className="bg-white/10 rounded-xl p-3"><p className="text-xl font-bold">{user?.totalOrders || 0}</p><p className="text-xs text-primary-200">Orders</p></div>
          <div className="bg-white/10 rounded-xl p-3"><p className="text-xl font-bold">₹{user?.totalSpent || 0}</p><p className="text-xs text-primary-200">Spent</p></div>
          <div className="bg-white/10 rounded-xl p-3"><p className="text-xl font-bold">₹{user?.pendingAmount || 0}</p><p className="text-xs text-primary-200">Pending</p></div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xl font-bold">{user?.distanceFromShop || '—'}</p>
            <p className="text-xs text-primary-200">KM Away</p>
          </div>
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

          {/* Location Detection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2">
                <FiMapPin className="text-primary-500" />
                <span className="text-sm text-gray-700">{locationStatus || 'Update your location'}</span>
              </div>
              <button type="button" onClick={detectLocation} disabled={locating}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 rounded-lg text-xs text-white font-medium transition-colors disabled:opacity-50">
                <FiCrosshair className={locating ? 'animate-spin' : ''} /> {locating ? 'Detecting...' : 'Update Location'}
              </button>
            </div>

            {/* Serviceability Result */}
            {serviceInfo && (
              <div className={`p-3 rounded-xl border ${serviceInfo.serviceable
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-2">
                  {serviceInfo.serviceable ? (
                    <FiCheckCircle className="text-green-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <FiXCircle className="text-red-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${serviceInfo.serviceable ? 'text-green-700' : 'text-red-700'}`}>
                      {serviceInfo.serviceable ? 'Delivery Available' : 'Outside Service Area'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{serviceInfo.message}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><FiNavigation className="w-3 h-3" /> {serviceInfo.distance} KM</span>
                      <span>•</span>
                      <span>Radius: {serviceInfo.radius} KM</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading || isOutOfRange}
            className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
              isOutOfRange
                ? 'bg-red-500 text-white cursor-not-allowed opacity-60'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}>
            <FiSave /> {loading ? 'Saving...' : isOutOfRange ? 'Cannot Save — Outside Service Area' : 'Save Changes'}
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
