import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, changePassword, checkServiceability } from '../../services/api';
import toast from 'react-hot-toast';
import { FiMapPin, FiLock, FiSave, FiCrosshair, FiNavigation, FiCheckCircle, FiXCircle } from 'react-icons/fi';

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
      <h1 className="text-2xl font-bold text-white mb-6">My Profile</h1>

      {/* User Card */}
      <div className="bg-gradient-to-r from-navy-850 via-navy-900 to-navy-950 border border-mint-500/30 rounded-2xl p-6 text-white mb-6 shadow-xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-mint-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 bg-mint-500 text-navy-950 rounded-2xl flex items-center justify-center text-2xl font-extrabold shadow-lg shadow-mint-500/20">{user?.name?.[0]}</div>
          <div>
            <h2 className="text-xl font-bold text-white">{user?.name}</h2>
            <p className="text-mint-300 text-sm">📱 {user?.mobile}</p>
            <span className="inline-block mt-1 px-3 py-0.5 bg-mint-500/10 border border-mint-500/30 text-mint-300 rounded-full text-xs font-semibold">{TYPE_LABELS[user?.customerType]}</span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-3 text-center relative z-10">
          <div className="bg-navy-950/60 border border-navy-800 rounded-xl p-3"><p className="text-xl font-bold text-white">{user?.totalOrders || 0}</p><p className="text-xs text-slate-400">Orders</p></div>
          <div className="bg-navy-950/60 border border-navy-800 rounded-xl p-3"><p className="text-xl font-bold text-mint-400">₹{user?.totalSpent || 0}</p><p className="text-xs text-slate-400">Spent</p></div>
          <div className="bg-navy-950/60 border border-navy-800 rounded-xl p-3"><p className="text-xl font-bold text-amber-300">₹{user?.pendingAmount || 0}</p><p className="text-xs text-slate-400">Pending</p></div>
          <div className="bg-navy-950/60 border border-navy-800 rounded-xl p-3">
            <p className="text-xl font-bold text-slate-200">{user?.distanceFromShop || '—'}</p>
            <p className="text-xs text-slate-400">KM Away</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('profile')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'profile' ? 'bg-mint-500 text-navy-950 shadow-lg shadow-mint-500/20' : 'bg-navy-900 text-slate-300 border border-navy-800 hover:border-mint-500/30'}`}>Edit Profile</button>
        <button onClick={() => setTab('password')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'password' ? 'bg-mint-500 text-navy-950 shadow-lg shadow-mint-500/20' : 'bg-navy-900 text-slate-300 border border-navy-800 hover:border-mint-500/30'}`}>Change Password</button>
      </div>

      {tab === 'profile' ? (
        <form onSubmit={handleProfile} className="bg-navy-900 rounded-2xl border border-navy-800 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-4 py-3 bg-navy-950 border border-navy-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="w-full px-4 py-3 bg-navy-950 border border-navy-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={form.address.street} onChange={e => setForm({...form, address: {...form.address, street: e.target.value}})}
              className="px-4 py-3 bg-navy-950 border border-navy-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint-500 placeholder-slate-500" placeholder="Street" />
            <input type="text" value={form.address.area} onChange={e => setForm({...form, address: {...form.address, area: e.target.value}})}
              className="px-4 py-3 bg-navy-950 border border-navy-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint-500 placeholder-slate-500" placeholder="Area" />
            <input type="text" value={form.address.city} onChange={e => setForm({...form, address: {...form.address, city: e.target.value}})}
              className="px-4 py-3 bg-navy-950 border border-navy-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint-500 placeholder-slate-500" placeholder="City" />
            <input type="text" value={form.address.pincode} onChange={e => setForm({...form, address: {...form.address, pincode: e.target.value}})}
              className="px-4 py-3 bg-navy-950 border border-navy-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint-500 placeholder-slate-500" placeholder="Pincode" />
          </div>

          {/* Location Detection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-navy-950 p-3 rounded-xl border border-navy-800">
              <div className="flex items-center gap-2">
                <FiMapPin className="text-mint-400" />
                <span className="text-sm text-slate-300">{locationStatus || 'Update your location'}</span>
              </div>
              <button type="button" onClick={detectLocation} disabled={locating}
                className="flex items-center gap-1 px-3 py-1.5 bg-mint-500 hover:bg-mint-400 rounded-lg text-xs text-navy-950 font-bold transition-colors disabled:opacity-50">
                <FiCrosshair className={locating ? 'animate-spin' : ''} /> {locating ? 'Detecting...' : 'Update Location'}
              </button>
            </div>

            {/* Serviceability Result */}
            {serviceInfo && (
              <div className={`p-3 rounded-xl border ${serviceInfo.serviceable
                ? 'bg-mint-500/10 border-mint-500/30'
                : 'bg-rose-500/10 border-rose-500/30'
              }`}>
                <div className="flex items-start gap-2">
                  {serviceInfo.serviceable ? (
                    <FiCheckCircle className="text-mint-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <FiXCircle className="text-rose-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${serviceInfo.serviceable ? 'text-mint-300' : 'text-rose-300'}`}>
                      {serviceInfo.serviceable ? 'Delivery Available' : 'Outside Service Area'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{serviceInfo.message}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><FiNavigation className="w-3 h-3 text-mint-400" /> {serviceInfo.distance} KM</span>
                      <span>•</span>
                      <span>Radius: {serviceInfo.radius} KM</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading || isOutOfRange}
            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              isOutOfRange
                ? 'bg-rose-500 text-white cursor-not-allowed opacity-60'
                : 'bg-mint-500 text-navy-950 hover:bg-mint-400 shadow-lg shadow-mint-500/20'
            }`}>
            <FiSave /> {loading ? 'Saving...' : isOutOfRange ? 'Cannot Save — Outside Service Area' : 'Save Changes'}
          </button>
        </form>
      ) : (
        <form onSubmit={handlePassword} className="bg-navy-900 rounded-2xl border border-navy-800 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Current Password</label>
            <input type="password" value={passForm.currentPassword} onChange={e => setPassForm({...passForm, currentPassword: e.target.value})}
              className="w-full px-4 py-3 bg-navy-950 border border-navy-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">New Password</label>
            <input type="password" value={passForm.newPassword} onChange={e => setPassForm({...passForm, newPassword: e.target.value})}
              className="w-full px-4 py-3 bg-navy-950 border border-navy-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint-500" required minLength={6} />
          </div>
          <button type="submit" className="w-full py-3 bg-mint-500 text-navy-950 rounded-xl font-bold hover:bg-mint-400 flex items-center justify-center gap-2 shadow-lg shadow-mint-500/20">
            <FiLock /> Change Password
          </button>
        </form>
      )}
    </div>
  );
}
