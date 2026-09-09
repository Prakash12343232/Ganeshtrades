import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import toast from 'react-hot-toast';

vi.mock('../../services/api', () => ({
  getExpenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

const { getExpenses, createExpense, updateExpense, deleteExpense } = await import('../../services/api');
const AdminExpenses = (await import('./AdminExpenses.jsx')).default;

const baseExpenses = [
  {
    _id: 'e1',
    category: 'electricity',
    amount: 1200,
    date: '2025-01-05T10:00:00.000Z',
    description: 'July bill',
    loggedBy: { _id: 'u1', name: 'Admin' }
  },
  {
    _id: 'e2',
    category: 'miscellaneous',
    amount: 150,
    date: '2025-01-06T10:00:00.000Z',
    description: 'Cleaning supplies',
    loggedBy: { _id: 'u1', name: 'Admin' }
  }
];

const pagination = { page: 1, pages: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  getExpenses.mockResolvedValue({ data: { data: baseExpenses, pagination } });
  createExpense.mockResolvedValue({ data: { data: { _id: 'e3' } } });
  updateExpense.mockResolvedValue({ data: { data: { _id: 'e1' } } });
  deleteExpense.mockResolvedValue({ data: { data: {} } });
});

describe('AdminExpenses', () => {
  it('renders expense list with edit and delete actions', async () => {
    render(<AdminExpenses />);
    expect(await screen.findByText('July bill')).toBeInTheDocument();
    expect(screen.getByText('Cleaning supplies')).toBeInTheDocument();
    expect(screen.getAllByTitle('Edit expense').length).toBeGreaterThan(0);
    expect(screen.getAllByTitle('Delete expense').length).toBeGreaterThan(0);
  });

  it('opens edit modal prefilled and submits update', async () => {
    render(<AdminExpenses />);
    await screen.findByText('July bill');
    fireEvent.click(screen.getAllByTitle('Edit expense')[0]);

    expect(screen.getByRole('heading', { name: 'Edit Expense' })).toBeInTheDocument();
    const amountInput = screen.getByLabelText('Amount (₹)');
    expect(amountInput.value).toBe('1200');
    const descInput = screen.getByLabelText('Description');
    expect(descInput.value).toBe('July bill');

    fireEvent.change(amountInput, { target: { value: '1500' } });
    fireEvent.change(descInput, { target: { value: 'July-August bill' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateExpense).toHaveBeenCalledWith('e1', {
        category: 'electricity',
        amount: '1500',
        description: 'July-August bill'
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Expense updated');
  });

  it('submits create for a new record', async () => {
    render(<AdminExpenses />);
    await screen.findByText('July bill');
    fireEvent.click(screen.getByRole('button', { name: /Record Expense/ }));

    expect(screen.getByRole('heading', { name: 'Record Expense' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'New stock' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record' }));

    await waitFor(() => {
      expect(createExpense).toHaveBeenCalledWith({
        category: 'miscellaneous',
        amount: '250',
        description: 'New stock'
      });
    });
    expect(toast.success).toHaveBeenCalledWith('Expense recorded');
  });

  it('deletes an expense after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AdminExpenses />);
    await screen.findByText('July bill');
    fireEvent.click(screen.getAllByTitle('Delete expense')[0]);

    await waitFor(() => {
      expect(deleteExpense).toHaveBeenCalledWith('e1');
    });
    expect(toast.success).toHaveBeenCalledWith('Deleted');
  });

  it('cancels the edit modal without calling the API', async () => {
    render(<AdminExpenses />);
    await screen.findByText('July bill');
    fireEvent.click(screen.getAllByTitle('Edit expense')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(updateExpense).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Edit Expense' })).not.toBeInTheDocument();
  });
});