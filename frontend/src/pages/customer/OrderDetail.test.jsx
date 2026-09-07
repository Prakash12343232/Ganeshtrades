import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import toast from 'react-hot-toast';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'o1' })
}));

vi.mock('../../services/api', () => ({
  getOrder: vi.fn(),
  cancelOrder: vi.fn(),
  downloadInvoice: vi.fn(),
  rescheduleOrder: vi.fn(),
  createPaymentOrder: vi.fn(),
  verifyPayment: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

const { getOrder, createPaymentOrder, verifyPayment } = await import('../../services/api');
const { default: OrderDetail } = await import('./OrderDetail.jsx');

const baseOrder = {
  _id: 'o1',
  orderNumber: 'GT202500001',
  createdAt: '2025-01-01T10:00:00.000Z',
  deliveryType: 'instant',
  distanceFromShop: 2,
  finalAmount: 200,
  paymentStatus: 'pending',
  paymentMethod: 'upi',
  orderStatus: 'pending',
  estimatedDeliveryTime: '2025-01-01T12:00:00.000Z',
  items: [{ product: { image: 'x.jpg' }, name: 'Rice', price: 100, quantity: 2, total: 200 }],
  deliveryAddress: { street: 'MG Road', area: 'Pune', city: 'Pune', pincode: '411001' }
};

function mockOrder(overrides = {}) {
  getOrder.mockResolvedValue({ data: { data: { ...baseOrder, ...overrides } } });
}

async function renderOrder(overrides = {}) {
  mockOrder(overrides);
  const utils = render(<OrderDetail />);
  await screen.findByText('Order #GT202500001');
  return utils;
}

describe('OrderDetail Online Payment Resume', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the Resume Payment surface for an unpaid online-method order', async () => {
    await renderOrder();
    expect(screen.getByText('💳 Payment Required')).toBeInTheDocument();
    expect(screen.getByText(/Pay Now ₹200.00/)).toBeInTheDocument();
    expect(screen.getByText('UPI')).toBeInTheDocument();
  });

  it.each([
    ['paid online order', { paymentStatus: 'paid', paymentMethod: 'upi' }],
    ['cash order', { paymentStatus: 'pending', paymentMethod: 'cash' }],
    ['cancelled online order', { paymentStatus: 'pending', paymentMethod: 'card', orderStatus: 'cancelled' }]
  ])('does not show a resume payment surface for a %s', async (_label, overrides) => {
    await renderOrder(overrides);
    expect(screen.queryByText('💳 Payment Required')).not.toBeInTheDocument();
    expect(screen.queryByText(/Pay Now/)).not.toBeInTheDocument();
  });

  it('resumes the aborted gateway payment: Pay Now → authorize → order reloaded as paid', async () => {
    await renderOrder();
    createPaymentOrder.mockResolvedValue({
      data: { data: { gatewayOrderId: 'order_resume_1', paymentId: 'p1', amount: 200 } }
    });
    const paidOrder = { paymentStatus: 'paid' };
    getOrder.mockResolvedValue({ data: { data: { ...baseOrder, ...paidOrder } } });

    fireEvent.click(screen.getByRole('button', { name: 'UPI' }));
    fireEvent.click(screen.getByRole('button', { name: /Pay Now ₹200.00/ }));

    await waitFor(() => {
      expect(createPaymentOrder).toHaveBeenCalledWith({ orderId: 'o1', paymentMode: 'upi' });
    });

    await screen.findByText('Ganesh Trades Gateway');
    const authorize = screen.getByRole('button', { name: /Authorize Payment/ });
    fireEvent.click(authorize);

    await waitFor(() => {
      expect(verifyPayment).toHaveBeenCalledWith(expect.objectContaining({ gatewayOrderId: 'order_resume_1' }));
    }, { timeout: 5000 });

    await waitFor(() => {
      expect(getOrder).toHaveBeenCalledTimes(2);
    });
    expect(toast.success).toHaveBeenCalledWith('💳 Payment successful! Order confirmed.');
    expect(screen.queryByText('Ganesh Trades Gateway')).not.toBeInTheDocument();
  });
});