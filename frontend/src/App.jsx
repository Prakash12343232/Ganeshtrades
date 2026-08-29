import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layouts
import CustomerLayout from './layouts/CustomerLayout';
import AdminLayout from './layouts/AdminLayout';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';

// Customer Pages
import Home from './pages/customer/Home';
import Products from './pages/customer/Products';
import ProductDetail from './pages/customer/ProductDetail';
import Cart from './pages/customer/Cart';
import MyOrders from './pages/customer/MyOrders';
import OrderDetail from './pages/customer/OrderDetail';
import Profile from './pages/customer/Profile';

// Lazy Loaded Admin Pages
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminCustomers = lazy(() => import('./pages/admin/AdminCustomers'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminInventory = lazy(() => import('./pages/admin/AdminInventory'));
const AdminCredit = lazy(() => import('./pages/admin/AdminCredit'));
const AdminSuppliers = lazy(() => import('./pages/admin/AdminSuppliers'));
const AdminExpenses = lazy(() => import('./pages/admin/AdminExpenses'));
const AdminDeliveries = lazy(() => import('./pages/admin/AdminDeliveries'));
const AdminBackups = lazy(() => import('./pages/admin/AdminBackups'));
const AdminCoverage = lazy(() => import('./pages/admin/AdminCoverage'));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews'));
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications'));

// Lazy Loaded Manager Pages
const ManagerDashboard = lazy(() => import('./pages/manager/ManagerDashboard'));

// Guards
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;
  return user && (user.role === 'admin' || user.role === 'manager') ? children : <Navigate to="/" />;
};

const AdminOnlyRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;
  return user?.role === 'admin' ? children : <Navigate to="/admin" />;
};

function App() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Customer Routes */}
      <Route path="/" element={<CustomerLayout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="cart" element={<PrivateRoute><Cart /></PrivateRoute>} />
        <Route path="orders" element={<PrivateRoute><MyOrders /></PrivateRoute>} />
        <Route path="orders/:id" element={<PrivateRoute><OrderDetail /></PrivateRoute>} />
        <Route path="profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="inventory" element={<AdminInventory />} />
        <Route path="credit" element={<AdminCredit />} />
        <Route path="suppliers" element={<AdminSuppliers />} />
        <Route path="expenses" element={<AdminExpenses />} />
        <Route path="deliveries" element={<AdminDeliveries />} />
        <Route path="reviews" element={<AdminReviews />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="backups" element={<AdminOnlyRoute><AdminBackups /></AdminOnlyRoute>} />
        <Route path="coverage" element={<AdminCoverage />} />
      </Route>

      {/* Manager Routes */}
      <Route path="/manager" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<ManagerDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
