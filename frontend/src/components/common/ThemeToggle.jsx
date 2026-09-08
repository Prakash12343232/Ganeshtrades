import { useTheme } from '../../context/ThemeContext';
import { FiSun, FiMoon } from 'react-icons/fi';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-xl text-slate-300 hover:text-mint-400 hover:bg-navy-800/80 transition-all border border-transparent hover:border-navy-700 focus:outline-none focus:ring-2 focus:ring-mint-400/50 flex items-center justify-center ${className}`}
      title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      type="button"
      id="theme-toggle-btn"
    >
      {isDark ? (
        <FiSun className="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform" />
      ) : (
        <FiMoon className="w-5 h-5 text-mint-600 hover:-rotate-12 transition-transform" />
      )}
    </button>
  );
}
