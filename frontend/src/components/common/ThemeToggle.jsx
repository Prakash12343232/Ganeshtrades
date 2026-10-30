import { useState } from 'react';
import { FiDroplet } from 'react-icons/fi';
import ThemeSettings from './ThemeSettings';

export default function ThemeToggle({ className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`theme-picker-trigger ${className}`}
        title="Choose color theme"
        aria-label="Choose color theme"
        aria-haspopup="dialog"
        aria-expanded={open}
        id="theme-toggle-btn"
      >
        <FiDroplet className="w-5 h-5" />
        <span className="hidden lg:inline">Theme</span>
      </button>
      <ThemeSettings open={open} onClose={() => setOpen(false)} />
    </>
  );
}
