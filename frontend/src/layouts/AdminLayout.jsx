import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, Suspense } from 'react';
import { getNotifications } from '../services/api';
import { FiHome, FiPackage, FiUsers, FiDollarSign, FiBarChart2, FiBox, FiLogOut, FiMenu, FiArrowLeft, FiBell, FiTruck, FiBookOpen, FiFileText, FiDatabase, FiMap, FiShoppingBag, FiStar } from 'react-icons/fi';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    getNotifications({ limit: 1 })
      .then(res => setUnreadNotifs(res.data.unreadCount || 0))
      .catch(() => {});
  }, [location.pathname]);

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: <FiHome />, exact: true },
    { path: '/admin/orders', label: 'Orders', icon: <FiShoppingBag /> },
    { path: '/admin/deliveries', label: 'Deliveries', icon: <FiTruck /> },
    { path: '/admin/products', label: 'Products', icon: <FiPackage /> },
    { path: '/admin/inventory', label: 'Inventory', icon: <FiBox /> },
    { path: '/admin/reviews', label: 'Reviews', icon: <FiStar /> },
    { path: '/admin/notifications', label: 'Notifications', icon: <FiBell /> },
    { path: '/admin/customers', label: 'Customers', icon: <FiUsers /> },
    { path: '/admin/credit', label: 'Credit (Khata)', icon: <FiBookOpen /> },
    { path: '/admin/suppliers', label: 'Suppliers & POs', icon: <FiPackage /> },
    { path: '/admin/expenses', label: 'Expenses', icon: <FiFileText /> },
    { path: '/admin/payments', label: 'Payments', icon: <FiDollarSign /> },
    { path: '/admin/reports', label: 'Reports', icon: <FiBarChart2 /> },
    { path: '/admin/coverage', label: 'Delivery Coverage', icon: <FiMap /> },
    { path: '/admin/backups', label: 'Database Backups', icon: <FiDatabase /> },
  ];

  if (user?.role === 'manager') {
    menuItems.push({ path: '/manager', label: 'Management', icon: <FiBarChart2 /> });
  }

  const isActive = (path, exact) => exact ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-navy-900 via-navy-950 to-navy-950 border-r border-navy-800 text-white transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0 flex flex-col justify-between`}>
        <div>
          <div className="flex items-center gap-3 px-6 py-5 border-b border-navy-800">
            <div className="w-10 h-10 bg-mint-500 text-navy-950 rounded-xl flex items-center justify-center font-extrabold text-lg shadow-lg shadow-mint-500/20">G</div>
            <div>
              <h1 className="font-extrabold text-lg text-white">Ganesh Trades</h1>
              <p className="text-xs text-mint-400 font-medium capitalize">{user?.role} Panel</p>
            </div>
          </div>

          <nav className="mt-4 px-3 space-y-1 max-h-[calc(100vh-160px)] overflow-y-auto scrollbar-hide">
            {menuItems.map(item => (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive(item.path, item.exact) ? 'bg-mint-500 text-navy-950 shadow-lg shadow-mint-500/20 font-bold' : 'text-slate-300 hover:bg-navy-800 hover:text-mint-400'}`}>
                <span className="text-lg">{item.icon}</span> {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-navy-800">
          <Link to="/" className="flex items-center gap-3 px-4 py-2 text-slate-300 hover:text-mint-400 text-sm rounded-lg hover:bg-navy-800 transition-all mb-2">
            <FiArrowLeft /> Back to Shop
          </Link>
          <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-3 px-4 py-2 text-rose-400 hover:text-rose-300 text-sm rounded-lg hover:bg-navy-800 transition-all w-full text-left font-medium">
            <FiLogOut /> Logout
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-navy-900/90 backdrop-blur-lg border-b border-navy-800 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-300 hover:text-mint-400">
                <FiMenu className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-white">
                {menuItems.find(m => isActive(m.path, m.exact))?.label || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/admin/notifications" className="p-2 text-slate-300 hover:text-mint-400 relative">
                <FiBell className="w-5 h-5" />
                {unreadNotifs > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-mint-400 rounded-full animate-pulse shadow-sm shadow-mint-400"></span>
                )}
              </Link>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-navy-950 border border-navy-800 rounded-xl">
                <div className="w-8 h-8 bg-mint-500 text-navy-950 rounded-lg flex items-center justify-center text-navy-950 text-sm font-extrabold">
                  {user?.name?.[0]}
                </div>
                <span className="hidden sm:block text-sm font-semibold text-mint-300">{user?.name}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 bg-navy-950">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-mint-400"></div>
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
