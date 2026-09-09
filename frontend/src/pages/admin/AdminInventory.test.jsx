import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import toast from 'react-hot-toast';

vi.mock('../../services/api', () => ({
  getLowStock: vi.fn(),
  getProducts: vi.fn(),
  updateStock: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

vi.mock('../../components/common/ProductImage', () => ({
  __esModule: true,
  default: () => null
}));

const { getLowStock, getProducts, updateStock } = await import('../../services/api');
const AdminInventory = (await import('./AdminInventory.jsx')).default;

const lowStockItems = [
  { _id: 'p1', name: 'Rice', category: 'rice_grains', price: 70, unit: 'kg', stock: 2, minStock: 10, image: '' },
  { _id: 'p2', name: 'Oil', category: 'oil_ghee', price: 150, unit: 'kg', stock: 0, minStock: 5, image: '' }
];

const allProducts = [
  ...lowStockItems,
  { _id: 'p3', name: 'Sugar', category: 'sugar_jaggery', price: 45, unit: 'kg', stock: 100, minStock: 20, image: '' }
];

beforeEach(() => {
  vi.clearAllMocks();
  getLowStock.mockResolvedValue({ data: { data: lowStockItems } });
  getProducts.mockResolvedValue({ data: { data: allProducts, pagination: { total: 3, page: 1, pages: 1 } } });
  updateStock.mockResolvedValue({ data: { data: {} } });
});

describe('AdminInventory', () => {
  it('shows low-stock alerts and the full product table', async () => {
    render(<AdminInventory />);
    expect(await screen.findByText('2 products need restocking')).toBeInTheDocument();
    expect(screen.getByText('All Products')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Sugar')).toBeInTheDocument());
    expect(screen.getAllByText('Rice').length).toBeGreaterThan(0);
  });

  it('calls updateStock with set action and exact amount', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AdminInventory />);
    await screen.findByText('2 products need restocking');
    await waitFor(() => expect(screen.getByText('Sugar')).toBeInTheDocument());

    const sugarRow = screen.getByText('Sugar').closest('tr');
    const input = sugarRow.querySelector('input[type="number"]');
    fireEvent.change(input, { target: { value: '150' } });
    const setBtn = Array.from(sugarRow.querySelectorAll('button')).find(b => b.textContent === 'Set');
    fireEvent.click(setBtn);

    await waitFor(() => {
      expect(updateStock).toHaveBeenCalledWith('p3', { stock: 150, action: 'set' });
    });
    expect(toast.success).toHaveBeenCalledWith('Stock updated');
  });

  it('calls updateStock with subtract action', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AdminInventory />);
    await screen.findByText('2 products need restocking');
    await waitFor(() => expect(screen.getByText('Sugar')).toBeInTheDocument());

    const sugarRow = screen.getByText('Sugar').closest('tr');
    const input = sugarRow.querySelector('input[type="number"]');
    fireEvent.change(input, { target: { value: '25' } });

    const buttons = Array.from(sugarRow.querySelectorAll('button'));
    const subtract = buttons.find(b => b.textContent === 'Subtract');
    fireEvent.click(subtract);

    await waitFor(() => {
      expect(updateStock).toHaveBeenCalledWith('p3', { stock: 25, action: 'subtract' });
    });
  });

  it('fast-add buttons add without a quantity input', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AdminInventory />);
    await screen.findByText('2 products need restocking');

    fireEvent.click(screen.getAllByText('+50')[0]);

    await waitFor(() => {
      expect(updateStock).toHaveBeenCalledWith('p1', { stock: 50, action: 'add' });
    });
    expect(toast.success).toHaveBeenCalledWith('Stock updated');
  });

  it('rejects an update when confirm is dismissed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AdminInventory />);
    await screen.findByText('2 products need restocking');
    await waitFor(() => expect(screen.getByText('Sugar')).toBeInTheDocument());

    const sugarRow = screen.getByText('Sugar').closest('tr');
    const input = sugarRow.querySelector('input[type="number"]');
    fireEvent.change(input, { target: { value: '150' } });
    const setBtn = Array.from(sugarRow.querySelectorAll('button')).find(b => b.textContent === 'Set');
    fireEvent.click(setBtn);

    expect(updateStock).not.toHaveBeenCalled();
  });
});