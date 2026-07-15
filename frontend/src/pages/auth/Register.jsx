import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { register, checkServiceability, sendOtp, verifyOtp } from '../../services/api';
import toast from 'react-hot-toast';
import { FiUser, FiPhone, FiMail, FiLock, FiMapPin, FiCrosshair, FiCheckCircle, FiXCircle, FiNavigation, FiKey } from 'react-icons/fi';

export default function Register() {
  const [form, setForm] = useState({ name: '', mobile: '', email: '', password: '', customerType: 'public', address: { street: '', area: '', city: '', pincode: '', lat: null, lng: null }, otp: '' });
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [serviceInfo, setServiceInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const { loginUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(form.mobile)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      await sendOtp({ mobile: form.mobile, purpose: 'register' });
      setOtpSent(true);
      setCountdown(60);
      toast.success('OTP sent to your mobile number');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

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
    
    if (!otpSent) {
      await handleSendOtp();
      return;
    }

    if (!form.otp || form.otp.length < 6) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      // 1. Verify OTP first
      await verifyOtp({ mobile: form.mobile, otp: form.otp, purpose: 'register' });
      
      // 2. Register User
      const { data } = await register({
        name: form.name,
        mobile: form.mobile,
        email: form.email,
        password: form.password,
        customerType: form.customerType,
        address: form.address
      });
      
      loginUser(data.user, data.token);
      toast.success('Registration successful!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification or Registration failed');
    } finally { 
      setLoading(false); 
    }
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
      <div className="w-full max-w-lg animate-fadeIn mt-10">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-lg rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/20">
            <span className="text-3xl font-bold text-white">G</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-primary-200 mt-1 text-sm">Join Ganesh Trades</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 space-y-4 shadow-2xl relative overflow-hidden">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-primary-100 mb-1">Full Name</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-300 text-sm" />
                <input type="text" value={form.name} onChange={e => updateField('name', e.target.value)} disabled={otpSent}
                  className="w-full pl-9 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm disabled:opacity-50" placeholder="Your name" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-100 mb-1">Mobile</label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-300 text-sm" />
                <input type="tel" value={form.mobile} onChange={e => updateField('mobile', e.target.value)} disabled={otpSent}
                  className="w-full pl-9 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm disabled:opacity-50" placeholder="10-digit mobile" required maxLength={10} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-primary-100 mb-1">Email (Optional)</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-300 text-sm" />
                <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} disabled={otpSent}
                  className="w-full pl-9 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm disabled:opacity-50" placeholder="Email" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary-100 mb-1">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-300 text-sm" />
                <input type="password" value={form.password} onChange={e => updateField('password', e.target.value)} disabled={otpSent}
                  className="w-full pl-9 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm disabled:opacity-50" placeholder="Min 8 chars" required minLength={8} />
              </div>
            </div>
          </div>

          <div className={`transition-all duration-300 ${otpSent ? 'opacity-50 pointer-events-none hidden' : 'block'}`}>
            <label className="block text-xs font-medium text-primary-100 mb-1">Customer Type</label>
            <select value={form.customerType} onChange={e => updateField('customerType', e.target.value)}
              className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm">
              <option value="public" className="text-gray-900">Public Customer</option>
              <option value="hotel" className="text-gray-900">Hotel Customer</option>
              <option value="pg_hostel" className="text-gray-900">PG / Hostel</option>
            </select>
          </div>

          <div className={`transition-all duration-300 ${otpSent ? 'opacity-50 pointer-events-none hidden' : 'block'}`}>
            <label className="block text-xs font-medium text-primary-100 mb-1">Address</label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input type="text" value={form.address.street} onChange={e => updateAddress('street', e.target.value)}
                className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm" placeholder="Street" />
              <input type="text" value={form.address.area} onChange={e => updateAddress('area', e.target.value)}
                className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm" placeholder="Area" />
              <input type="text" value={form.address.city} onChange={e => updateAddress('city', e.target.value)}
                className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm" placeholder="City" />
              <input type="text" value={form.address.pincode} onChange={e => updateAddress('pincode', e.target.value)}
                className="px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm" placeholder="Pincode" />
            </div>

            {/* Location Detection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/10">
                <div className="flex items-center gap-2">
                  <FiMapPin className="text-primary-300" />
                  <span className="text-sm text-white">{locationStatus || 'Delivery Radius Check Required'}</span>
                </div>
                <button type="button" onClick={detectLocation} disabled={locating}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 rounded text-xs text-white font-medium transition-colors disabled:opacity-50 shadow-md">
                  <FiCrosshair className={locating ? 'animate-spin' : ''} /> {locating ? 'Detecting...' : 'Detect Location'}
                </button>
              </div>

              {serviceInfo && (
                <div className={`p-3 rounded-lg border ${serviceInfo.serviceable ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} transition-all duration-300`}>
                  <div className="flex items-start gap-2">
                    {serviceInfo.serviceable ? <FiCheckCircle className="text-green-400 mt-0.5 flex-shrink-0" /> : <FiXCircle className="text-red-400 mt-0.5 flex-shrink-0" />}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${serviceInfo.serviceable ? 'text-green-300' : 'text-red-300'}`}>
                        {serviceInfo.serviceable ? 'Delivery Available!' : 'Outside Service Area'}
                      </p>
                      <p className="text-xs text-white/70 mt-0.5">{serviceInfo.message}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* OTP Section (Visible after clicking Verify Mobile) */}
          {otpSent && (
            <div className="animate-fadeIn bg-primary-900/50 p-4 rounded-xl border border-primary-500/30 mt-4">
              <label className="block text-sm font-medium text-white mb-2 text-center">Enter the OTP sent to {form.mobile}</label>
              <div className="relative max-w-[200px] mx-auto">
                <FiKey className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-300" />
                <input type="text" value={form.otp} onChange={e => updateField('otp', e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-primary-500/50 rounded-xl text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all tracking-widest text-xl text-center font-bold"
                  placeholder="------" required maxLength={6} />
              </div>
              <div className="text-center mt-3">
                <button type="button" onClick={handleSendOtp} disabled={countdown > 0}
                  className="text-xs font-medium text-primary-300 hover:text-white transition-colors disabled:opacity-50">
                  {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Didn\'t receive? Resend OTP'}
                </button>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading || isOutOfRange}
            className={`w-full py-3.5 rounded-xl font-bold transition-all shadow-lg text-sm mt-4 disabled:opacity-50 flex justify-center items-center gap-2 ${
              isOutOfRange
                ? 'bg-red-600/50 text-red-200 cursor-not-allowed'
                : 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700'
            }`}>
            {loading ? <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></span> : null}
            {isOutOfRange ? 'Outside Service Area' : otpSent ? 'Verify & Create Account' : 'Verify Mobile Number'}
          </button>

          <p className="text-center text-primary-200 text-sm mt-4">
            Already have an account? <Link to="/login" className="text-white font-semibold hover:underline">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
