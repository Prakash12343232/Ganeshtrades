import { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('gt_token');
    const savedUser = localStorage.getItem('gt_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      getMe().then(res => {
        setUser(res.data.user);
        localStorage.setItem('gt_user', JSON.stringify(res.data.user));
      }).catch(() => { logout(); }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const loginUser = (userData, token) => {
    localStorage.setItem('gt_token', token);
    localStorage.setItem('gt_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('gt_token');
    localStorage.removeItem('gt_user');
    setUser(null);
  };

  const updateUser = (userData) => {
    localStorage.setItem('gt_user', JSON.stringify(userData));
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, logout, updateUser, isAdmin: user?.role === 'admin', isManager: user?.role === 'manager', isCustomer: user?.role === 'customer' }}>
      {children}
    </AuthContext.Provider>
  );
};
