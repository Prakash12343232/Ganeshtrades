import axios from 'axios';

const rawBaseURL = import.meta.env.VITE_API_URL || '/api';
const baseURL = rawBaseURL.endsWith('/') ? rawBaseURL.slice(0, -1) : rawBaseURL;

const API = axios.create({ baseURL });

const getStoredToken = () => {
  const token = sessionStorage.getItem('gt_token');
  if (localStorage.getItem('gt_token')) {
    localStorage.removeItem('gt_token');
    localStorage.removeItem('gt_user');
  }
  return token;
};

API.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('gt_token');
      sessionStorage.removeItem('gt_user');
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
export const sendOtp = (data) => API.post('/auth/send-otp', data);
export const verifyOtp = (data) => API.post('/auth/verify-otp', data);
export const getMe = () => API.get('/auth/me');
export const updateProfile = (data) => API.put('/auth/profile', data);
export const changePassword = (data) => API.put('/auth/password', data);
export const forgotPassword = (data) => API.post('/auth/forgot-password', data);
export const resetPassword = (data) => API.post('/auth/reset-password', data);
export const validatePassword = (data) => API.post('/auth/validate-password', data);

// Products
export const getProducts = (params) => API.get('/products', { params });
export const getProduct = (id) => API.get(`/products/${id}`);
export const getCategories = () => API.get('/products/categories');
export const createProduct = (data) => API.post('/products', data);
export const updateProduct = (id, data) => API.put(`/products/${id}`, data);
export const updateStock = (id, data) => API.put(`/products/${id}/stock`, data);
export const deleteProduct = (id) => API.delete(`/products/${id}`);
export const getLowStock = () => API.get('/products/low-stock');
export const getFeaturedProducts = () => API.get('/products/featured');
export const uploadProductImages = (id, formData, onUploadProgress) => API.post(`/products/${id}/images`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress
});
export const setPrimaryProductImage = (id, imageUrl) => API.put(`/products/${id}/images/primary`, { imageUrl });
export const deleteProductImageApi = (id, imageUrl) => API.delete(`/products/${id}/images`, { data: { imageUrl } });
export const bulkUploadProductImages = (formData, onUploadProgress) => API.post('/products/bulk-images', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress
});

// Orders
export const createOrder = (data) => API.post('/orders', data);
export const getOrders = (params) => API.get('/orders', { params });
export const getOrder = (id) => API.get(`/orders/${id}`);
export const updateOrderStatus = (id, data) => API.put(`/orders/${id}/status`, data);
export const cancelOrder = (id, data) => API.put(`/orders/${id}/cancel`, data);
export const rescheduleOrder = (id, data) => API.put(`/orders/${id}/reschedule`, data);
export const downloadInvoice = (id) => API.get(`/orders/${id}/invoice`, { responseType: 'blob' });
export const getTimeSlots = () => API.get('/orders/time-slots');
export const getUpcomingScheduled = () => API.get('/orders/scheduled/upcoming');

// Payments & Khata
export const createPayment = (data) => API.post('/payments', data);
export const getPayments = (params) => API.get('/payments', { params });
export const getPendingPayments = () => API.get('/payments/pending');
export const createSettlement = (data) => API.post('/payments/settlement', data);
export const createPaymentOrder = (data) => API.post('/payments/create-order', data);
export const verifyPayment = (data) => API.post('/payments/verify', data);

// Reviews
export const createReview = (data) => API.post('/reviews', data);
export const getProductReviews = (productId, params) => API.get(`/reviews/product/${productId}`, { params });
export const getAllReviews = (params) => API.get('/reviews', { params });
export const deleteReview = (id) => API.delete(`/reviews/${id}`);
export const updateReview = (id, data) => API.put(`/reviews/${id}`, data);
export const moderateReview = (id, data) => API.put(`/reviews/${id}/moderate`, data);
export const markReviewHelpful = (id) => API.put(`/reviews/${id}/helpful`);

// Notifications
export const getNotifications = (params) => API.get('/notifications', { params });
export const markRead = (id) => API.put(`/notifications/${id}/read`);
export const markAllRead = () => API.put('/notifications/read-all');
export const createNotification = (data) => API.post('/notifications', data);
export const deleteNotification = (id) => API.delete(`/notifications/${id}`);
export const clearReadNotifications = () => API.delete('/notifications/clear-read');

// Dashboard
export const getDashboardStats = () => API.get('/dashboard/stats');
export const getChartData = () => API.get('/dashboard/chart-data');
export const getAutoReorder = () => API.get('/dashboard/auto-reorder');

// Backups
export const getBackups = () => API.get('/backups');
export const triggerBackup = () => API.post('/backups/trigger');
export const restoreBackup = (filename) => API.post(`/backups/restore/${filename}`);
export const downloadBackup = (filename) => API.get(`/backups/download/${filename}`, { responseType: 'blob' });

// Settings
export const getSettings = () => API.get('/settings');
export const updateSettings = (data) => API.put('/settings', data);
export const checkServiceability = (lat, lng) => API.post('/settings/check-serviceability', { lat, lng });
export const getCoverageStats = () => API.get('/settings/coverage-stats');

// Reports
export const getSalesReport = (params) => API.get('/reports/sales', { params });
export const getProfitLoss = (params) => API.get('/reports/profit-loss', { params });
export const exportOrders = () => API.get('/reports/export/orders', { responseType: 'blob' });
export const exportProducts = () => API.get('/reports/export/products', { responseType: 'blob' });

// Users (admin)
export const getUsers = (params) => API.get('/users', { params });
export const getUser = (id) => API.get(`/users/${id}`);
export const updateUser = (id, data) => API.put(`/users/${id}`, data);
export const deleteUser = (id) => API.delete(`/users/${id}`);

// Audit
export const getAuditLogs = (params) => API.get('/audit', { params });

// Suppliers
export const createSupplier = (data) => API.post('/suppliers', data);
export const getSuppliers = () => API.get('/suppliers');
export const createPurchaseOrder = (data) => API.post('/suppliers/po', data);
export const getPurchaseOrders = () => API.get('/suppliers/po');
export const receivePurchaseOrder = (id) => API.put(`/suppliers/po/${id}/receive`);
export const createSupplierPayment = (data) => API.post('/suppliers/payment', data);

// Expenses
export const createExpense = (data) => API.post('/expenses', data);
export const getExpenses = (params) => API.get('/expenses', { params });
export const deleteExpense = (id) => API.delete(`/expenses/${id}`);

// Deliveries
export const assignDelivery = (data) => API.post('/deliveries', data);
export const getDeliveries = (params) => API.get('/deliveries', { params });
export const updateDeliveryStatus = (id, data) => API.put(`/deliveries/${id}/status`, data);
export const getTodayPriority = () => API.get('/deliveries/today-priority');

export default API;
