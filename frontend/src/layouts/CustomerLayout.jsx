import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useState, useEffect, useCallback } from 'react';
import { getNotifications, markRead, markAllRead } from '../services/api';
import { FiShoppingCart, FiUser, FiMenu, FiX, FiHome, FiPackage, FiLogOut, FiLogIn, FiClipboard, FiBell, FiCheck } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import ThemeToggle from '../components/common/ThemeToggle';

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();

  const fetchNotifs = useCallback(() => {
    if (user) {
      getNotifications({ limit: 10 })
        .then(res => {
          setNotifications(res.data.data || []);
          setUnreadCount(res.data.unreadCount || 0);
        })
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  const handleMarkRead = async (n) => {
    try {
      if (!n.isRead) {
        await markRead(n._id);
        fetchNotifs();
      }
      if (n.link) {
        navigate(n.link);
        setNotifOpen(false);
      }
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      fetchNotifs();
    } catch {}
  };

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => { logout(); navigate('/login'); setMenuOpen(false); };

  const navLinks = [
    { path: '/', label: 'Home', icon: <FiHome /> },
    { path: '/products', label: 'Products', icon: <FiPackage /> },
  ];

  if (user) {
    navLinks.push({ path: '/orders', label: 'My Orders', icon: <FiClipboard /> });
  }

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col justify-between selection:bg-mint-500 selection:text-navy-950 transition-colors duration-200">
      {/* Header */}
      <header className="header-container sticky top-0 z-50 bg-navy-900/90 backdrop-blur-lg border-b border-navy-800 shadow-lg shadow-black/20 transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <img
                src="/logo.png"
                alt="Ganesh Trades Logo"
                className="w-12 h-12 object-contain drop-shadow-[0_4px_10px_rgba(52,211,153,0.3)] group-hover:scale-105 transition-transform"
              />
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Ganesh Trades</h1>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold tracking-wide -mt-0.5">Grocery &amp; Wholesale</p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-2">
              {navLinks.map(link => (
                <Link key={link.path} to={link.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${isActive(link.path) ? 'bg-mint-500/15 text-mint-600 dark:text-mint-400 border border-mint-500/40 shadow-sm' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 hover:text-mint-600 dark:hover:text-mint-300'}`}>
                  {link.icon} {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Theme Switcher Toggle */}
              <ThemeToggle />

              {/* Notification Bell */}
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setNotifOpen(!notifOpen)}
                    className="p-2 text-slate-700 dark:text-slate-300 hover:text-mint-600 dark:hover:text-mint-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-xl transition-colors relative"
                    id="notif-bell-btn"
                  >
                    <FiBell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Dropdown */}
                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden z-50 animate-fadeIn">
                      <div className="p-4 bg-slate-50 dark:bg-navy-850 border-b border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FiBell className="text-mint-600 dark:text-mint-400" />
                          <h3 className="font-bold text-sm">Notifications</h3>
                        </div>
                        {unreadCount > 0 && (
                          <button onClick={handleMarkAllRead} className="text-xs text-mint-600 dark:text-mint-400 hover:underline flex items-center gap-1">
                            <FiCheck /> Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-navy-800/60">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">No notifications</div>
                        ) : (
                          notifications.map(n => (
                            <div
                              key={n._id}
                              onClick={() => handleMarkRead(n)}
                              className={`p-3.5 hover:bg-slate-50 dark:hover:bg-navy-800/70 transition-colors cursor-pointer flex items-start gap-3 ${!n.isRead ? 'bg-mint-500/10' : ''}`}
                            >
                              <span className="text-lg flex-shrink-0 mt-0.5">
                                {{ order: '📦', delivery: '🚚', payment: '💳', promotion: '🎉', new_product: '🆕', payment_reminder: '💰' }[n.type] || '📢'}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold ${!n.isRead ? 'text-mint-700 dark:text-mint-300' : 'text-slate-800 dark:text-slate-200'}`}>{n.title}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">{new Date(n.createdAt).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                              </div>
                              {!n.isRead && <span className="w-2 h-2 bg-mint-500 dark:bg-mint-400 rounded-full flex-shrink-0 mt-1.5" />}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cart Button */}
              <Link to="/cart" className="relative p-2 text-slate-700 dark:text-slate-300 hover:text-mint-600 dark:hover:text-mint-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-xl transition-colors" id="cart-button">
                <FiShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-mint-500 text-navy-950 text-xs font-extrabold rounded-full flex items-center justify-center animate-pulse-glow">
                    {totalItems}
                  </span>
                )}
              </Link>

              {user ? (
                <div className="hidden md:flex items-center gap-2">
                  <Link to="/profile" className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl text-slate-800 dark:text-slate-200 hover:text-mint-600 dark:hover:text-mint-300 hover:border-mint-500/30 transition-all text-sm font-medium">
                    <FiUser className="w-4 h-4 text-mint-600 dark:text-mint-400" /> {user.name?.split(' ')[0]}
                  </Link>
                  {(user.role === 'admin' || user.role === 'manager') && (
                    <Link to="/admin" className="px-3.5 py-2 bg-mint-500 text-navy-950 font-bold rounded-xl text-sm hover:bg-mint-400 transition-all shadow-md shadow-mint-500/20">
                      Dashboard
                    </Link>
                  )}
                  <button onClick={handleLogout} className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-xl transition-colors">
                    <FiLogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link to="/login" className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-mint-500 hover:bg-mint-400 text-navy-950 font-extrabold rounded-xl text-sm transition-all shadow-md shadow-mint-500/25 active:scale-95">
                  <FiLogIn className="w-4 h-4 stroke-[2.5]" /> Login
                </Link>
              )}

              <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-slate-700 dark:text-slate-300 hover:text-mint-600 dark:hover:text-mint-400">
                {menuOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-navy-900 border-t border-navy-800 animate-fadeIn">
            <div className="px-4 py-3 space-y-1.5">
              {navLinks.map(link => (
                <Link key={link.path} to={link.path} onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${isActive(link.path) ? 'bg-mint-500/10 text-mint-400 border border-mint-500/30' : 'text-slate-300 hover:bg-navy-800'}`}>
                  {link.icon} {link.label}
                </Link>
              ))}
              {user ? (
                <>
                  <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-navy-800">
                    <FiUser className="text-mint-400" /> Profile
                  </Link>
                  {(user.role === 'admin' || user.role === 'manager') && (
                    <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-mint-400 hover:bg-navy-800">
                      <FiClipboard /> Admin Dashboard
                    </Link>
                  )}
                  <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-navy-800 w-full text-left">
                    <FiLogOut /> Logout
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-mint-400 hover:bg-navy-800">
                  <FiLogIn /> Login
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <Outlet />
      </main>

      {/* WhatsApp Button */}
      <a href="https://wa.me/918010412539?text=Hi%20Ganesh%20Trades!" target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-emerald-400 hover:scale-110 transition-all z-50 border border-mint-400/40 shadow-mint-500/20" id="whatsapp-button">
        <FaWhatsapp className="w-7 h-7" />
      </a>

      {/* Footer */}
      <footer className="bg-slate-900 dark:bg-gradient-to-b dark:from-navy-900 dark:via-navy-950 dark:to-navy-950 border-t border-slate-800 dark:border-navy-800/80 text-slate-300 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <img
                  src="/logo.png"
                  alt="Ganesh Trades Logo"
                  className="w-11 h-11 object-contain drop-shadow-[0_2px_8px_rgba(52,211,153,0.3)]"
                />
                <h3 className="text-xl font-bold text-white">Ganesh Trades</h3>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm">Your trusted grocery and wholesale shop. Quality products at the best prices for homes, hotels and PGs.</p>
            </div>
            <div>
              <h4 className="font-semibold text-mint-400 mb-3 text-sm uppercase tracking-wider">Quick Links</h4>
              <div className="space-y-2 text-sm text-slate-400">
                <Link to="/products" className="block hover:text-mint-400 transition-colors">Browse Products</Link>
                <Link to="/orders" className="block hover:text-mint-400 transition-colors">My Orders</Link>
                <Link to="/profile" className="block hover:text-mint-400 transition-colors">My Account</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-mint-400 mb-3 text-sm uppercase tracking-wider">Contact Us</h4>
              <div className="space-y-2 text-sm text-slate-400">
                <p className="flex items-center gap-2"><span>📞</span> +91 80104 12539</p>
                <p className="flex items-center gap-2"><span>📧</span> info@ganeshtrades.com</p>
                <p className="flex items-center gap-2"><span>📍</span> Main Market, Local</p>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 dark:border-navy-800/80 mt-10 pt-6 text-center text-sm text-slate-500">
            © {new Date().getFullYear()} Ganesh Trades. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
