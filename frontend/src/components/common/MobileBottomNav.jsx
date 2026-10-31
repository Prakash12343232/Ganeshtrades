import { Link, useLocation } from 'react-router-dom';
import { FiGrid, FiHome, FiSearch, FiShoppingCart, FiUser } from 'react-icons/fi';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

const ITEMS = [
  { path: '/', label: 'Home', icon: FiHome, exact: true },
  { path: '/products', label: 'Categories', icon: FiGrid },
  { path: '/products?focus=search', label: 'Search', icon: FiSearch },
  { path: '/cart', label: 'Cart', icon: FiShoppingCart },
];

export default function MobileBottomNav() {
  const { pathname, search } = useLocation();
  const { totalItems } = useCart();
  const { user } = useAuth();
  const items = [...ITEMS, { path: user ? '/profile' : '/login', label: 'Account', icon: FiUser }];

  return (
    <nav className="mobile-bottom-nav md:hidden" aria-label="Mobile shopping navigation">
      {items.map(({ path, label, icon: Icon, exact }) => {
        const targetPath = path.split('?')[0];
        const active = exact
          ? pathname === targetPath
          : label === 'Search'
            ? pathname === targetPath && search.includes('focus=search')
            : label === 'Categories'
              ? pathname === targetPath && !search.includes('focus=search')
              : pathname === targetPath;
        return (
          <Link key={label} to={path} className={`mobile-bottom-nav-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="mobile-bottom-nav-icon">
              <Icon aria-hidden="true" />
              {label === 'Cart' && totalItems > 0 && <b className="mobile-cart-badge">{totalItems > 99 ? '99+' : totalItems}</b>}
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
