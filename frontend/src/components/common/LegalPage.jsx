import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

export default function LegalPage({ title, updated, intro, children }) {
  return (
    <div className="max-w-3xl mx-auto animate-fadeIn">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-mint-600 dark:text-mint-400 hover:underline mb-4"
      >
        <FiArrowLeft className="w-4 h-4" /> Back to Home
      </Link>
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{title}</h1>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6">Last updated: {updated}</p>
      <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 p-5 sm:p-8 text-sm leading-relaxed text-slate-700 dark:text-slate-300 shadow-sm">
        {intro && <p className="mb-6">{intro}</p>}
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}

export function LegalSection({ title, children }) {
  return (
    <section>
      <h2 className="text-base font-bold text-slate-900 dark:text-white mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function LegalList({ items }) {
  return (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalLink({ to, children }) {
  return (
    <Link to={to} className="text-mint-600 dark:text-mint-400 font-semibold hover:underline">
      {children}
    </Link>
  );
}
