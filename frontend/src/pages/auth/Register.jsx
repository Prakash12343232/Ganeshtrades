import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { register, checkServiceability } from '../../services/api';
import toast from 'react-hot-toast';
import { FiUser, FiPhone, FiMail, FiLock, FiMapPin, FiCrosshair, FiCheckCircle, FiXCircle, FiNavigation } from 'react-icons/fi';

export default function Register() {
  const [form, setForm] = useState({ name: '', mobile: '', email: '', password: '', customerType: 'public', address: { street: '', area: '', city: '', pincode: '', lat: null, lng: null } });
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [serviceInfo, setServiceInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.address.lat || !form.address.lng) {
      toast.error('Please detect your location first to verify delivery radius.');
      return;
    }
    if (serviceInfo && !serviceInfo.serviceable) {
      toast.error(serviceInfo.message);
      return;
    }
    setLoading(true);
    try {
      const { data } = await register(form);
      loginUser(data.user, data.token);
      toast.success('Registration successful!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

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
            toast.success(`Location verified! You are ${data.data.distance} KM from Ganesh Trades.`);
          } else {
            setLocationStatus(`✗ Outside service area (${data.data.distance} KM)`);
            toast.error(data.data.message);
          }
        } catch {
          setLocationStatus('Location acquired ✓');
          toast.success('Location acquired');
        }
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationStatus('Failed to detect location');
        toast.error('Failed to get location. Please allow location access.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const updateAddress = (field, value) => setForm(prev => ({ ...prev, address: { ...prev.address, [field]: value } }));

  const isOutOfRange = serviceInfo && !serviceInfo.serviceable;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg animate-fadeIn">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-lg rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20">
            <span className="text-3xl font-bold text-white">G</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-primary-200 mt-1 text-sm">Join Ganesh Trades</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-primary-100 mb-1">Full Name</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-300 text-sm" />
                <input type="text" value={form.name} onChange={e => updateField('name', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm" placeholder="Your name" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-100 mb-1">Mobile</label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-300 text-sm" />
                <input type="tel" value={form.mobile} onChange={e => updateField('mobile', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm" placeholder="10-digit mobile" required maxLength={10} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-primary-100 mb-1">Email (Optional)</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-300 text-sm" />
                <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm" placeholder="Email" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-100 mb-1">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-300 text-sm" />
                <input type="password" value={form.password} onChange={e => updateField('password', e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm" placeholder="Min 6 characters" required minLength={6} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-primary-100 mb-1">Customer Type</label>
            <select value={form.customerType} onChange={e => updateField('customerType', e.target.value)}
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm">
              <option value="public" className="text-gray-900">Public Customer</option>
              <option value="hotel" className="text-gray-900">Hotel Customer</option>
              <option value="pg_hostel" className="text-gray-900">PG / Hostel</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-primary-100 mb-1">Address</label>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={form.address.street} onChange={e => updateAddress('street', e.target.value)}
                className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm" placeholder="Street" />
              <input type="text" value={form.address.area} onChange={e => updateAddress('area', e.target.value)}
                className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm" placeholder="Area" />
              <input type="text" value={form.address.city} onChange={e => updateAddress('city', e.target.value)}
                className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm" placeholder="City" />
              <input type="text" value={form.address.pincode} onChange={e => updateAddress('pincode', e.target.value)}
                className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm" placeholder="Pincode" />
            </div>

            {/* Location Detection & Serviceability Status */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/10">
                <div className="flex items-center gap-2">
                  <FiMapPin className="text-primary-300" />
                  <span className="text-sm text-white">{locationStatus || 'Delivery Radius Check Required'}</span>
                </div>
                <button type="button" onClick={detectLocation} disabled={locating}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 rounded text-xs text-white font-medium transition-colors disabled:opacity-50">
                  <FiCrosshair className={locating ? 'animate-spin' : ''} /> {locating ? 'Detecting...' : 'Detect Location'}
                </button>
              </div>

              {/* Serviceability Result Card */}
              {serviceInfo && (
                <div className={`p-3 rounded-lg border ${serviceInfo.serviceable
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
                } transition-all duration-300`}>
                  <div className="flex items-start gap-2">
                    {serviceInfo.serviceable ? (
                      <FiCheckCircle className="text-green-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <FiXCircle className="text-red-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${serviceInfo.serviceable ? 'text-green-300' : 'text-red-300'}`}>
                        {serviceInfo.serviceable ? 'Delivery Available!' : 'Outside Service Area'}
                      </p>
                      <p className="text-xs text-white/70 mt-0.5">{serviceInfo.message}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-white/60">
                        <span className="flex items-center gap-1">
                          <FiNavigation className="w-3 h-3" /> {serviceInfo.distance} KM from shop
                        </span>
                        <span>•</span>
                        <span>Radius: {serviceInfo.radius} KM</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={loading || isOutOfRange}
            className={`w-full py-3 rounded-xl font-semibold transition-all shadow-lg disabled:opacity-50 ${
              isOutOfRange
                ? 'bg-red-600/50 text-red-200 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700'
            }`}>
            {loading ? 'Creating Account...' : isOutOfRange ? 'Registration Blocked — Outside Service Area' : 'Register'}
          </button>

          <p className="text-center text-primary-200 text-sm">
            Already have an account? <Link to="/login" className="text-white font-semibold hover:underline">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
