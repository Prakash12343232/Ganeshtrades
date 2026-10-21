import { useEffect, useRef, useState, useCallback } from 'react';
import { googleLogin, googleLink, getGoogleConfig } from '../services/api';
import toast from 'react-hot-toast';

export default function GoogleSignInButton({ 
  onSuccess, 
  onError, 
  text = 'Continue with Google', 
  disabled = false,
  mode = 'login' // 'login' or 'link'
}) {
  const buttonRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(Boolean(window.google?.accounts?.id));

  // Backend GOOGLE_CLIENT_ID is authoritative (must match token audience verification)
  useEffect(() => {
    let cancelled = false;
    getGoogleConfig()
      .then((res) => {
        if (cancelled) return;
        if (res.data?.configured && res.data.clientId) {
          const backendId = res.data.clientId.trim();
          const viteId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
          if (viteId && viteId !== backendId && import.meta.env.DEV) {
            console.warn('[Google Sign-In] VITE_GOOGLE_CLIENT_ID differs from backend — using backend client ID.');
          }
          setClientId(backendId);
          setIsConfigured(true);
        } else if (import.meta.env.VITE_GOOGLE_CLIENT_ID) {
          setClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID.trim());
          setIsConfigured(true);
        }
      })
      .catch(() => {
        if (!cancelled && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
          setClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID.trim());
          setIsConfigured(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Ensure Google Identity Services script is loaded
  useEffect(() => {
    if (window.google?.accounts?.id) {
      setGisLoaded(true);
      return;
    }

    const interval = setInterval(() => {
      if (window.google?.accounts?.id) {
        setGisLoaded(true);
        clearInterval(interval);
      }
    }, 200);

    const timeout = setTimeout(() => clearInterval(interval), 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const handleCredentialResponse = useCallback(async (response) => {
    if (!response?.credential) {
      toast.error('Google authentication did not provide a credential token.');
      return;
    }

    setLoading(true);
    try {
      const apiCall = mode === 'link' ? googleLink : googleLogin;
      const { data } = await apiCall({ credential: response.credential });
      if (data?.success && (data?.token || data?.user)) {
        if (onSuccess) {
          onSuccess(data);
        }
      } else {
        throw new Error(data?.message || 'Authentication failed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Google sign-in failed. Please try again.';
      toast.error(msg);
      if (onError) onError(msg);
    } finally {
      setLoading(false);
    }
  }, [mode, onSuccess, onError]);

  // Initialize GIS and render official button when ready
  useEffect(() => {
    if (!gisLoaded || !clientId || !buttonRef.current || !window.google?.accounts?.id) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: clientId.trim(),
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });

      // Clear any prior renders in the container
      buttonRef.current.innerHTML = '';

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'filled_black',
        size: 'large',
        type: 'standard',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: 380
      });
    } catch (err) {
      console.warn('GIS button render error:', err);
    }
  }, [gisLoaded, clientId, handleCredentialResponse]);

  const handleCustomClick = () => {
    if (!isConfigured || !clientId) {
      toast.error('Google Sign-In is awaiting Google Client ID configuration. Please sign in with your mobile & password below or configure VITE_GOOGLE_CLIENT_ID.', { duration: 5000 });
      return;
    }

    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId.trim(),
          callback: handleCredentialResponse,
          auto_select: false
        });
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Prompt was dismissed or suppressed by browser
          }
        });
      } catch (e) {
        console.error('GIS prompt error:', e);
      }
    } else {
      toast.error('Google Sign-In service is loading. Please check your internet connection.');
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Official GIS container */}
      <div 
        ref={buttonRef} 
        className={`w-full flex justify-center transition-all ${loading ? 'opacity-50 pointer-events-none' : ''}`}
        style={{ minHeight: '44px' }}
      >
        {/* Fallback button rendered if GIS hasn't completed DOM render */}
        <button
          type="button"
          onClick={handleCustomClick}
          disabled={disabled || loading}
          className="w-full py-3 px-4 bg-navy-950 hover:bg-navy-850 active:scale-[0.99] border border-navy-700/80 hover:border-mint-500/50 rounded-2xl flex items-center justify-center gap-3 text-slate-100 font-semibold shadow-lg shadow-navy-950/50 transition-all disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-mint-400 border-t-transparent"></span>
              Authenticating with Google...
            </span>
          ) : (
            <>
              {/* Official Google G Logo SVG */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{text}</span>
            </>
          )}
        </button>
      </div>

      {!isConfigured && (
        <p className="text-[11px] text-amber-400/80 mt-2 text-center">
          ℹ️ Google OAuth setup pending. Password sign-in is active below.
        </p>
      )}
    </div>
  );
}
