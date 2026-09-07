import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'p1' }),
  Link: ({ children }) => children
}));

vi.mock('../../services/api', () => ({
  getProduct: vi.fn(),
  getProductReviews: vi.fn(),
  createReview: vi.fn(),
  markReviewHelpful: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

vi.mock('../../context/CartContext', () => ({
  useCart: () => ({ addToCart: vi.fn() })
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: null })
}));

const { getProduct, getProductReviews } = await import('../../services/api');
const ProductDetail = (await import('./ProductDetail.jsx')).default;

const baseProduct = {
  _id: 'p1',
  name: 'Basmati Rice',
  category: 'rice_grains',
  brand: 'India Gate',
  price: 120,
  unit: 'kg',
  stock: 50,
  minStock: 10,
  description: 'Premium basmati rice',
  image: 'rice.jpg',
  images: ['rice.jpg'],
  avgRating: 4,
  reviewCount: 21
};

const review = (id, name, comment, rating = 5, createdAt = '2025-01-01T10:00:00.000Z') => ({
  _id: id,
  user: { name },
  comment,
  rating,
  helpfulCount: 0,
  createdAt
});

describe('ProductDetail Reviews Pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProduct.mockResolvedValue({ data: { data: baseProduct } });
    getProductReviews.mockResolvedValue({
      data: {
        data: [review('r1', 'Ravi Kumar', 'Great rice!')],
        ratingDistribution: { 5: 21, 4: 0, 3: 0, 2: 0, 1: 0 },
        pagination: { total: 21, page: 1, pages: 3 }
      }
    });
  });

  it('shows a Load More Reviews button when a product has more than one page of reviews', async () => {
    render(<ProductDetail />);
    await screen.findByText('Great rice!');
    expect(screen.getByRole('button', { name: 'Load More Reviews' })).toBeInTheDocument();
    expect(getProductReviews).toHaveBeenCalledWith('p1', { page: 1, limit: 10 });
  });

  it('appends the next page of reviews when Load More is clicked and hides the button on the last page', async () => {
    getProductReviews.mockImplementation((_id, params) => {
      if (params.page === 2) {
        return Promise.resolve({
          data: {
            data: [review('r2', 'Sita Devi', 'Fresh and fragrant!')],
            ratingDistribution: { 5: 21, 4: 0, 3: 0, 2: 0, 1: 0 },
            pagination: { total: 21, page: 2, pages: 3 }
          }
        });
      }
      return Promise.resolve({
        data: {
          data: [review('r1', 'Ravi Kumar', 'Great rice!')],
          ratingDistribution: { 5: 21, 4: 0, 3: 0, 2: 0, 1: 0 },
          pagination: { total: 21, page: 1, pages: 3 }
        }
      });
    });

    render(<ProductDetail />);
    await screen.findByText('Great rice!');
    fireEvent.click(screen.getByRole('button', { name: 'Load More Reviews' }));

    await screen.findByText('Fresh and fragrant!');
    expect(screen.getByText('Great rice!')).toBeInTheDocument();
    expect(getProductReviews).toHaveBeenCalledWith('p1', { page: 2, limit: 10 });
  });

  it('omits the Load More button when all reviews fit on one page', async () => {
    getProductReviews.mockResolvedValue({
      data: {
        data: [review('r1', 'Ravi Kumar', 'Great rice!')],
        ratingDistribution: { 5: 1, 4: 0, 3: 0, 2: 0, 1: 0 },
        pagination: { total: 1, page: 1, pages: 1 }
      }
    });

    render(<ProductDetail />);
    await screen.findByText('Great rice!');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Load More Reviews' })).not.toBeInTheDocument();
    });
  });
});