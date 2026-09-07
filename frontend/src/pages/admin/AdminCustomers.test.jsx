import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  getUsers: vi.fn(),
  updateUser: vi.fn(),
  getUserStats: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

const { getUsers, updateUser, getUserStats } = await import('../../services/api');
const AdminCustomers = (await import('./AdminCustomers.jsx')).default;

const mockStats = {
  data: {
    data: {
      stats: [
        { _id: 'public', count: 10, totalSpent: 1000, totalPending: 200 },
        { _id: 'hotel', count: 5, totalSpent: 2000, totalPending: 50 },
        { _id: 'pg_hostel', count: 3, totalSpent: 500, totalPending: 0 }
      ],
      totalCustomers: 18,
      activeCustomers: 15
    }
  }
};

const customers = [
  { _id: 'u1', name: 'Ravi Kumar', mobile: '9876543210', email: 'ravi@example.com', customerType: 'public', totalOrders: 4, totalSpent: 1200, pendingAmount: 0, isActive: true },
  { _id: 'u2', name: 'Sita Devi', mobile: '9123456789', email: 'sita@example.com', customerType: 'hotel', totalOrders: 9, totalSpent: 5000, pendingAmount: 300, isActive: true }
];

describe('AdminCustomers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsers.mockResolvedValue({ data: { data: customers, pagination: { total: customers.length, page: 1, pages: 1 } } });
    getUserStats.mockResolvedValue(mockStats);
    updateUser.mockResolvedValue({ data: { success: true } });
  });

  it('renders customer-type summary cards and totals from getUserStats', async () => {
    render(<AdminCustomers />);

    await screen.findByText('Ravi Kumar');

    expect(getUserStats).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.getByText('Hotel / Restaurants')).toBeInTheDocument();
    expect(screen.getByText('PG / Hostel')).toBeInTheDocument();
    expect(screen.getByText('₹1,000')).toBeInTheDocument();
    expect(screen.getByText('₹200')).toBeInTheDocument();
    expect(screen.getByText('₹2,000')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('renders customer rows and outstanding amounts', async () => {
    render(<AdminCustomers />);
    await screen.findByText('Ravi Kumar');

    expect(screen.getByText('9876543210')).toBeInTheDocument();
    expect(screen.getByText('Sita Devi')).toBeInTheDocument();
    expect(screen.getByText('₹300')).toBeInTheDocument();
  });

  it('fetches page 2 with limit 20 when a pager page is clicked', async () => {
    getUsers
      .mockResolvedValueOnce({ data: { data: customers, pagination: { total: 45, page: 1, pages: 3 } } })
      .mockResolvedValue({ data: { data: customers, pagination: { total: 45, page: 2, pages: 3 } } });

    render(<AdminCustomers />);
    await screen.findByText('Ravi Kumar');

    const pageTwo = screen.getAllByRole('button', { name: '2' })[0];
    fireEvent.click(pageTwo);

    await waitFor(() => {
      expect(getUsers).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
    });
  });

  it('applies search and customer-type filters to the getUsers request', async () => {
    render(<AdminCustomers />);
    await screen.findByText('Ravi Kumar');

    fireEvent.change(screen.getByPlaceholderText('Search by name, mobile...'), { target: { value: 'Sita' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'hotel' })[0]);

    await waitFor(() => {
      expect(getUsers).toHaveBeenCalledWith({
        page: 1, limit: 20, search: 'Sita', customerType: 'hotel'
      });
    });
  });

  it('toggles a customer active state via updateUser and refetches', async () => {
    render(<AdminCustomers />);
    await screen.findByText('Ravi Kumar');

    fireEvent.click(screen.getAllByTitle('Toggle active status')[0]);

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith('u1', { isActive: false });
    });
    expect(getUsers).toHaveBeenCalledTimes(2);
  });
});