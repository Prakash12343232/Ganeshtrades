import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import toast from 'react-hot-toast';

const navigateMock = vi.fn();
const clearCartMock = vi.fn(() => {
  cartState.items = [];
});
const cartState = { items: [], totalAmount: 200 };
const authState = { user: null };

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock
}));

vi.mock('../../services/api', () => ({
  createOrder: vi.fn(),
  checkServiceability: vi.fn(),
  createPaymentOrder: vi.fn(),
  verifyPayment: vi.fn(),
  getTimeSlots: vi.fn()
}));

vi.mock('../../context/CartContext', () => ({
  useCart: () => ({ ...cartState, removeFromCart: vi.fn(), updateQuantity: vi.fn(), clearCart: clearCartMock })
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => authState
}));

vi.mock('../../utils/useTimeSlots', () => ({
  useTimeSlots: () => ['10 AM - 12 PM', '12 PM - 2 PM', '4 PM - 6 PM']
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

const { createOrder, checkServiceability, createPaymentOrder } = await import('../../services/api');
const { default: Cart } = await import('./Cart.jsx');

const CART_ITEMS = [
  { product: 'p1', name: 'Rice', price: 100, quantity: 2, stock: 10, image: 'rice.jpg' }
];

const USER = {
  _id: 'u1',
  name: 'Test Customer',
  address: { lat: 18.5, lng: 73.9, street: 'MG Road', area: 'Pune', city: 'Pune', pincode: '411001' }
};

async function renderCart() {
  const utils = render(<Cart />);
  await screen.findByText('Shopping Cart (1 items)');
  return utils;
}

describe('Cart place-order duplicate protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cartState.items = [...CART_ITEMS];
    cartState.totalAmount = 200;
    authState.user = { ...USER };
    checkServiceability.mockResolvedValue({ data: { data: { serviceable: true, distance: 2, radius: 15 } } });
    createOrder.mockResolvedValue({ data: { data: { _id: 'o1', orderNumber: 'GT2026000001', finalAmount: 200 } } });
  });

  it('clears the cart immediately once the order is created (online payment init fails)', async () => {
    await renderCart();
    createPaymentOrder.mockRejectedValue({ response: { data: { message: 'gateway down' } } });

    fireEvent.click(screen.getByRole('button', { name: /Pay ₹200.00 Online/ }));

    await waitFor(() => {
      expect(clearCartMock).toHaveBeenCalled();
      expect(createOrder).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      // The user is routed to the created order (payment can be resumed there)
      // instead of being left on the cart to place a duplicate order.
      expect(navigateMock).toHaveBeenCalledWith('/orders/o1');
    });
    expect(toast.error).toHaveBeenCalled();
  });

  it('clears the cart and returns a duplicate-order-safe null cart even on payment success path', async () => {
    await renderCart();
    createPaymentOrder.mockResolvedValue({ data: { data: { gatewayOrderId: 'order_x', paymentId: 'p1', amount: 200 } } });

    fireEvent.click(screen.getByRole('button', { name: /Pay ₹200.00 Online/ }));

    await waitFor(() => {
      expect(createPaymentOrder).toHaveBeenCalledWith({ orderId: 'o1', paymentMode: 'upi' });
      expect(clearCartMock).toHaveBeenCalled();
    });
    await screen.findByText('Ganesh Trades Gateway');
    // Cart stays empty while the modal is open — the order owns the items now.
    expect(cartState.items).toHaveLength(0);
  });

  it('navigates to the created order when the payment modal is closed (resume payment flow)', async () => {
    await renderCart();
    createPaymentOrder.mockResolvedValue({ data: { data: { gatewayOrderId: 'order_x', paymentId: 'p1', amount: 200 } } });

    fireEvent.click(screen.getByRole('button', { name: /Pay ₹200.00 Online/ }));
    await screen.findByText('Ganesh Trades Gateway');

    fireEvent.click(screen.getByRole('button', { name: /Cancel Transaction/ }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/orders/o1');
    });
    // A subsequent Place Order click cannot re-create the order because the
    // cart is empty (component now renders the empty-cart screen).
    expect(cartState.items).toHaveLength(0);
  });

  it('places a cash order, clears the cart and navigates to the order', async () => {
    await renderCart();
    fireEvent.click(screen.getByRole('radio', { name: /Cash on Delivery/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Place Order' }));

    await waitFor(() => {
      expect(createOrder).toHaveBeenCalledTimes(1);
      expect(clearCartMock).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith('/orders/o1');
    });
    expect(createPaymentOrder).not.toHaveBeenCalled();
  });
});