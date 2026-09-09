import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'u1' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }) => <a {...props}>{children}</a>
}));

vi.mock('../../services/api', () => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  getOrders: vi.fn(),
  getCreditHistory: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

const { getUser, updateUser, getOrders, getCreditHistory } = await import('../../services/api');
const AdminCustomerDetail = (await import('./AdminCustomerDetail.jsx')).default;

const mockUser = {
  _id: 'u1', name: 'Ravi Kumar', mobile: '9876543210', email: 'ravi@test.com',
  customerType: 'public', role: 'customer', isActive: true,
  creditBalance: 500, creditLimit: 2000, pendingAmount: 300, totalSpent: 5000,
  address: { street: '123 Main St', city: 'Pune', pincode: '411001' }
};

const mockOrders = [
  { _id: 'o1', orderNumber: 'GT202500001', finalAmount: 200, orderStatus: 'delivered', paymentStatus: 'paid', deliveryType: 'instant', createdAt: '2025-01-15T10:00:00.000Z' },
  { _id: 'o2', orderNumber: 'GT202500002', finalAmount: 150, orderStatus: 'confirmed', paymentStatus: 'pending', deliveryType: 'scheduled', createdAt: '2025-02-01T10:00:00.000Z' }
];

const mockCreditHistory = {
  transactions: [
    { _id: 'ct1', amount: 200, type: 'debit', description: 'Order GT202500001', createdAt: '2025-01-15T10:00:00.000Z', referenceOrder: { orderNumber: 'GT202500001' }, loggedBy: { name: 'Admin' } },
    { _id: 'ct2', amount: 100, type: 'credit', description: 'Settlement', createdAt: '2025-02-01T10:00:00.000Z', referenceSettlement: { amount: 100 }, loggedBy: { name: 'Admin' } }
  ],
  pagination: { total: 2, page: 1, pages: 1 }
};

describe('AdminCustomerDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { data: mockUser } });
    getOrders.mockResolvedValue({ data: { data: mockOrders, pagination: { page: 1, pages: 2, total: 15 } } });
    getCreditHistory.mockResolvedValue({ data: { data: mockCreditHistory } });
    updateUser.mockResolvedValue({ data: { success: true } });
  });

  it('renders customer name, mobile, and financial summary', async () => {
    render(<AdminCustomerDetail />);
    await screen.findByText('Ravi Kumar');
    expect(screen.getByText(/9876543210/)).toBeInTheDocument();
    expect(screen.getByText(/ravi@test.com/)).toBeInTheDocument();
    expect(screen.getByText('Total Spent')).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument();
    expect(screen.getByText('₹2,000')).toBeInTheDocument();
  });

  it('shows delivery address', async () => {
    render(<AdminCustomerDetail />);
    await screen.findByText(/123 Main St/);
    expect(screen.getByText(/Pune/)).toBeInTheDocument();
  });

  it('shows order history in the Orders tab by default', async () => {
    render(<AdminCustomerDetail />);
    await screen.findByText('GT202500001');
    expect(screen.getByText('GT202500002')).toBeInTheDocument();
    expect(screen.getByText('delivered')).toBeInTheDocument();
    expect(screen.getByText('confirmed')).toBeInTheDocument();
  });

  it('switches to Credit History tab and shows transactions', async () => {
    render(<AdminCustomerDetail />);
    await screen.findByText('GT202500001');
    fireEvent.click(screen.getByText('Credit History'));
    await waitFor(() => {
      expect(screen.getByText('Debit')).toBeInTheDocument();
      expect(screen.getByText('Credit')).toBeInTheDocument();
      expect(screen.getByText('Order GT202500001')).toBeInTheDocument();
      expect(screen.getByText('Settlement ₹100')).toBeInTheDocument();
    });
  });

  it('opens edit form and saves changes', async () => {
    render(<AdminCustomerDetail />);
    await screen.findByText('Ravi Kumar');
    fireEvent.click(screen.getByText('Edit'));
    const nameInput = screen.getByDisplayValue('Ravi Kumar');
    fireEvent.change(nameInput, { target: { value: 'Ravi K.' } });
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Ravi K.' }));
    });
  });
});
