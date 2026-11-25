import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const STORAGE_KEY = 'gt_cookie_consent_v1';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const saveChoice = (choice) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        essential: true,
        analytics: false,
        choice,
        timestamp: new Date().toISOString()
      }));
    } catch {}
    setVisible(false);
  };
  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto max-w-4xl mx-auto bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 flex-1">
          We use only essential cookies and browser storage to keep you signed in, remember your cart and
          theme, and secure the site. No advertising or tracking cookies are used.{' '}
          <Link to="/privacy-policy" className="text-mint-600 dark:text-mint-400 font-semibold hover:underline">
            Learn more
          </Link>
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => saveChoice('essential')}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => saveChoice('all')}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-mint-500 hover:bg-mint-400 text-navy-950 shadow-md shadow-mint-500/20 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
