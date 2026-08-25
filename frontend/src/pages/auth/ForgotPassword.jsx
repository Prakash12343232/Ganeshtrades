import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword, resetPassword, sendOtp } from '../../services/api';
import toast from 'react-hot-toast';
import { FiPhone, FiKey, FiLock, FiArrowLeft, FiEye, FiEyeOff, FiCheck, FiX } from 'react-icons/fi';

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1: mobile, 2: otp, 3: new password
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let timer;
    if (countdown > 0) timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Password strength checks
  const checks = [
    { label: 'At least 8 characters', pass: password.length >= 8 },
    { label: 'One uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', pass: /[a-z]/.test(password) },
    { label: 'One number', pass: /[0-9]/.test(password) },
    { label: 'One special character', pass: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) },
  ];
  const passedCount = checks.filter(c => c.pass).length;
  const strength = passedCount >= 5 ? 'strong' : passedCount >= 3 ? 'medium' : 'weak';
  const strengthColor = { weak: 'bg-red-500', medium: 'bg-amber-500', strong: 'bg-green-500' };

  const handleSendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile)) return toast.error('Enter valid 10-digit mobile');
    setLoading(true);
    try {
      await forgotPassword({ mobile });
      setStep(2);
      setCountdown(60);
      toast.success('OTP sent to your mobile');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) return toast.error('Enter 6-digit OTP');
    setStep(3);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) return toast.error('Passwords do not match');
    if (strength === 'weak') return toast.error('Password is too weak');
    setLoading(true);
    try {
      await resetPassword({ mobile, otp, newPassword: password });
      toast.success('Password reset successfully!');
      navigate('/login');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to reset'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-lg rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
            <FiLock className="text-3xl text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Reset Password</h1>
          <p className="text-primary-200 mt-2">
            {step === 1 && 'Enter your mobile number'}
            {step === 2 && 'Verify your identity'}
            {step === 3 && 'Create a strong new password'}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex items-center gap-2`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-primary-500 text-white' : 'bg-white/10 text-primary-300'}`}>
                {step > s ? <FiCheck /> : s}
              </div>
              {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-primary-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl space-y-5">
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-sm font-medium text-primary-100 mb-2">Mobile Number</label>
                <div className="relative">
                  <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-300" />
                  <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 transition-all"
                    placeholder="10-digit mobile" maxLength={10} />
                </div>
              </div>
              <button onClick={handleSendOtp} disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg disabled:opacity-50">
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-sm font-medium text-primary-100 mb-2">Enter OTP sent to {mobile}</label>
                <div className="relative">
                  <FiKey className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-300" />
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 transition-all tracking-widest text-lg text-center"
                    placeholder="------" maxLength={6} />
                </div>
                <div className="text-right mt-2">
                  <button type="button" onClick={handleSendOtp} disabled={countdown > 0}
                    className="text-xs font-medium text-primary-300 hover:text-white disabled:opacity-50">
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>
              <button onClick={handleVerifyOtp}
                className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg">
                Verify OTP
              </button>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-sm font-medium text-primary-100 mb-2">New Password</label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-300" />
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 transition-all"
                    placeholder="New password" required minLength={8} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-300 hover:text-white">
                    {showPass ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>

                {/* Strength Indicator */}
                {password && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= passedCount ? strengthColor[strength] : 'bg-white/10'}`} />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${strength === 'strong' ? 'text-green-400' : strength === 'medium' ? 'text-amber-400' : 'text-red-400'}`}>
                      Password strength: {strength}
                    </p>
                    <div className="space-y-1">
                      {checks.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {c.pass ? <FiCheck className="text-green-400 w-3 h-3" /> : <FiX className="text-red-400 w-3 h-3" />}
                          <span className={c.pass ? 'text-green-300' : 'text-primary-300'}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-100 mb-2">Confirm Password</label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-300" />
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-400 transition-all"
                    placeholder="Confirm password" required />
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                )}
              </div>

              <button type="submit" disabled={loading || strength === 'weak'}
                className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg disabled:opacity-50">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}

          <p className="text-center text-primary-200 text-sm pt-2">
            <Link to="/login" className="text-white font-semibold hover:underline flex items-center justify-center gap-1">
              <FiArrowLeft className="w-3 h-3" /> Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
