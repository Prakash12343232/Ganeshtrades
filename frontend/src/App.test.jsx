import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const marker = (name) => {
  const C = () => <div data-testid={`route:${name}`}>Page {name}</div>;
  C.displayName = name;
  return C;
};

const authState = { user: null, loading: false };

vi.mock('./context/AuthContext', () => ({
  useAuth: () => authState
}));

vi.mock('./layouts/CustomerLayout', async () => {
  const { Outlet } = await import('react-router-dom');
  return {
    __esModule: true,
    default: () => (
      <div data-testid="route:CustomerLayout">
        <Outlet />
      </div>
    )
  };
});

vi.mock('./layouts/AdminLayout', async () => {
  const { Outlet } = await import('react-router-dom');
  return {
    __esModule: true,
    default: () => (
      <div data-testid="route:AdminLayout">
        <Outlet />
      </div>
    )
  };
});

vi.mock('./pages/auth/Login', () => ({ __esModule: true, default: marker('Login') }));
vi.mock('./pages/auth/Register', () => ({ __esModule: true, default: marker('Register') }));
vi.mock('./pages/auth/ForgotPassword', () => ({ __esModule: true, default: marker('ForgotPassword') }));
vi.mock('./pages/NotFound', () => ({ __esModule: true, default: marker('NotFound') }));

vi.mock('./pages/customer/Home', () => ({ __esModule: true, default: marker('Home') }));
vi.mock('./pages/customer/Products', () => ({ __esModule: true, default: marker('Products') }));
vi.mock('./pages/customer/ProductDetail', () => ({ __esModule: true, default: marker('ProductDetail') }));
vi.mock('./pages/customer/Cart', () => ({ __esModule: true, default: marker('Cart') }));
vi.mock('./pages/customer/MyOrders', () => ({ __esModule: true, default: marker('MyOrders') }));
vi.mock('./pages/customer/OrderDetail', () => ({ __esModule: true, default: marker('OrderDetail') }));
vi.mock('./pages/customer/Profile', () => ({ __esModule: true, default: marker('Profile') }));

vi.mock('./pages/admin/Dashboard', () => ({ __esModule: true, default: marker('Dashboard') }));
vi.mock('./pages/admin/AdminOrders', () => ({ __esModule: true, default: marker('AdminOrders') }));
vi.mock('./pages/admin/AdminProducts', () => ({ __esModule: true, default: marker('AdminProducts') }));
vi.mock('./pages/admin/AdminCustomers', () => ({ __esModule: true, default: marker('AdminCustomers') }));
vi.mock('./pages/admin/AdminCustomerDetail', () => ({ __esModule: true, default: marker('AdminCustomerDetail') }));
vi.mock('./pages/admin/AdminPayments', () => ({ __esModule: true, default: marker('AdminPayments') }));
vi.mock('./pages/admin/AdminReports', () => ({ __esModule: true, default: marker('AdminReports') }));
vi.mock('./pages/admin/AdminInventory', () => ({ __esModule: true, default: marker('AdminInventory') }));
vi.mock('./pages/admin/AdminCredit', () => ({ __esModule: true, default: marker('AdminCredit') }));
vi.mock('./pages/admin/AdminSuppliers', () => ({ __esModule: true, default: marker('AdminSuppliers') }));
vi.mock('./pages/admin/AdminExpenses', () => ({ __esModule: true, default: marker('AdminExpenses') }));
vi.mock('./pages/admin/AdminDeliveries', () => ({ __esModule: true, default: marker('AdminDeliveries') }));
vi.mock('./pages/admin/AdminBackups', () => ({ __esModule: true, default: marker('AdminBackups') }));
vi.mock('./pages/admin/AdminCoverage', () => ({ __esModule: true, default: marker('AdminCoverage') }));
vi.mock('./pages/admin/AdminReviews', () => ({ __esModule: true, default: marker('AdminReviews') }));
vi.mock('./pages/admin/AdminNotifications', () => ({ __esModule: true, default: marker('AdminNotifications') }));

vi.mock('./pages/manager/ManagerDashboard', () => ({ __esModule: true, default: marker('ManagerDashboard') }));

const { default: App } = await import('./App.jsx');

let current;
const renderAt = (route) => {
  if (current) current.unmount();
  current = render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>
  );
  return current;
};

describe('App routing and protected routes', () => {
  it('renders public customer routes', async () => {
    authState.user = null;
    authState.loading = false;
    renderAt('/');
    expect(await screen.findByTestId('route:CustomerLayout')).toBeInTheDocument();
    expect(screen.getByTestId('route:Home')).toBeInTheDocument();
  });

  it('renders the product catalog and detail routes', async () => {
    renderAt('/products');
    expect(await screen.findByTestId('route:Products')).toBeInTheDocument();
    renderAt('/products/p1');
    expect(await screen.findByTestId('route:ProductDetail')).toBeInTheDocument();
  });

  it('renders all auth pages', async () => {
    renderAt('/login');
    expect(await screen.findByTestId('route:Login')).toBeInTheDocument();
    renderAt('/register');
    expect(await screen.findByTestId('route:Register')).toBeInTheDocument();
    renderAt('/forgot-password');
    expect(await screen.findByTestId('route:ForgotPassword')).toBeInTheDocument();
  });

  it('renders NotFound for unknown routes', async () => {
    renderAt('/no-such-path');
    expect(await screen.findByTestId('route:NotFound')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login for every protected customer route', async () => {
    for (const route of ['/cart', '/orders', '/orders/1', '/profile']) {
      renderAt(route);
      expect(await screen.findByTestId('route:Login')).toBeInTheDocument();
      expect(screen.queryByTestId('route:CustomerLayout')).not.toBeInTheDocument();
    }
  });

  it('shows the loading spinner (not a redirect) while auth is still loading', async () => {
    authState.user = null;
    authState.loading = true;
    renderAt('/cart');
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
    expect(screen.queryByTestId('route:Login')).not.toBeInTheDocument();
    expect(screen.queryByTestId('route:Cart')).not.toBeInTheDocument();
  });

  it('lets an authenticated customer into the cart but not the admin area', async () => {
    authState.user = { role: 'customer' };
    authState.loading = false;
    renderAt('/cart');
    expect(await screen.findByTestId('route:Cart')).toBeInTheDocument();

    renderAt('/admin');
    expect(await screen.findByTestId('route:Home')).toBeInTheDocument();
    expect(screen.queryByTestId('route:AdminLayout')).not.toBeInTheDocument();

    renderAt('/manager');
    expect(await screen.findByTestId('route:Home')).toBeInTheDocument();
    expect(screen.queryByTestId('route:ManagerDashboard')).not.toBeInTheDocument();
  });

  it('lets an admin access the admin area including admin-only backups', async () => {
    authState.user = { role: 'admin' };
    authState.loading = false;
    renderAt('/admin');
    expect(await screen.findByTestId('route:AdminLayout')).toBeInTheDocument();
    expect(screen.getByTestId('route:Dashboard')).toBeInTheDocument();

    renderAt('/admin/backups');
    expect(await screen.findByTestId('route:AdminBackups')).toBeInTheDocument();
  });

  it('lets a manager access the manager + admin areas but redirects admin-only backups', async () => {
    authState.user = { role: 'manager' };
    authState.loading = false;
    renderAt('/manager');
    expect(await screen.findByTestId('route:ManagerDashboard')).toBeInTheDocument();

    renderAt('/admin');
    expect(await screen.findByTestId('route:Dashboard')).toBeInTheDocument();

    renderAt('/admin/backups');
    expect(await screen.findByTestId('route:Dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('route:AdminBackups')).not.toBeInTheDocument();
  });
});