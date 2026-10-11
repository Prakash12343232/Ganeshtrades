import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import * as api from '../../services/api';
import * as AuthContext from '../../context/AuthContext';

vi.mock('../../services/api', () => ({
  login: vi.fn(),
  getGoogleConfig: vi.fn().mockResolvedValue({ data: { configured: true, clientId: 'mock-client-id' } })
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

describe('Login Component (Google Sign-In & Password)', () => {
  const mockLoginUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: null,
      loginUser: mockLoginUser
    });
  });

  it('renders Google sign-in button and does not render obsolete SMS OTP tab', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    // Google Sign-In button is displayed
    expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();

    // Obsolete OTP tab is removed
    expect(screen.queryByRole('button', { name: /^OTP$/i })).not.toBeInTheDocument();

    // Password login controls remain available
    expect(screen.getByPlaceholderText(/10-digit mobile/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In with Password/i })).toBeInTheDocument();
  });

  it('submits mobile and password login with useOtp: false', async () => {
    vi.mocked(api.login).mockResolvedValue({
      data: {
        success: true,
        token: 'mock-jwt-token',
        user: { id: 'u1', name: 'Test User', role: 'customer' }
      }
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/10-digit mobile/i), {
      target: { value: '9876543210' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter password/i), {
      target: { value: 'Password@123' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign In with Password/i }));

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith({
        mobile: '9876543210',
        password: 'Password@123',
        useOtp: false
      });
      expect(mockLoginUser).toHaveBeenCalledWith(
        { id: 'u1', name: 'Test User', role: 'customer' },
        'mock-jwt-token'
      );
    });
  });
});
