import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { FiHome, FiPackage, FiShoppingBag, FiUsers, FiDollarSign, FiBarChart2, FiBox, FiLogOut, FiMenu, FiX, FiArrowLeft, FiBell, FiTruck, FiBookOpen, FiFileText, FiDatabase, FiMap } from 'react-icons/fi';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: <FiHome />, exact: true },
    { path: '/admin/orders', label: 'Orders', icon: <FiShoppingBag /> },
    { path: '/admin/deliveries', label: 'Deliveries', icon: <FiTruck /> },
    { path: '/admin/products', label: 'Products', icon: <FiPackage /> },
    { path: '/admin/inventory', label: 'Inventory', icon: <FiBox /> },
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-primary-900 via-primary-800 to-primary-950 text-white transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-primary-700">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-bold text-lg">G</div>
          <div>
            <h1 className="font-bold text-lg">Ganesh Trades</h1>
            <p className="text-xs text-primary-300 capitalize">{user?.role} Panel</p>
          </div>
        </div>

        <nav className="mt-4 px-3 space-y-1">
          {menuItems.map(item => (
            <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${isActive(item.path, item.exact) ? 'bg-white/20 text-white shadow-lg' : 'text-primary-200 hover:bg-white/10 hover:text-white'}`}>
              <span className="text-lg">{item.icon}</span> {item.label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-primary-700">
          <Link to="/" className="flex items-center gap-3 px-4 py-2 text-primary-200 hover:text-white text-sm rounded-lg hover:bg-white/10 transition-all mb-2">
            <FiArrowLeft /> Back to Shop
          </Link>
          <button onClick={() => { logout(); navigate('/login'); }} className="flex items-center gap-3 px-4 py-2 text-red-300 hover:text-red-200 text-sm rounded-lg hover:bg-white/10 transition-all w-full text-left">
            <FiLogOut /> Logout
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-gray-600 hover:text-primary-600">
                <FiMenu className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-gray-800">
                {menuItems.find(m => isActive(m.path, m.exact))?.label || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 text-gray-500 hover:text-primary-600 relative">
                <FiBell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 rounded-lg">
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {user?.name?.[0]}
                </div>
                <span className="hidden sm:block text-sm font-medium text-primary-700">{user?.name}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
