import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import toast from 'react-hot-toast';

vi.mock('../../services/api', () => ({
  getTodayPriority: vi.fn(),
  getDeliveries: vi.fn(),
  updateDeliveryStatus: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

const { getTodayPriority, getDeliveries, updateDeliveryStatus } = await import('../../services/api');
const AdminDeliveries = (await import('./AdminDeliveries.jsx')).default;

const baseDelivery = {
  _id: 'd1',
  deliveryPersonName: 'Amit Singh',
  deliveryPersonMobile: '9876501234',
  status: 'assigned',
  createdAt: '2025-01-01T10:00:00.000Z',
  order: {
    _id: 'o1',
    orderNumber: 'GT202500001',
    finalAmount: 120,
    deliveryType: 'instant',
    distanceFromShop: 2.4,
    user: { name: 'Ravi Kumar', mobile: '9876543210' },
    deliveryAddress: { street: '12 MG Road', area: 'Indiranagar' }
  }
};

const priorityResponse = {
  data: {
    data: {
      late: [], today: [baseDelivery], instant: [], future: [],
      stats: { lateCount: 0, todayCount: 1, instantCount: 0, futureCount: 0 }
    }
  }
};

async function openHistory() {
  fireEvent.click(screen.getByRole('button', { name: 'All Deliveries' }));
  await screen.findByText('#GT202500001');
}

describe('AdminDeliveries history view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTodayPriority.mockResolvedValue(priorityResponse);
    getDeliveries.mockResolvedValue({
      data: { data: [baseDelivery], pagination: { total: 1, page: 1, pages: 1 } }
    });
  });

  it('renders the priority queue by default and switches to a filtered delivery history table', async () => {
    render(<AdminDeliveries />);

    await screen.findByText('Today\'s Schedule');
    expect(getTodayPriority).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('All Deliveries')).toBeInTheDocument();

    await openHistory();

    expect(getDeliveries).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(screen.getByText('#GT202500001')).toBeInTheDocument();
    expect(screen.getByText('Amit Singh')).toBeInTheDocument();
    expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
  });

  it('refetches with the status filter when one is selected', async () => {
    render(<AdminDeliveries />);
    await openHistory();

    fireEvent.change(screen.getByLabelText('Delivery Status'), { target: { value: 'delivered' } });

    await waitFor(() => {
      expect(getDeliveries).toHaveBeenCalledWith({ page: 1, limit: 20, status: 'delivered' });
    });
  });

  it('shows a page-number pager and loads the selected page', async () => {
    getDeliveries.mockImplementation((params) => {
      if (params.page === 2) {
        return Promise.resolve({
          data: {
            data: [{ ...baseDelivery, _id: 'd2', status: 'delivered' }],
            pagination: { total: 21, page: 2, pages: 2 }
          }
        });
      }
      return Promise.resolve({
        data: { data: [baseDelivery], pagination: { total: 21, page: 1, pages: 2 } }
      });
    });

    render(<AdminDeliveries />);
    await openHistory();

    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    const pageTwo = screen.getByRole('button', { name: '2' });
    fireEvent.click(pageTwo);

    await waitFor(() => {
      expect(getDeliveries).toHaveBeenCalledWith({ page: 2, limit: 20 });
    });
  });

  it('shows status action buttons for active deliveries in history and updates them', async () => {
    render(<AdminDeliveries />);
    await openHistory();
    updateDeliveryStatus.mockResolvedValue({ data: { success: true } });

    fireEvent.click(screen.getByRole('button', { name: 'Mark Picked Up' }));

    await waitFor(() => {
      expect(updateDeliveryStatus).toHaveBeenCalledWith('d1', { status: 'picked_up' });
    });
    expect(toast.success).toHaveBeenCalledWith('Status updated');
    expect(getDeliveries).toHaveBeenCalledTimes(2);
  });
});