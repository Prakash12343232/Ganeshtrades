import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Circle: () => null,
  Marker: ({ children }) => <div>{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  useMap: () => ({ setView: vi.fn() })
}));

vi.mock('leaflet', () => ({
  default: {
    Icon: { Default: { prototype: { _getIconUrl: undefined }, mergeOptions: vi.fn() } },
    DivIcon: vi.fn(function () { return {}; })
  }
}));

vi.mock('../../services/api', () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getCoverageStats: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

const { getSettings, updateSettings, getCoverageStats } = await import('../../services/api');
const AdminCoverage = (await import('./AdminCoverage.jsx')).default;

const baseSettings = {
  shopName: 'Ganesh Trades',
  shopAddress: 'HW4C+XJ Pune, Maharashtra, India',
  shopPlusCode: 'HW4C+XJ',
  shopLocation: { lat: 18.557473097373734, lng: 73.92156518195121 },
  deliveryRadiusKm: 15,
  isDeliveryRestrictionActive: true,
  deliveryFeePerKm: 0,
  freeDeliveryWithinKm: 5
};

const emptyStats = {
  data: {
    data: {
      stats: { totalCustomers: 0, withinRadius: 0, outsideRadius: 0, avgDistance: 0 },
      distanceBuckets: [],
      customerMarkers: []
    }
  }
};

async function renderCoverage() {
  getSettings.mockResolvedValue({ data: { data: baseSettings } });
  getCoverageStats.mockResolvedValue(emptyStats);
  render(<AdminCoverage />);
  await screen.findByDisplayValue('18.557473097373734');
}

const submitForm = () => fireEvent.submit(screen.getByRole('button', { name: /Save Settings/i }).closest('form'));

describe('AdminCoverage numeric inputs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders saved settings into numeric inputs', async () => {
    await renderCoverage();
    expect(screen.getByDisplayValue('73.92156518195121')).toBeInTheDocument();
    expect(screen.getByDisplayValue('15')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toBeInTheDocument();
  });

  it('does not crash when a coordinate is cleared and blocks saving invalid values', async () => {
    await renderCoverage();

    fireEvent.change(screen.getByDisplayValue('18.557473097373734'), { target: { value: '' } });
    expect(screen.getByTestId('map')).toBeInTheDocument();

    submitForm();

    await waitFor(() => {
      expect(updateSettings).not.toHaveBeenCalled();
    });
    expect(toast.error).toHaveBeenCalledWith('Enter valid latitude, longitude and delivery radius values');
  });

  it('blocks saving a blank delivery radius', async () => {
    await renderCoverage();

    fireEvent.change(screen.getByDisplayValue('15'), { target: { value: '' } });
    submitForm();

    await waitFor(() => {
      expect(updateSettings).not.toHaveBeenCalled();
    });
    expect(toast.error).toHaveBeenCalledWith('Enter valid latitude, longitude and delivery radius values');
  });

  it('saves parsed numeric values when the inputs are valid', async () => {
    updateSettings.mockResolvedValue({ data: { success: true } });
    await renderCoverage();

    fireEvent.change(screen.getByDisplayValue('18.557473097373734'), { target: { value: '19.12345' } });
    fireEvent.change(screen.getByDisplayValue('73.92156518195121'), { target: { value: '74.23456' } });
    fireEvent.change(screen.getByDisplayValue('15'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        deliveryRadiusKm: 20,
        shopLocation: expect.objectContaining({ lat: 19.12345, lng: 74.23456 })
      }));
    });
    expect(toast.success).toHaveBeenCalledWith('Coverage settings updated successfully');
  });

  it('surfaces the backend rejection message when saving fails', async () => {
    updateSettings.mockRejectedValue({ response: { data: { message: 'Delivery radius must be a positive number' } } });
    await renderCoverage();

    fireEvent.click(screen.getByRole('button', { name: /Save Settings/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Delivery radius must be a positive number');
    });
  });
});