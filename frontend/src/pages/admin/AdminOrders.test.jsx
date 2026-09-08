import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import toast from 'react-hot-toast';

vi.mock('../../services/api', () => ({
  getOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
  rescheduleOrder: vi.fn(),
  assignDelivery: vi.fn(),
  createPayment: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

const { getOrders, assignDelivery, createPayment, updateOrderStatus } = await import('../../services/api');
const AdminOrders = (await import('./AdminOrders.jsx')).default;

const baseOrders = [
  {
    _id: 'o1',
    orderNumber: 'GT202500001',
    user: { _id: 'u1', name: 'Ravi Kumar', mobile: '9876543210' },
    deliveryType: 'instant',
    finalAmount: 120,
    paymentStatus: 'pending',
    paymentMethod: 'cash',
    orderStatus: 'confirmed',
    createdAt: '2025-01-01T10:00:00.000Z',
    deliveryAssigned: false
  },
  {
    _id: 'o2',
    orderNumber: 'GT202500002',
    user: { _id: 'u2', name: 'Sita Devi', mobile: '9123456789' },
    deliveryType: 'scheduled',
    scheduledDelivery: { date: '2025-01-02T00:00:00.000Z', timeSlot: '8 AM - 10 AM' },
    finalAmount: 250,
    paymentStatus: 'paid',
    paymentMethod: 'upi',
    orderStatus: 'processing',
    createdAt: '2025-01-01T11:00:00.000Z',
    deliveryAssigned: true,
    deliveryPersonName: 'Amit Singh',
    deliveryStatus: 'assigned'
  }
];

const submitAssign = () =>
    screen.getAllByRole('button', { name: 'Assign Delivery' }).find(b => !b.title);

const submitPay = () =>
    screen.getAllByRole('button', { name: 'Record Payment' }).find(b => !b.title);

async function openAssignModal() {
  render(<AdminOrders />);
  await screen.findByText('#GT202500001');
  fireEvent.click(screen.getByTitle('Assign Delivery'));
  expect(screen.getByText('Assign Delivery for Order #GT202500001')).toBeInTheDocument();
}

describe('AdminOrders Assign Delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrders.mockResolvedValue({ data: { data: baseOrders, pagination: { total: baseOrders.length, page: 1, pages: 1 } } });
    assignDelivery.mockResolvedValue({ data: { success: true } });
    createPayment.mockResolvedValue({ data: { success: true } });
  });

  it('renders assigned person for orders that already have a delivery and shows an assign button only for unassigned orders', async () => {
    render(<AdminOrders />);

    await screen.findByText('#GT202500001');
    expect(screen.getByText('Amit Singh')).toBeInTheDocument();

    const assignButtons = screen.getAllByTitle('Assign Delivery');
    expect(assignButtons).toHaveLength(1);
  });

  it('assigns a delivery via the modal', async () => {
    await openAssignModal();

    fireEvent.change(screen.getByPlaceholderText('e.g. Rahul Sharma'), { target: { value: 'Rahul Sharma' } });
    fireEvent.change(screen.getByPlaceholderText('10-digit mobile number'), { target: { value: '9876501234' } });
    fireEvent.change(screen.getByPlaceholderText('Any instructions for the delivery person'), { target: { value: 'Ring the bell' } });

    fireEvent.click(submitAssign());

    await waitFor(() => {
      expect(assignDelivery).toHaveBeenCalledWith({
        orderId: 'o1',
        deliveryPersonName: 'Rahul Sharma',
        deliveryPersonMobile: '9876501234',
        notes: 'Ring the bell'
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Delivery assigned!');
    expect(getOrders).toHaveBeenCalledTimes(2);
  });

  it('shows an assign button again for an order whose delivery failed (re-dispatch)', async () => {
    const orders = [
      {
        _id: 'o9',
        orderNumber: 'GT202500009',
        user: { name: 'Kiran Rao', mobile: '9812345678' },
        deliveryType: 'instant',
        finalAmount: 80,
        paymentStatus: 'paid',
        paymentMethod: 'cash',
        orderStatus: 'processing',
        createdAt: '2025-01-01T13:00:00.000Z',
        deliveryAssigned: true,
        deliveryPersonName: 'Old Rider',
        deliveryStatus: 'failed'
      }
    ];
    getOrders.mockResolvedValue({ data: { data: orders, pagination: { total: orders.length, page: 1, pages: 1 } } });

    render(<AdminOrders />);

    await screen.findByText('#GT202500009');
    expect(screen.getByTitle('Assign Delivery')).toBeInTheDocument();
  });

  it('loads more orders when pagination has more pages', async () => {
  getOrders.mockImplementation((params) => {
    if (params.page === 2) {
      return Promise.resolve({
        data: {
          data: [{
            _id: 'o3',
            orderNumber: 'GT202500003',
            user: { name: 'Gopal Rao', mobile: '9012345678' },
            deliveryType: 'instant',
            finalAmount: 90,
            paymentStatus: 'paid',
            paymentMethod: 'cash',
            orderStatus: 'delivered',
            createdAt: '2025-01-01T12:00:00.000Z',
            deliveryAssigned: false
          }],
          pagination: { total: 51, page: 2, pages: 2 }
        }
      });
    }
    return Promise.resolve({ data: { data: baseOrders, pagination: { total: 51, page: 1, pages: 2 } } });
  });

  render(<AdminOrders />);

  await screen.findByText('#GT202500001');
  fireEvent.click(screen.getByRole('button', { name: 'Load More Orders' }));

  await screen.findByText('#GT202500003');
  expect(screen.getByText('#GT202500001')).toBeInTheDocument();
  expect(getOrders).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
});

it('blocks assignment when the mobile number is invalid', async () => {
    await openAssignModal();

    fireEvent.change(screen.getByPlaceholderText('e.g. Rahul Sharma'), { target: { value: 'Rahul Sharma' } });
    fireEvent.change(screen.getByPlaceholderText('10-digit mobile number'), { target: { value: '123' } });
    fireEvent.click(submitAssign());

    await waitFor(() => {
      expect(assignDelivery).not.toHaveBeenCalled();
    });
    expect(toast.error).toHaveBeenCalledWith('Enter a valid 10-digit mobile number');
  });
});

describe('AdminOrders Record Payment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrders.mockResolvedValue({ data: { data: baseOrders, pagination: { total: baseOrders.length, page: 1, pages: 1 } } });
    createPayment.mockResolvedValue({ data: { success: true } });
  });

  it('shows a Record Payment button only for unpaid non-cancelled orders', async () => {
    render(<AdminOrders />);

    await screen.findByText('#GT202500001');
    const payButtons = screen.getAllByTitle('Record Payment');
    expect(payButtons).toHaveLength(1);
  });

  it('records a payment via the modal and refreshes the order list', async () => {
    render(<AdminOrders />);
    await screen.findByText('#GT202500001');

    fireEvent.click(screen.getByTitle('Record Payment'));
    expect(screen.getByText('Record Payment for Order #GT202500001')).toBeInTheDocument();

    expect(screen.getByDisplayValue('120')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Any payment reference details'), { target: { value: 'UPI ref 12345' } });
    fireEvent.click(submitPay());

    await waitFor(() => {
      expect(createPayment).toHaveBeenCalledWith({
        userId: 'u1',
        orderId: 'o1',
        amount: 120,
        paymentMethod: 'cash',
        notes: 'UPI ref 12345'
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Payment recorded');
    expect(getOrders).toHaveBeenCalledTimes(2);
  });

  it('blocks submission when the amount exceeds the order total', async () => {
    render(<AdminOrders />);
    await screen.findByText('#GT202500001');

    fireEvent.click(screen.getByTitle('Record Payment'));
    fireEvent.change(screen.getByDisplayValue('120'), { target: { value: '500' } });
    fireEvent.click(submitPay());

    await waitFor(() => {
      expect(createPayment).not.toHaveBeenCalled();
    });
    expect(toast.error).toHaveBeenCalledWith('Amount exceeds order total of ₹120');
  });

  it('surfaces a backend rejection as an error toast', async () => {
    createPayment.mockRejectedValue({ response: { data: { message: 'Payment exceeds outstanding amount of ₹50' } } });
    render(<AdminOrders />);
    await screen.findByText('#GT202500001');

    fireEvent.click(screen.getByTitle('Record Payment'));
    fireEvent.click(submitPay());

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Payment exceeds outstanding amount of ₹50');
    });
  });
});

describe('AdminOrders Cancel Order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrders.mockResolvedValue({ data: { data: baseOrders, pagination: { total: baseOrders.length, page: 1, pages: 1 } } });
    updateOrderStatus.mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a Cancel Order button only for non-delivered non-cancelled orders', async () => {
    render(<AdminOrders />);
    await screen.findByText('#GT202500001');

    const cancelButtons = screen.getAllByTitle('Cancel Order');
    expect(cancelButtons).toHaveLength(2); // o1 (confirmed) + o2 (processing)
  });

  it('cancels an order via the status update API after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AdminOrders />);
    await screen.findByText('#GT202500001');

    fireEvent.click(screen.getAllByTitle('Cancel Order')[0]);

    await waitFor(() => {
      expect(updateOrderStatus).toHaveBeenCalledWith('o1', { orderStatus: 'cancelled' });
    });
    expect(toast.success).toHaveBeenCalledWith('Order cancelled');
    expect(getOrders).toHaveBeenCalledTimes(2);
  });

  it('does not cancel when the admin dismisses the confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AdminOrders />);
    await screen.findByText('#GT202500001');

    fireEvent.click(screen.getAllByTitle('Cancel Order')[0]);

    await waitFor(() => {
      expect(updateOrderStatus).not.toHaveBeenCalled();
    });
  });

  it('surfaces a backend cancellation rejection as an error toast', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    updateOrderStatus.mockRejectedValue({ response: { data: { message: 'Cannot cancel a delivered order' } } });
    render(<AdminOrders />);
    await screen.findByText('#GT202500001');

    fireEvent.click(screen.getAllByTitle('Cancel Order')[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Cannot cancel a delivered order');
    });
  });
});