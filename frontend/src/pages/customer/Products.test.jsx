import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';

const { routerMocks, cartMocks } = vi.hoisted(() => ({
  routerMocks: {
    searchParams: new URLSearchParams(''),
    setSearchParams: vi.fn()
  },
  cartMocks: {
    addToCart: vi.fn()
  }
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={typeof to === 'string' ? to : '#'}>{children}</a>,
  useSearchParams: () => [routerMocks.searchParams, routerMocks.setSearchParams]
}));

vi.mock('../../services/api', () => ({
  getProducts: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

vi.mock('../../context/CartContext', () => ({
  useCart: () => ({ addToCart: cartMocks.addToCart })
}));

const { getProducts } = await import('../../services/api');
const toast = (await import('react-hot-toast')).default;
const Products = (await import('./Products.jsx')).default;

const product = (id, overrides = {}) => ({
  _id: id,
  name: `Product ${id}`,
  category: 'rice_grains',
  brand: 'India Gate',
  price: 120,
  unit: 'kg',
  stock: 50,
  minStock: 10,
  avgRating: 0,
  image: '',
  ...overrides
});

const resolvePage = (items, total = items.length) => ({
  data: {
    data: items,
    pagination: { total, page: 1, pages: Math.max(1, Math.ceil(total / 16)) }
  }
});

describe('Products catalog page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routerMocks.searchParams = new URLSearchParams('');
    routerMocks.setSearchParams.mockReset();
    cartMocks.addToCart.mockReset();
    getProducts.mockResolvedValue(resolvePage([product('p1'), product('p2')]));
  });

  it('renders the products returned by the API with price, stock badge and count', async () => {
    render(<Products />);
    expect(await screen.findByText('Product p1')).toBeInTheDocument();
    expect(screen.getByText('Product p2')).toBeInTheDocument();
    expect(screen.getByText('2 products available')).toBeInTheDocument();
    expect(screen.getAllByTestId('product-card')).toHaveLength(2);
    expect(screen.getAllByText('✓ In Stock')).toHaveLength(2);
  });

  it('shows the loading skeleton grid while the request is in flight', () => {
    getProducts.mockReturnValue(new Promise(() => {}));
    render(<Products />);
    expect(screen.getAllByTestId('product-skeleton')).toHaveLength(8);
  });

  it('shows the empty state when no products match the criteria', async () => {
    getProducts.mockResolvedValue(resolvePage([]));
    render(<Products />);
    expect(await screen.findByText('No products match your criteria')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters or search term')).toBeInTheDocument();
  });

  it('shows an error toast and the empty state when the API request fails', async () => {
    getProducts.mockRejectedValue(new Error('network down'));
    render(<Products />);
    expect(await screen.findByText('No products match your criteria')).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Failed to load products');
  });

  it('submits the search box on Enter and refetches with the search term', async () => {
    render(<Products />);
    await screen.findByText('Product p1');
    fireEvent.change(screen.getByPlaceholderText('Search by name, brand, description...'), { target: { value: 'rice' } });
    fireEvent.submit(screen.getByPlaceholderText('Search by name, brand, description...').closest('form'));
    await waitFor(() => {
      expect(getProducts.mock.calls.at(-1)[0].search).toBe('rice');
    });
  });

  it('does not fire an API request while the live search is still debouncing, then refetches after 400ms', async () => {
    render(<Products />);
    await screen.findByText('Product p1');
    expect(getProducts.mock.calls.at(-1)[0]).not.toHaveProperty('search');
    fireEvent.change(screen.getByPlaceholderText('Search by name, brand, description...'), { target: { value: 'rice' } });
    expect(getProducts.mock.calls.at(-1)[0]).not.toHaveProperty('search');
    await new Promise((r) => setTimeout(r, 500));
    await waitFor(() => {
      expect(getProducts.mock.calls.at(-1)[0].search).toBe('rice');
    });
  });

  it('initializes filters from URL search params and passes them to the API', async () => {
    routerMocks.searchParams = new URLSearchParams('category=spices&sort=price');
    render(<Products />);
    await screen.findByText('Product p1');
    await waitFor(() => {
      expect(getProducts.mock.calls.at(-1)[0]).toMatchObject({ category: 'spices', sort: 'price', page: 1, limit: 16 });
    });
  });

  it('applies the quick category pill filter with an active-filter badge', async () => {
    render(<Products />);
    await screen.findByText('Product p1');
    fireEvent.click(screen.getByRole('button', { name: /Rice & Grains/ }));
    await waitFor(() => {
      expect(getProducts.mock.calls.at(-1)[0].category).toBe('rice_grains');
    });
    expect(screen.getByRole('button', { name: /^Filters/ })).toHaveTextContent('1');
  });

  it('applies every panel filter (price/rating/availability/sort) to the API call', async () => {
    render(<Products />);
    await screen.findByText('Product p1');
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    const [categorySel, minRatingSel, availSel, sortSel] = screen.getAllByRole('combobox');
    fireEvent.change(categorySel, { target: { value: 'spices' } });
    fireEvent.change(screen.getByPlaceholderText('Min'), { target: { value: '50' } });
    fireEvent.change(screen.getByPlaceholderText('Max'), { target: { value: '500' } });
    fireEvent.change(minRatingSel, { target: { value: '4' } });
    fireEvent.change(availSel, { target: { value: 'in_stock' } });
    fireEvent.change(sortSel, { target: { value: 'price' } });
    await waitFor(() => {
      expect(getProducts.mock.calls.at(-1)[0]).toMatchObject({
        category: 'spices',
        minPrice: '50',
        maxPrice: '500',
        minRating: '4',
        availability: 'in_stock',
        sort: 'price',
        page: 1,
        limit: 16
      });
    });
    expect(screen.getByRole('button', { name: /^Filters/ })).toHaveTextContent('5');
  });

  it('clear-all-filters resets every filter and refetches the unfiltered catalog', async () => {
    render(<Products />);
    await screen.findByText('Product p1');
    fireEvent.click(screen.getByRole('button', { name: /Rice & Grains/ }));
    await waitFor(() => {
      expect(getProducts.mock.calls.at(-1)[0].category).toBe('rice_grains');
    });
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    await waitFor(() => {
      expect(getProducts.mock.calls.at(-1)[0]).not.toHaveProperty('category');
    });
    expect(routerMocks.setSearchParams).toHaveBeenCalledWith({});
  });

  it('renders pagination controls and fetches the requested page on click', async () => {
    getProducts.mockResolvedValue(resolvePage([product('p1'), product('p2'), product('p3')], 32));
    render(<Products />);
    await screen.findByText('Product p1');
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => {
      expect(getProducts.mock.calls.at(-1)[0].page).toBe(2);
    });
  });

  it('adds a product to the cart from its card and disables the button when out of stock', async () => {
    getProducts.mockResolvedValue(resolvePage([product('p1'), product('p2', { stock: 0 })]));
    render(<Products />);
    const cards = await screen.findAllByTestId('product-card');
    const inStockCard = within(cards[0]).getByRole('button');
    fireEvent.click(inStockCard);
    expect(cartMocks.addToCart).toHaveBeenCalledWith(expect.objectContaining({ _id: 'p1' }));
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
    expect(within(cards[1]).getByRole('button')).toBeDisabled();
  });
});