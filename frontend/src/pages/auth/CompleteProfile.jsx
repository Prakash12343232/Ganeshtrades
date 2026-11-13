import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  completeGoogleProfile,
  reverseGeocode,
  geocodeAddress,
  checkServiceability
} from '../../services/api';
import {
  readPendingRegistration,
  clearPendingRegistration
} from '../../utils/profileCompletion';
import toast from 'react-hot-toast';
import {
  FiMapPin,
  FiCrosshair,
  FiCheckCircle,
  FiXCircle,
  FiNavigation,
  FiUser,
  FiPhone,
  FiMail,
  FiLock,
  FiShield,
  FiChevronRight
} from 'react-icons/fi';

const EMPTY_ADDRESS = {
  street: '',
  area: '',
  city: '',
  state: '',
  pincode: '',
  lat: null,
  lng: null
};

const CUSTOMER_TYPES = [
  { value: 'public', label: 'Public Customer', hint: 'Regular household delivery' },
  { value: 'hotel', label: 'Hotel Customer', hint: 'Hotels, restaurants and cafés' },
  { value: 'pg_hostel', label: 'PG / Hostel Customer', hint: 'Paying guest or hostel kitchen' }
];

const addressFieldsFromResult = (result, fallback) => ({
  street: fallback.street || result?.street || '',
  area: fallback.area || result?.area || '',
  city: fallback.city || result?.city || '',
  state: fallback.state || result?.state || '',
  pincode: fallback.pincode || result?.pincode || ''
});

export default function CompleteProfile() {
  const { loginUser } = useAuth();
  const navigate = useNavigate();
  const [pending] = useState(() => readPendingRegistration());
  const [registrationToken, setRegistrationToken] = useState(pending.token);
  const [profile] = useState(pending.profile || {});

  const [form, setForm] = useState({
    name: profile.name || '',
    mobile: '',
    customerType: 'public',
    address: { ...EMPTY_ADDRESS }
  });

  const [mode, setMode] = useState('detect');
  const [locating, setLocating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [serviceInfo, setServiceInfo] = useState(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!pending.token) {
      toast.error('Please start again with Google.');
      navigate('/register', { replace: true });
    }
  }, [pending.token, navigate]);

  const updateAddress = (field, value) => {
    setForm((prev) => {
      const nextAddress = { ...prev.address, [field]: value };
      // A manual address edit invalidates previously geocoded coordinates so
      // the backend never evaluates delivery against a stale location.
      if (mode === 'manual') {
        nextAddress.lat = null;
        nextAddress.lng = null;
      }
      return { ...prev, address: nextAddress };
    });
    if (mode === 'manual') {
      setServiceInfo(null);
    }
  };

  const validateDelivery = async (lat, lng) => {
    try {
      const { data } = await checkServiceability(lat, lng);
      setServiceInfo(data.data);
      if (data.data?.serviceable) {
        toast.success(`Delivery available — ${data.data.distance} KM from the shop.`);
      } else {
        toast.error(data.data?.message || 'Delivery is not available at this location.');
      }
      return data.data;
    } catch {
      setServiceInfo(null);
      toast.error('Could not check delivery availability. Please try again.');
      return null;
    }
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by this browser. Please enter your address manually.');
      toast.error('Geolocation is not supported. Please enter your address manually.');
      setMode('manual');
      return;
    }

    setLocating(true);
    setLocationStatus('Requesting location permission…');
    setServiceInfo(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setForm((prev) => ({ ...prev, address: { ...prev.address, lat, lng } }));
        setLocationStatus('Location captured. Looking up your address…');

        try {
          const { data } = await reverseGeocode({ lat, lng });
          const detected = data.data;
          setForm((prev) => ({
            ...prev,
            address: {
              ...prev.address,
              ...addressFieldsFromResult(detected, { ...EMPTY_ADDRESS, ...prev.address }),
              lat,
              lng
            }
          }));
          setLocationStatus('Address detected. Review and edit it before saving.');
          toast.success('Address detected. Please review it before creating your account.');
        } catch {
          setLocationStatus('Location captured, but the address lookup failed. Please complete the address manually.');
          toast.error('Could not look up this address. Please enter it manually.');
        }

        await validateDelivery(lat, lng);
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setServiceInfo(null);
        const messages = {
          1: 'Location permission denied. You can enter your address manually.',
          2: 'Your location is unavailable right now. Please enter your address manually.',
          3: 'Location detection timed out. Please try again or enter your address manually.'
        };
        const message = messages[error.code] || 'Could not detect your location. Please enter your address manually.';
        setLocationStatus(message);
        toast.error(message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const checkManualAddress = async () => {
    const address = form.address;
    if (!address.street || !address.area || !address.city || !address.state || !/^\d{6}$/.test(address.pincode || '')) {
      toast.error('Enter street, area, city, state and a valid 6-digit pincode first.');
      return;
    }

    setChecking(true);
    setServiceInfo(null);
    try {
      const { data } = await geocodeAddress(address);
      const resolved = data.data;
      setForm((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          lat: resolved.lat,
          lng: resolved.lng
        }
      }));
      toast.success('Address found. Checking delivery availability…');
      await validateDelivery(resolved.lat, resolved.lng);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not verify this address. Please use Detect My Location.');
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!registrationToken) {
      setFormError('Your registration session has expired. Please sign in with Google again.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile)) {
      setFormError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!form.name.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!form.address.street || !form.address.area || !form.address.city || !form.address.state || !/^\d{6}$/.test(form.address.pincode || '')) {
      setFormError('Please complete all address fields, including a valid 6-digit pincode.');
      return;
    }
    if (serviceInfo && !serviceInfo.serviceable) {
      setFormError(serviceInfo.message || 'Delivery is not available at this address.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await completeGoogleProfile({
        registrationToken,
        name: form.name,
        mobile: form.mobile,
        customerType: form.customerType,
        address: form.address
      });

      loginUser(data.user, data.token);
      toast.success(`Welcome to Ganesh Trades, ${data.user?.name || 'valued customer'}!`);
      navigate('/');
    } catch (error) {
      const response = error.response?.data;
      if (response?.serviceability) {
        setServiceInfo(response.serviceability);
      }
      if (response?.code === 'REGISTRATION_SESSION_EXPIRED') {
        clearPendingRegistration();
        setRegistrationToken(null);
      }
      setFormError(response?.message || 'Could not create your account. Please try again.');
      toast.error(response?.message || 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!pending.token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-mint-400" />
      </div>
    );
  }

  const isOutOfRange = Boolean(serviceInfo && !serviceInfo.serviceable);

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-950 px-4 py-8 relative overflow-hidden">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-mint-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-navy-800/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 mx-auto w-full max-w-2xl">
        <div className="mb-6 text-center">
          <img
            src="/logo.png"
            alt="Ganesh Trades Logo"
            className="mx-auto mb-3 h-16 w-16 object-contain drop-shadow-[0_10px_25px_rgba(52,211,153,0.3)]"
          />
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Complete Your Profile</h1>
          <p className="mt-2 text-sm text-mint-300/80">
            Step 2 of 2 · Your Google account is verified. Just add delivery details.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-navy-700/80 bg-navy-900/90 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
          <section className="rounded-2xl border border-navy-700/70 bg-navy-950/60 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt="Google profile"
                  className="h-16 w-16 rounded-2xl object-cover ring-2 ring-mint-400/40"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-mint-500 text-2xl font-extrabold text-navy-950">
                  {(form.name || 'G')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-mint-300">
                  <FiShield /> Verified Google account
                </p>
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-200">
                  <FiMail className="shrink-0 text-mint-400" />
                  <span className="truncate font-medium" data-testid="verified-email">{profile.email || 'Verified email'}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-mint-500/30 bg-mint-500/10 px-2 py-0.5 text-[10px] font-bold text-mint-300">
                    <FiLock className="h-3 w-3" /> Read-only
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">We never ask you to type your Google email again.</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-xs font-medium text-slate-300">Full Name</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-mint-400" />
                <input
                  id="name"
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-xl border border-navy-700 bg-navy-950 py-3 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-mint-500"
                  placeholder="Your full name"
                  maxLength={100}
                  autoComplete="name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="mobile" className="mb-1 block text-xs font-medium text-slate-300">Mobile Number</label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-mint-400" />
                <input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  value={form.mobile}
                  onChange={(event) => setForm((prev) => ({ ...prev, mobile: event.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  className="w-full rounded-xl border border-navy-700 bg-navy-950 py-3 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-mint-500"
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  autoComplete="tel"
                  required
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                No OTP is required. Your number is stored as unverified until you choose to verify it later.
              </p>
            </div>

            <div>
              <label htmlFor="customerType" className="mb-1 block text-xs font-medium text-slate-300">Customer Type</label>
              <select
                id="customerType"
                value={form.customerType}
                onChange={(event) => setForm((prev) => ({ ...prev, customerType: event.target.value }))}
                className="w-full rounded-xl border border-navy-700 bg-navy-950 px-3 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-mint-500"
              >
                {CUSTOMER_TYPES.map((type) => (
                  <option key={type.value} value={type.value} className="bg-navy-950 text-slate-100">
                    {type.label} — {type.hint}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-bold text-white">Delivery Address</h2>
              <div className="inline-flex rounded-xl border border-navy-700 bg-navy-950 p-1" role="group" aria-label="Address entry method">
                <button
                  type="button"
                  onClick={() => setMode('detect')}
                  aria-pressed={mode === 'detect'}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${mode === 'detect' ? 'bg-mint-500 text-navy-950' : 'text-slate-300 hover:text-white'}`}
                >
                  Detect My Location
                </button>
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  aria-pressed={mode === 'manual'}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${mode === 'manual' ? 'bg-mint-500 text-navy-950' : 'text-slate-300 hover:text-white'}`}
                >
                  Enter Manually
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-navy-700/70 bg-navy-950/60 p-4">
              {mode === 'detect' ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2">
                    <FiMapPin className="mt-0.5 shrink-0 text-mint-400" />
                    <p className="text-xs leading-relaxed text-slate-300">
                      {locationStatus || 'Use your current location to fill the address automatically. Your browser will ask for permission first.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={locating}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-mint-500 px-4 py-2.5 text-xs font-bold text-navy-950 shadow-md transition-colors hover:bg-mint-400 disabled:opacity-50"
                  >
                    <FiCrosshair className={locating ? 'animate-spin' : ''} />
                    {locating ? 'Detecting…' : 'Detect My Location'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2">
                    <FiMapPin className="mt-0.5 shrink-0 text-mint-400" />
                    <p className="text-xs leading-relaxed text-slate-300">
                      Fill the address below, then check delivery availability. Your precise location is never requested.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={checkManualAddress}
                    disabled={checking}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-navy-800 px-4 py-2.5 text-xs font-bold text-mint-300 ring-1 ring-mint-500/30 transition-colors hover:bg-navy-700 disabled:opacity-50"
                  >
                    <FiNavigation className={checking ? 'animate-spin' : ''} />
                    {checking ? 'Checking…' : 'Check Delivery'}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="street" className="mb-1 block text-xs font-medium text-slate-300">House / Building / Street</label>
                <input
                  id="street"
                  type="text"
                  value={form.address.street}
                  onChange={(event) => updateAddress('street', event.target.value)}
                  className="w-full rounded-xl border border-navy-700 bg-navy-950 px-3 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-mint-500"
                  placeholder="Flat / house number, building, street"
                  autoComplete="address-line1"
                  maxLength={160}
                />
              </div>
              <div>
                <label htmlFor="area" className="mb-1 block text-xs font-medium text-slate-300">Area / Locality</label>
                <input
                  id="area"
                  type="text"
                  value={form.address.area}
                  onChange={(event) => updateAddress('area', event.target.value)}
                  className="w-full rounded-xl border border-navy-700 bg-navy-950 px-3 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-mint-500"
                  placeholder="Area or locality"
                  autoComplete="address-line2"
                  maxLength={160}
                />
              </div>
              <div>
                <label htmlFor="city" className="mb-1 block text-xs font-medium text-slate-300">City</label>
                <input
                  id="city"
                  type="text"
                  value={form.address.city}
                  onChange={(event) => updateAddress('city', event.target.value)}
                  className="w-full rounded-xl border border-navy-700 bg-navy-950 px-3 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-mint-500"
                  placeholder="City"
                  autoComplete="address-level2"
                  maxLength={100}
                />
              </div>
              <div>
                <label htmlFor="state" className="mb-1 block text-xs font-medium text-slate-300">State</label>
                <input
                  id="state"
                  type="text"
                  value={form.address.state}
                  onChange={(event) => updateAddress('state', event.target.value)}
                  className="w-full rounded-xl border border-navy-700 bg-navy-950 px-3 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-mint-500"
                  placeholder="State"
                  autoComplete="address-level1"
                  maxLength={100}
                />
              </div>
              <div>
                <label htmlFor="pincode" className="mb-1 block text-xs font-medium text-slate-300">Pincode</label>
                <input
                  id="pincode"
                  type="text"
                  inputMode="numeric"
                  value={form.address.pincode}
                  onChange={(event) => updateAddress('pincode', event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-xl border border-navy-700 bg-navy-950 px-3 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-mint-500"
                  placeholder="6-digit pincode"
                  autoComplete="postal-code"
                  maxLength={6}
                />
              </div>
            </div>

            {serviceInfo && (
              <div className={`rounded-2xl border p-4 ${serviceInfo.serviceable ? 'border-mint-500/30 bg-mint-500/10' : 'border-rose-500/30 bg-rose-500/10'}`}>
                <div className="flex items-start gap-3">
                  {serviceInfo.serviceable ? (
                    <FiCheckCircle className="mt-0.5 shrink-0 text-mint-400" />
                  ) : (
                    <FiXCircle className="mt-0.5 shrink-0 text-rose-400" />
                  )}
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${serviceInfo.serviceable ? 'text-mint-300' : 'text-rose-300'}`}>
                      {serviceInfo.serviceable ? 'Delivery Available' : 'Outside Service Area'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">{serviceInfo.message}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <FiNavigation className="h-3 w-3 text-mint-400" /> {serviceInfo.distance} KM
                      </span>
                      <span>Radius: {serviceInfo.radius} KM</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {formError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || isOutOfRange}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-extrabold shadow-lg transition-all disabled:opacity-50 ${
              isOutOfRange
                ? 'cursor-not-allowed bg-rose-500/50 text-rose-100'
                : 'bg-mint-500 text-navy-950 shadow-mint-500/20 hover:bg-mint-400'
            }`}
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy-950 border-t-transparent" />
                Creating your account…
              </>
            ) : (
              <>
                Create My Ganesh Trades Account <FiChevronRight />
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400">
            By creating an account you agree to Ganesh Trades&apos; delivery and account policies.{' '}
            <Link to="/login" className="font-semibold text-mint-400 hover:underline">
              Already registered?
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
