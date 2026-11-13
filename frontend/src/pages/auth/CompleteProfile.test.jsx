import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CompleteProfile from './CompleteProfile';
import * as api from '../../services/api';
import * as AuthContext from '../../context/AuthContext';

vi.mock('../../services/api', () => ({
  completeGoogleProfile: vi.fn(),
  reverseGeocode: vi.fn(),
  geocodeAddress: vi.fn(),
  checkServiceability: vi.fn()
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

const fillAddress = () => {
  fireEvent.change(screen.getByLabelText(/House \/ Building \/ Street/i), { target: { value: '12 Market Road' } });
  fireEvent.change(screen.getByLabelText(/Area \/ Locality/i), { target: { value: 'Kothrud' } });
  fireEvent.change(screen.getByLabelText(/^City$/i), { target: { value: 'Pune' } });
  fireEvent.change(screen.getByLabelText(/^State$/i), { target: { value: 'Maharashtra' } });
  fireEvent.change(screen.getByLabelText(/Pincode/i), { target: { value: '411038' } });
};

describe('CompleteProfile', () => {
  const mockLoginUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.setItem('gt_registration_token', 'mock-registration-token');
    sessionStorage.setItem(
      'gt_pending_profile',
      JSON.stringify({ email: 'verified@gmail.com', name: 'Ravi Kumar', avatar: '' })
    );
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: null,
      loginUser: mockLoginUser
    });
  });

  it('shows the verified Google email and asks only for profile details', () => {
    render(
      <MemoryRouter>
        <CompleteProfile />
      </MemoryRouter>
    );

    expect(screen.getByTestId('verified-email')).toHaveTextContent('verified@gmail.com');
    expect(screen.getByLabelText(/Mobile Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Customer Type/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Detect My Location/i })).toHaveLength(2);
    expect(screen.queryByLabelText(/OTP/i)).not.toBeInTheDocument();
  });

  it('submits the completed profile and stores the returned session', async () => {
    vi.mocked(api.completeGoogleProfile).mockResolvedValue({
      data: {
        success: true,
        token: 'session-token',
        user: { id: 'u1', name: 'Ravi Kumar', role: 'customer', mobile: '9876543210' }
      }
    });

    render(
      <MemoryRouter>
        <CompleteProfile />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Mobile Number/i), { target: { value: '9876543210' } });
    fillAddress();
    fireEvent.click(screen.getByRole('button', { name: /Create My Ganesh Trades Account/i }));

    await waitFor(() => {
      expect(api.completeGoogleProfile).toHaveBeenCalledWith({
        registrationToken: 'mock-registration-token',
        name: 'Ravi Kumar',
        mobile: '9876543210',
        customerType: 'public',
        address: {
          street: '12 Market Road',
          area: 'Kothrud',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411038',
          lat: null,
          lng: null
        }
      });
      expect(mockLoginUser).toHaveBeenCalledWith(
        { id: 'u1', name: 'Ravi Kumar', role: 'customer', mobile: '9876543210' },
        'session-token'
      );
    });
  });

  it('rejects an invalid mobile number before calling the API', async () => {
    render(
      <MemoryRouter>
        <CompleteProfile />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Mobile Number/i), { target: { value: '12345' } });
    fillAddress();
    fireEvent.click(screen.getByRole('button', { name: /Create My Ganesh Trades Account/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/valid 10-digit Indian mobile number/i);
    });
    expect(api.completeGoogleProfile).not.toHaveBeenCalled();
  });
});
