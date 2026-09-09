import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn()
}));

vi.mock('../../services/api', () => ({
  forgotPassword: vi.fn(),
  verifyOtp: vi.fn(),
  resetPassword: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

const { forgotPassword, verifyOtp, resetPassword } = await import('../../services/api');
const ForgotPassword = (await import('./ForgotPassword.jsx')).default;

const OTP_INPUT_PLACEHOLDER = '------';

async function startReset() {
  render(<ForgotPassword />);
  fireEvent.change(screen.getByPlaceholderText('10-digit mobile'), { target: { value: '9876543210' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send OTP' }));
  await waitFor(() => {
    expect(forgotPassword).toHaveBeenCalledWith({ mobile: '9876543210' });
  });
}

describe('ForgotPassword OTP verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forgotPassword.mockResolvedValue({ data: { success: true } });
    verifyOtp.mockResolvedValue({ data: { success: true } });
    resetPassword.mockResolvedValue({ data: { success: true } });
  });

  it('advances to the password step only after the backend verifies the OTP', async () => {
    await startReset();

    fireEvent.change(screen.getByPlaceholderText(OTP_INPUT_PLACEHOLDER), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));

    await waitFor(() => {
      expect(verifyOtp).toHaveBeenCalledWith({ mobile: '9876543210', otp: '123456', purpose: 'password_reset' });
    });
    expect(screen.getByText('Create a strong new password')).toBeInTheDocument();
  });

  it('does not advance and shows the backend error when verification fails', async () => {
    verifyOtp.mockRejectedValue({ response: { data: { message: 'Incorrect OTP' } } });
    await startReset();

    fireEvent.change(screen.getByPlaceholderText(OTP_INPUT_PLACEHOLDER), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Incorrect OTP');
    });
    expect(screen.queryByText('Create a strong new password')).not.toBeInTheDocument();
  });

  it('does not call the backend for an incomplete OTP', async () => {
    await startReset();

    fireEvent.change(screen.getByPlaceholderText(OTP_INPUT_PLACEHOLDER), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify OTP' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Enter 6-digit OTP');
    });
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});