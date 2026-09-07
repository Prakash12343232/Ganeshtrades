import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../services/api', () => ({
  getProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

const { getProducts } = await import('../../services/api');
const AdminProducts = (await import('./AdminProducts.jsx')).default;

const products = [
  { _id: 'p1', name: 'Royal Basmati Rice', brand: 'Kohinoor', category: 'rice_grains', price: 120, unit: 'kg', wholesalePrice: 100, stock: 50, minStock: 10, status: 'active', image: '' },
  { _id: 'p2', name: 'Toor Dal', brand: 'Tata', category: 'dal_pulses', price: 90, unit: 'kg', wholesalePrice: 80, stock: 8, minStock: 10, status: 'out_of_stock', image: '' },
  { _id: 'p3', name: 'Sunflower Oil', brand: 'Fortune', category: 'oil_ghee', price: 150, unit: 'l', wholesalePrice: 140, stock: 20, minStock: 5, status: 'inactive', image: '' }
];

describe('AdminProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProducts.mockResolvedValue({ data: { data: products, pagination: { total: products.length, page: 1, pages: 1 } } });
  });

  it('loads the catalog with explicit status:all paginated params', async () => {
    render(<AdminProducts />);
    await screen.findByText('Royal Basmati Rice');

    expect(getProducts).toHaveBeenCalledWith({ page: 1, limit: 20, status: 'all' });
    expect(screen.getByText('Toor Dal')).toBeInTheDocument();
  });

  it('shows the total product count from the pagination object', async () => {
    render(<AdminProducts />);
    await screen.findByText('Royal Basmati Rice');

    expect(screen.getByText('3 total products')).toBeInTheDocument();
  });

  it('fetches page 2 with limit 20 when a pager page is clicked', async () => {
    getProducts
      .mockResolvedValueOnce({ data: { data: products, pagination: { total: 45, page: 1, pages: 3 } } })
      .mockResolvedValue({ data: { data: products, pagination: { total: 45, page: 2, pages: 3 } } });

    render(<AdminProducts />);
    await screen.findByText('Royal Basmati Rice');

    fireEvent.click(screen.getAllByRole('button', { name: '2' })[0]);

    await waitFor(() => {
      expect(getProducts).toHaveBeenLastCalledWith({ page: 2, limit: 20, status: 'all' });
    });
  });

  it('applies the search and category filters to the getProducts request and resets to page 1', async () => {
    render(<AdminProducts />);
    await screen.findByText('Royal Basmati Rice');

    fireEvent.change(screen.getByPlaceholderText('Search by name, brand...'), { target: { value: 'Basmati' } });

    await waitFor(() => {
      expect(getProducts).toHaveBeenLastCalledWith({ page: 1, limit: 20, status: 'all', search: 'Basmati' });
    });

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'rice_grains' } });

    await waitFor(() => {
      expect(getProducts).toHaveBeenLastCalledWith({
        page: 1, limit: 20, status: 'all', search: 'Basmati', category: 'rice_grains'
      });
    });
  });
});