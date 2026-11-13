import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import { savePendingRegistration } from '../../utils/profileCompletion';
import toast from 'react-hot-toast';
import { FiAlertCircle, FiMapPin, FiShield, FiUserCheck } from 'react-icons/fi';

const routeForRole = (role) => {
  if (role === 'admin' || role === 'manager') return '/admin';
  if (role === 'staff') return '/worker';
  return '/';
};

export default function Register() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [linkNotice, setLinkNotice] = useState(false);

  const handleGoogleSuccess = (data) => {
    setLinkNotice(false);
    if (data.requiresProfileCompletion) {
      savePendingRegistration(data.registrationToken, data.profile);
      toast.success('Google account verified. Let’s finish your profile.');
      navigate('/complete-profile');
      return;
    }

    loginUser(data.user, data.token);
    toast.success(`Welcome to Ganesh Trades, ${data.user?.name || 'valued customer'}!`);
    navigate(routeForRole(data.user?.role));
  };

  const handleGoogleError = (_message, error) => {
    if (error?.response?.data?.code === 'ACCOUNT_LINK_REQUIRED') {
      setLinkNotice(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-mint-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-navy-800/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md animate-fadeIn relative z-10 my-8">
        <div className="text-center mb-6">
          <img
            src="/logo.png"
            alt="Ganesh Trades Logo"
            className="w-20 h-20 object-contain mx-auto mb-3 drop-shadow-[0_10px_25px_rgba(52,211,153,0.3)] hover:scale-105 transition-transform"
          />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Create Your Account</h1>
          <p className="text-mint-300/80 mt-1 text-sm">Fast, secure sign-up with Google</p>
        </div>

        <div className="bg-navy-900/90 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-navy-700/80 shadow-2xl space-y-6">
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 text-center">
              Step 1 of 2 · Verify with Google
            </label>
            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              text="Continue with Google"
            />
            <p className="text-center text-xs text-slate-400">
              We use your verified Google name, email and photo. No SMS or OTP is required.
            </p>
          </div>

          {linkNotice && (
            <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-left" role="alert">
              <div className="flex items-start gap-3">
                <FiAlertCircle className="mt-0.5 shrink-0 text-amber-300" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-amber-200">This email already has an account</p>
                  <p className="text-xs leading-relaxed text-amber-100/80">
                    For your security we never merge accounts automatically. Sign in with your existing
                    mobile number and password, then link Google from Profile → Security &amp; Accounts.
                  </p>
                  <Link
                    to="/login"
                    className="inline-flex items-center rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-navy-950 hover:bg-amber-300 transition-colors"
                  >
                    Sign in to your existing account
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-navy-700/70 bg-navy-950/60 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <FiUserCheck className="mt-0.5 shrink-0 text-mint-400" />
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-white">Step 2:</span> add your mobile number and delivery address.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <FiMapPin className="mt-0.5 shrink-0 text-mint-400" />
              <p className="text-sm text-slate-300">
                Detect your location or enter the address manually — both are supported.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <FiShield className="mt-0.5 shrink-0 text-mint-400" />
              <p className="text-sm text-slate-300">
                Your Google identity is verified on our server. We never trust profile data sent by the browser.
              </p>
            </div>
          </div>

          <p className="text-center text-slate-400 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-mint-400 font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
