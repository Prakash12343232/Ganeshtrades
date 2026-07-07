import axios from 'axios';

const API = axios.create({ baseURL: '/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('gt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('gt_token');
      localStorage.removeItem('gt_user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (data) => API.post('/auth/login', data);
export const register = (data) => API.post('/auth/register', data);
export const getMe = () => API.get('/auth/me');
export const updateProfile = (data) => API.put('/auth/profile', data);
export const changePassword = (data) => API.put('/auth/password', data);

// Products
export const getProducts = (params) => API.get('/products', { params });
export const getProduct = (id) => API.get(`/products/${id}`);
export const getCategories = () => API.get('/products/categories');
export const createProduct = (data) => API.post('/products', data);
export const updateProduct = (id, data) => API.put(`/products/${id}`, data);
export const updateStock = (id, data) => API.put(`/products/${id}/stock`, data);
export const deleteProduct = (id) => API.delete(`/products/${id}`);
export const getLowStock = () => API.get('/products/low-stock');

// Orders
export const createOrder = (data) => API.post('/orders', data);
export const getOrders = (params) => API.get('/orders', { params });
export const getOrder = (id) => API.get(`/orders/${id}`);
export const updateOrderStatus = (id, data) => API.put(`/orders/${id}/status`, data);
export const cancelOrder = (id, data) => API.put(`/orders/${id}/cancel`, data);
export const downloadInvoice = (id) => API.get(`/orders/${id}/invoice`, { responseType: 'blob' });

// Payments
export const createPayment = (data) => API.post('/payments', data);
export const getPayments = (params) => API.get('/payments', { params });
export const getPendingPayments = () => API.get('/payments/pending');

// Reviews
export const createReview = (data) => API.post('/reviews', data);
export const getProductReviews = (productId) => API.get(`/reviews/product/${productId}`);
export const getAllReviews = () => API.get('/reviews');
export const deleteReview = (id) => API.delete(`/reviews/${id}`);

// Notifications
export const getNotifications = () => API.get('/notifications');
export const markRead = (id) => API.put(`/notifications/${id}/read`);
export const markAllRead = () => API.put('/notifications/read-all');
export const createNotification = (data) => API.post('/notifications', data);

// Dashboard
export const getDashboardStats = () => API.get('/dashboard/stats');
export const getChartData = () => API.get('/dashboard/chart-data');

// Reports
export const getSalesReport = (params) => API.get('/reports/sales', { params });
export const exportOrders = () => API.get('/reports/export/orders', { responseType: 'blob' });
export const exportProducts = () => API.get('/reports/export/products', { responseType: 'blob' });

// Users (admin)
export const getUsers = (params) => API.get('/users', { params });
export const getUser = (id) => API.get(`/users/${id}`);
export const updateUser = (id, data) => API.put(`/users/${id}`, data);
export const deleteUser = (id) => API.delete(`/users/${id}`);

// Audit
export const getAuditLogs = (params) => API.get('/audit', { params });

// ERP: Credit/Khata
export const getCustomerBalances = () => API.get('/credit/balances');
export const getCustomerLedger = (userId) => API.get(`/credit/ledger/${userId}`);
export const settleCredit = (data) => API.post('/credit/settle', data);
export const updateCreditLimit = (userId, data) => API.put(`/credit/limit/${userId}`, data);

// ERP: Suppliers
export const getSuppliers = () => API.get('/suppliers');
export const createSupplier = (data) => API.post('/suppliers', data);
export const updateSupplier = (id, data) => API.put(`/suppliers/${id}`, data);
export const deleteSupplier = (id) => API.delete(`/suppliers/${id}`);

// ERP: Purchases
export const getPurchases = () => API.get('/purchases');
export const createPurchase = (data) => API.post('/purchases', data);
export const receivePurchase = (id) => API.put(`/purchases/${id}/receive`);

// ERP: Expenses
export const getExpenses = () => API.get('/expenses');
export const createExpense = (data) => API.post('/expenses', data);

// ERP: Deliveries
export const getDeliveries = () => API.get('/delivery');
export const getMyDeliveries = () => API.get('/delivery/my-deliveries');
export const assignDelivery = (data) => API.post('/delivery/assign', data);
export const updateDeliveryStatus = (id, data) => API.put(`/delivery/${id}/status`, data);

export default API;
