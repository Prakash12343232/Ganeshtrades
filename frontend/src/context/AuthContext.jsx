import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../services/api';
import { clearPendingRegistration } from '../utils/profileCompletion';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const clearLegacyAuthStorage = () => {
  localStorage.removeItem('gt_token');
  localStorage.removeItem('gt_user');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clearLegacyAuthStorage();
    const token = sessionStorage.getItem('gt_token');
    const savedUser = sessionStorage.getItem('gt_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      getMe().then(res => {
        setUser(res.data.user);
        sessionStorage.setItem('gt_user', JSON.stringify(res.data.user));
      }).catch(() => { logout(); }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const loginUser = (userData, token) => {
    clearLegacyAuthStorage();
    clearPendingRegistration();
    sessionStorage.setItem('gt_token', token);
    sessionStorage.setItem('gt_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    sessionStorage.removeItem('gt_token');
    sessionStorage.removeItem('gt_user');
    clearLegacyAuthStorage();
    clearPendingRegistration();
    setUser(null);
  };

  const updateUser = (userData) => {
    sessionStorage.setItem('gt_user', JSON.stringify(userData));
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logout, updateUser, isAdmin: user?.role === 'admin', isManager: user?.role === 'manager', isCustomer: user?.role === 'customer' }}>
      {children}
    </AuthContext.Provider>
  );
};
