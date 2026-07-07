import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useState } from 'react';
import { FiShoppingCart, FiUser, FiMenu, FiX, FiHome, FiPackage, FiLogOut, FiLogIn, FiClipboard } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const { totalItems } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-primary-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-primary-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:shadow-primary-300 transition-shadow">
                G
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold gradient-text">Ganesh Trades</h1>
                <p className="text-[10px] text-gray-400 -mt-1">Grocery & Wholesale</p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <Link key={link.path} to={link.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive(link.path) ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100 hover:text-primary-600'}`}>
                  {link.icon} {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link to="/cart" className="relative p-2 text-gray-600 hover:text-primary-600 transition-colors" id="cart-button">
                <FiShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center animate-pulse-glow">
                    {totalItems}
                  </span>
                )}
              </Link>

              {user ? (
                <div className="hidden md:flex items-center gap-2">
                  <Link to="/profile" className="flex items-center gap-2 px-3 py-2 bg-primary-50 rounded-lg text-primary-700 hover:bg-primary-100 transition-colors text-sm font-medium">
                    <FiUser className="w-4 h-4" /> {user.name?.split(' ')[0]}
                  </Link>
                  {(user.role === 'admin' || user.role === 'manager') && (
                    <Link to="/admin" className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
                      Dashboard
                    </Link>
                  )}
                  <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <FiLogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link to="/login" className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200">
                  <FiLogIn className="w-4 h-4" /> Login
                </Link>
              )}

              <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-gray-600">
                {menuOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 animate-fadeIn">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(link => (
                <Link key={link.path} to={link.path} onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${isActive(link.path) ? 'bg-primary-100 text-primary-700' : 'text-gray-600'}`}>
                  {link.icon} {link.label}
                </Link>
              ))}
              {user ? (
                <>
                  <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600">
                    <FiUser /> Profile
                  </Link>
                  {(user.role === 'admin' || user.role === 'manager') && (
                    <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-primary-600">
                      <FiClipboard /> Admin Dashboard
                    </Link>
                  )}
                  <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-500 w-full text-left">
                    <FiLogOut /> Logout
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-primary-600">
                  <FiLogIn /> Login
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </main>

      {/* WhatsApp Button */}
      <a href="https://wa.me/919999999999?text=Hi%20Ganesh%20Trades!" target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 w-14 h-14 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-green-600 transition-all hover:scale-110 z-50" id="whatsapp-button">
        <FaWhatsapp className="w-7 h-7" />
      </a>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-primary-900 to-primary-800 text-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-3">Ganesh Trades</h3>
              <p className="text-primary-200 text-sm">Your trusted grocery and wholesale shop. Quality products at the best prices.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <div className="space-y-2 text-sm text-primary-200">
                <Link to="/products" className="block hover:text-white transition-colors">Browse Products</Link>
                <Link to="/orders" className="block hover:text-white transition-colors">My Orders</Link>
                <Link to="/profile" className="block hover:text-white transition-colors">My Account</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Contact Us</h4>
              <div className="space-y-2 text-sm text-primary-200">
                <p>📞 +91 99999 99999</p>
                <p>📧 info@ganeshtrades.com</p>
                <p>📍 Main Market, Local</p>
              </div>
            </div>
          </div>
          <div className="border-t border-primary-700 mt-8 pt-6 text-center text-sm text-primary-300">
            © {new Date().getFullYear()} Ganesh Trades. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
