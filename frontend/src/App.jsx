import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Layouts
import CustomerLayout from './layouts/CustomerLayout';
import AdminLayout from './layouts/AdminLayout';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Customer Pages
import Home from './pages/customer/Home';
import Products from './pages/customer/Products';
import ProductDetail from './pages/customer/ProductDetail';
import Cart from './pages/customer/Cart';
import MyOrders from './pages/customer/MyOrders';
import OrderDetail from './pages/customer/OrderDetail';
import Profile from './pages/customer/Profile';

// Admin Pages
import Dashboard from './pages/admin/Dashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminProducts from './pages/admin/AdminProducts';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminPayments from './pages/admin/AdminPayments';
import AdminReports from './pages/admin/AdminReports';
import AdminInventory from './pages/admin/AdminInventory';
import AdminCredit from './pages/admin/AdminCredit';
import AdminSuppliers from './pages/admin/AdminSuppliers';
import AdminExpenses from './pages/admin/AdminExpenses';
import AdminDeliveries from './pages/admin/AdminDeliveries';
import AdminBackups from './pages/admin/AdminBackups';
import AdminCoverage from './pages/admin/AdminCoverage';

// Manager Pages
import ManagerDashboard from './pages/manager/ManagerDashboard';

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
