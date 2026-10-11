import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { login } from '../../services/api';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import toast from 'react-hot-toast';
import { FiPhone, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';

export default function Login() {
  const [form, setForm] = useState({ mobile: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSuccess = (data) => {
    loginUser(data.user, data.token);
    toast.success(`Welcome back, ${data.user.name || 'valued customer'}!`);
    navigate(data.user.role === 'admin' || data.user.role === 'manager' ? '/admin' : '/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(form.mobile)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!form.password) {
      toast.error('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      const { data } = await login({
        mobile: form.mobile,
        password: form.password,
        useOtp: false
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
          <p className="text-mint-300/80 mt-2 text-sm">Sign in to Ganesh Trades</p>
        </div>

        <div className="bg-navy-900/90 backdrop-blur-xl rounded-3xl p-8 border border-navy-700/80 space-y-6 shadow-2xl">
          
          {/* Primary Quick Auth: Google Sign-In */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">
              Instant One-Click Sign In
            </label>
            <GoogleSignInButton onSuccess={handleGoogleSuccess} text="Continue with Google" />
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-navy-700/80"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-navy-900 px-3 text-slate-400 font-medium">Or sign in with password</span>
            </div>
          </div>

          {/* Mobile + Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Mobile Number</label>
              <div className="relative">
                <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-mint-400" />
                <input 
                  type="tel" 
                  value={form.mobile} 
                  onChange={e => setForm({...form, mobile: e.target.value})}
                  className="w-full pl-11 pr-4 py-3 bg-navy-950 border border-navy-700 text-slate-100 rounded-xl placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-mint-500 focus:border-transparent transition-all"
                  placeholder="10-digit mobile" 
                  required 
                  maxLength={10} 
                />
              </div>
            </div>

            <div className="animate-fadeIn">
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-mint-400" />
                <input 
                  type={showPass ? 'text' : 'password'} 
                  value={form.password} 
                  onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full pl-11 pr-12 py-3 bg-navy-950 border border-navy-700 text-slate-100 rounded-xl placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-mint-500 focus:border-transparent transition-all"
                  placeholder="Enter password" 
                  required 
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-mint-400 cursor-pointer">
                  {showPass ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              <div className="text-right mt-2">
                <Link to="/forgot-password" className="text-xs font-medium text-mint-400 hover:text-mint-300 transition-colors">
                  Forgot Password?
                </Link>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3.5 flex items-center justify-center gap-2 bg-mint-500 hover:bg-mint-400 text-navy-950 rounded-xl font-extrabold transition-all shadow-lg shadow-mint-500/20 disabled:opacity-50 text-base cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-t-2 border-navy-950"></span> 
                  Signing in...
                </span>
              ) : (
                'Sign In with Password'
              )}
            </button>

            <p className="text-center text-slate-400 text-sm pt-2">
              Don't have an account? <Link to="/register" className="text-mint-400 font-bold hover:underline">Register</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
