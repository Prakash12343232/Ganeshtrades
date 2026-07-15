import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { login, sendOtp } from '../../services/api';
import toast from 'react-hot-toast';
import { FiPhone, FiLock, FiEye, FiEyeOff, FiKey, FiArrowRight } from 'react-icons/fi';

export default function Login() {
  const [form, setForm] = useState({ mobile: '', password: '', otp: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' or 'otp'
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
      await sendOtp({ mobile: form.mobile, purpose: 'login' });
      setOtpSent(true);
      setCountdown(60); // 60 seconds cooldown
      toast.success('OTP sent to your mobile number');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (loginMethod === 'otp') {
        if (!otpSent) {
          await handleSendOtp();
          setLoading(false);
          return;
        }
        
        // Ensure OTP is provided if sent
        if (!form.otp || form.otp.length < 6) {
          toast.error('Please enter the 6-digit OTP');
          setLoading(false);
          return;
        }
      }

      const payload = {
        mobile: form.mobile,
        password: form.password,
        useOtp: loginMethod === 'otp',
        otp: form.otp // login endpoint handles otp verification if useOtp is true via the separate verify logic inside the backend, actually wait!
      };

      // Ah, our backend expects verify-otp to be called first for login, or we can just send it and let the backend do it.
      // Wait, in auth.js we wrote:
      // if (useOtp) { const verifiedOtp = await Otp.findOne({ mobile: normMobile, purpose: 'login', verified: true });
      // This means OTP must be verified BEFORE calling /login!
      
      if (loginMethod === 'otp') {
        const { verifyOtp } = await import('../../services/api');
        await verifyOtp({ mobile: form.mobile, otp: form.otp, purpose: 'login' });
        // After successful verification, call login to get the token
      }

      const { data } = await login({
        mobile: form.mobile,
        password: form.password,
        useOtp: loginMethod === 'otp'
      });
      
      loginUser(data.user, data.token);
      toast.success('Welcome back!');
      navigate(data.user.role === 'admin' || data.user.role === 'manager' ? '/admin' : '/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-lg rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
            <span className="text-4xl font-bold text-white">G</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome Back</h1>
          <p className="text-primary-200 mt-2">Login to Ganesh Trades</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 space-y-5 shadow-2xl">
          
          {/* Method Selector */}
          <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
            <button type="button" 
              onClick={() => { setLoginMethod('password'); setOtpSent(false); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${loginMethod === 'password' ? 'bg-primary-600 text-white shadow' : 'text-primary-300 hover:text-white'}`}>
              Password
            </button>
            <button type="button" 
              onClick={() => setLoginMethod('otp')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${loginMethod === 'otp' ? 'bg-primary-600 text-white shadow' : 'text-primary-300 hover:text-white'}`}>
              OTP
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-100 mb-2">Mobile Number</label>
            <div className="relative">
              <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-300" />
              <input type="tel" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})}
                disabled={otpSent}
                className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all disabled:opacity-50"
                placeholder="10-digit mobile" required maxLength={10} />
            </div>
          </div>

          {loginMethod === 'password' && (
            <div className="animate-fadeIn">
              <label className="block text-sm font-medium text-primary-100 mb-2">Password</label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-300" />
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full pl-11 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all"
                  placeholder="Enter password" required={loginMethod === 'password'} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-300 hover:text-white">
                  {showPass ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>
          )}

          {loginMethod === 'otp' && otpSent && (
            <div className="animate-fadeIn">
              <label className="block text-sm font-medium text-primary-100 mb-2">Enter OTP</label>
              <div className="relative">
                <FiKey className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-300" />
                <input type="text" value={form.otp} onChange={e => setForm({...form, otp: e.target.value})}
                  className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all tracking-widest text-lg"
                  placeholder="------" required={loginMethod === 'otp' && otpSent} maxLength={6} />
              </div>
              <div className="text-right mt-2">
                <button type="button" onClick={handleSendOtp} disabled={countdown > 0}
                  className="text-xs font-medium text-primary-300 hover:text-white disabled:opacity-50">
                  {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg shadow-primary-900/50 disabled:opacity-50">
            {loading ? (
              <span className="flex items-center justify-center gap-2"><span className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></span> Processing...</span>
            ) : loginMethod === 'otp' && !otpSent ? (
              <>Send OTP <FiArrowRight /></>
            ) : (
              'Secure Login'
            )}
          </button>

          <p className="text-center text-primary-200 text-sm">
            Don't have an account? <Link to="/register" className="text-white font-semibold hover:underline">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
