import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { login, sendOtp, verifyOtp } from '../../services/api';
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

      if (loginMethod === 'otp') {
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
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-mint-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-navy-800/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md animate-fadeIn relative z-10 my-8">
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="Ganesh Trades Logo"
            className="w-20 h-20 object-contain mx-auto mb-4 drop-shadow-[0_10px_25px_rgba(52,211,153,0.3)] hover:scale-105 transition-transform"
          />
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Welcome Back</h1>
          <p className="text-mint-300/80 mt-2 text-sm">Login to Ganesh Trades</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-navy-900/90 backdrop-blur-xl rounded-3xl p-8 border border-navy-700/80 space-y-5 shadow-2xl">
          
          {/* Method Selector */}
          <div className="flex bg-navy-950 rounded-xl p-1 border border-navy-800">
            <button type="button" 
              onClick={() => { setLoginMethod('password'); setOtpSent(false); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginMethod === 'password' ? 'bg-mint-500 text-navy-950 shadow-md shadow-mint-500/20' : 'text-slate-400 hover:text-white'}`}>
              Password
            </button>
            <button type="button" 
              onClick={() => setLoginMethod('otp')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginMethod === 'otp' ? 'bg-mint-500 text-navy-950 shadow-md shadow-mint-500/20' : 'text-slate-400 hover:text-white'}`}>
              OTP
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Mobile Number</label>
            <div className="relative">
              <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-mint-400" />
              <input type="tel" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})}
                disabled={otpSent}
                className="w-full pl-11 pr-4 py-3 bg-navy-950 border border-navy-700 text-slate-100 rounded-xl placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-mint-500 focus:border-transparent transition-all disabled:opacity-50"
                placeholder="10-digit mobile" required maxLength={10} />
            </div>
          </div>

          {loginMethod === 'password' && (
            <div className="animate-fadeIn">
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-mint-400" />
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full pl-11 pr-12 py-3 bg-navy-950 border border-navy-700 text-slate-100 rounded-xl placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-mint-500 focus:border-transparent transition-all"
                  placeholder="Enter password" required={loginMethod === 'password'} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-mint-400">
                  {showPass ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              <div className="text-right mt-2">
                <Link to="/forgot-password" className="text-xs font-medium text-mint-400 hover:text-mint-300 transition-colors">
                  Forgot Password?
                </Link>
              </div>
            </div>
          )}

          {loginMethod === 'otp' && otpSent && (
            <div className="animate-fadeIn">
              <label className="block text-sm font-medium text-slate-300 mb-2">Enter OTP</label>
              <div className="relative">
                <FiKey className="absolute left-4 top-1/2 -translate-y-1/2 text-mint-400" />
                <input type="text" value={form.otp} onChange={e => setForm({...form, otp: e.target.value})}
                  className="w-full pl-11 pr-4 py-3 bg-navy-950 border border-navy-700 text-slate-100 rounded-xl placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-mint-500 focus:border-transparent transition-all tracking-widest text-lg"
                  placeholder="------" required={loginMethod === 'otp' && otpSent} maxLength={6} />
              </div>
              <div className="text-right mt-2">
                <button type="button" onClick={handleSendOtp} disabled={countdown > 0}
                  className="text-xs font-medium text-mint-400 hover:text-mint-300 disabled:opacity-50">
                  {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                </button>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 flex items-center justify-center gap-2 bg-mint-500 hover:bg-mint-400 text-navy-950 rounded-xl font-extrabold transition-all shadow-lg shadow-mint-500/20 disabled:opacity-50 text-base">
            {loading ? (
              <span className="flex items-center justify-center gap-2"><span className="animate-spin rounded-full h-5 w-5 border-t-2 border-navy-950"></span> Processing...</span>
            ) : loginMethod === 'otp' && !otpSent ? (
              <>Send OTP <FiArrowRight /></>
            ) : (
              'Secure Login'
            )}
          </button>

          <p className="text-center text-slate-400 text-sm">
            Don't have an account? <Link to="/register" className="text-mint-400 font-bold hover:underline">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
