import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  getUsers: vi.fn(),
  createSettlement: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

const { getUsers, createSettlement } = await import('../../services/api');
const AdminCredit = (await import('./AdminCredit.jsx')).default;

const creditCustomers = [
  { _id: 'u1', name: 'Ravi Kumar', mobile: '9876543210', customerType: 'hotel', creditBalance: 500, creditLimit: 2000, isActive: true },
  { _id: 'u2', name: 'Sita Devi', mobile: '9123456789', customerType: 'public', creditBalance: 0, creditLimit: 1000, isActive: true }
];

describe('AdminCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsers.mockResolvedValue({ data: { data: creditCustomers, pagination: { total: 2, page: 1, pages: 1 } } });
    createSettlement.mockResolvedValue({ data: { success: true } });
  });

  it('fetches the first page of credit users with the server-side hasCredit filter', async () => {
    render(<AdminCredit />);

    await screen.findByText('Ravi Kumar');

    expect(getUsers).toHaveBeenCalledWith({ page: 1, limit: 20, hasCredit: true });
    expect(screen.getByText('Sita Devi')).toBeInTheDocument();
  });

  it('fetches page 2 when a pager page is clicked', async () => {
    getUsers
      .mockResolvedValueOnce({ data: { data: creditCustomers, pagination: { total: 45, page: 1, pages: 3 } } })
      .mockResolvedValue({ data: { data: creditCustomers, pagination: { total: 45, page: 2, pages: 3 } } });

    render(<AdminCredit />);
    await screen.findByText('Ravi Kumar');

    fireEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(getUsers).toHaveBeenLastCalledWith({ page: 2, limit: 20, hasCredit: true });
    });
  });

  it('records a khata settlement and refetches the current page', async () => {
    render(<AdminCredit />);
    await screen.findByText('Ravi Kumar');

    fireEvent.click(screen.getAllByRole('button', { name: /Settle Payment/ })[0]);
    await screen.findByText('Settle Khata - Ravi Kumar');

    fireEvent.click(screen.getByRole('button', { name: 'Record Payment' }));

    await waitFor(() => {
      expect(createSettlement).toHaveBeenCalledWith({ userId: 'u1', amount: 500, paymentMethod: 'cash' });
    });
    expect(getUsers).toHaveBeenCalledTimes(2);
  });
});