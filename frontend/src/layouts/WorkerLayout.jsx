import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { FiPackage, FiLogOut, FiUser, FiMenu, FiX, FiTruck } from 'react-icons/fi';
import logoIcon from '../assets/logo-icon.png';
import ThemeToggle from '../components/common/ThemeToggle';

export default function WorkerLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const navLinks = [
    { path: '/worker', label: 'My Deliveries', icon: <FiPackage /> },
    { path: '/worker/profile', label: 'My Profile', icon: <FiUser /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center ring-2 ring-purple-500 shadow-[0_0_10px_2px_rgba(168,85,247,0.4)]">
            <img src={logoIcon} alt="Logo" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <p className="font-bold text-sm text-white leading-tight">Ganesh Trades</p>
            <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider">Worker Portal</p>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1">
          {navLinks.map(l => (
            <Link key={l.path} to={l.path}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${isActive(l.path) ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25' : 'text-slate-300 hover:bg-slate-800 hover:text-purple-300'}`}>
              {l.icon} {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl">
            <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.[0]}
            </div>
            <span className="text-sm font-semibold text-purple-300">{user?.name}</span>
          </div>
          <button onClick={() => setMenuOpen(o => !o)} className="sm:hidden p-2 text-slate-300 hover:text-purple-400">
            {menuOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
          </button>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-rose-400 hover:text-rose-300 text-sm rounded-lg hover:bg-slate-800 transition-all font-medium"
          >
            <FiLogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-col gap-1">
          {navLinks.map(l => (
            <Link key={l.path} to={l.path} onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${isActive(l.path) ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
              {l.icon} {l.label}
            </Link>
          ))}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom navigation for mobile */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex z-40">
        {navLinks.map(l => (
          <Link key={l.path} to={l.path}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs font-semibold transition-all ${isActive(l.path) ? 'text-purple-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <span className="text-lg">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
