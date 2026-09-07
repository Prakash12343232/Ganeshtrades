import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  getPayments: vi.fn(),
  getPendingPayments: vi.fn()
}));

const { getPayments, getPendingPayments } = await import('../../services/api');
const AdminPayments = (await import('./AdminPayments.jsx')).default;

const payment = (id, extra = {}) => ({
  _id: id,
  user: { name: 'Ravi Kumar', mobile: '9876543210' },
  order: { orderNumber: 'ORD-1' },
  amount: 500,
  paymentMethod: 'cash',
  paymentStatus: 'completed',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...extra
});

describe('AdminPayments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPayments.mockResolvedValue({ data: { data: [payment('p1')], pagination: { total: 1, page: 1, pages: 1 } } });
    getPendingPayments.mockResolvedValue({ data: { data: [] } });
  });

  it('loads the first page with limit 20 and renders payment rows', async () => {
    render(<AdminPayments />);

    await screen.findByText('Ravi Kumar');

    expect(getPayments).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(getPendingPayments).toHaveBeenCalledTimes(1);
    expect(screen.getByText('#ORD-1')).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument();
  });

  it('shows a pager and loads the selected page when pagination spans multiple pages', async () => {
    getPayments
      .mockResolvedValueOnce({ data: { data: [payment('p1')], pagination: { total: 35, page: 1, pages: 2 } } })
      .mockResolvedValue({ data: { data: [payment('p2')], pagination: { total: 35, page: 2, pages: 2 } } });

    render(<AdminPayments />);
    await screen.findByText('Ravi Kumar');

    const pageTwo = screen.getByRole('button', { name: '2' });
    fireEvent.click(pageTwo);

    await waitFor(() => {
      expect(getPayments).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
    });
  });

  it('navigates to the next payment page with the Next button', async () => {
    getPayments
      .mockResolvedValueOnce({ data: { data: [payment('p1')], pagination: { total: 45, page: 1, pages: 3 } } })
      .mockResolvedValue({ data: { data: [payment('p3')], pagination: { total: 45, page: 2, pages: 3 } } });

    render(<AdminPayments />);
    await screen.findByText('Ravi Kumar');

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      expect(getPayments).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
    });
  });

  it('switches to the pending tab and lists customers with outstanding amounts', async () => {
    getPendingPayments.mockResolvedValue({ data: { data: [{ _id: 'u9', name: 'Sita Devi', mobile: '9123456789', customerType: 'hotel', pendingAmount: 1200 }] } });

    render(<AdminPayments />);
    await screen.findByText('Ravi Kumar');

    fireEvent.click(screen.getByRole('button', { name: /Pending/ }));

    expect(await screen.findByText('Sita Devi')).toBeInTheDocument();
    expect(screen.getByText('₹1200')).toBeInTheDocument();
  });
});