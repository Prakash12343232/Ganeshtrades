const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createOrder,
  getOrders,
  getUpcomingScheduledOrders,
  getTimeSlots,
  getOrderById,
  rescheduleOrder,
  updateOrderStatus,
  cancelOrder,
  getOrderInvoice
} = require('../controllers/orderController');

// ─── POST /api/orders — Create order ───
router.post('/', protect, createOrder);

// ─── GET /api/orders — List orders (with scheduling filters) ───
router.get('/', protect, getOrders);

// ─── GET /api/orders/scheduled/upcoming — Upcoming scheduled deliveries ───
router.get('/scheduled/upcoming', protect, authorize('admin', 'manager'), getUpcomingScheduledOrders);

// ─── GET /api/orders/time-slots — Available time slots ───
router.get('/time-slots', getTimeSlots);

// ─── GET /api/orders/:id ───
router.get('/:id', protect, getOrderById);

// ─── PUT /api/orders/:id/reschedule — Reschedule delivery ───
router.put('/:id/reschedule', protect, rescheduleOrder);

// ─── PUT /api/orders/:id/status ───
router.put('/:id/status', protect, authorize('admin', 'manager'), updateOrderStatus);

// ─── PUT /api/orders/:id/cancel ───
router.put('/:id/cancel', protect, cancelOrder);

// ─── GET /api/orders/:id/invoice ───
router.get('/:id/invoice', protect, getOrderInvoice);

module.exports = router;
