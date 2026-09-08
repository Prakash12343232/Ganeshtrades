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
  updateReview: vi.fn(),
  deleteReview: vi.fn(),
  markReviewHelpful: vi.fn(),
  getAllReviews: vi.fn()
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() }
}));

vi.mock('../../context/CartContext', () => ({
  useCart: () => ({ addToCart: vi.fn() })
}));

const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

const { getProduct, getProductReviews, getAllReviews, updateReview, deleteReview, createReview, markReviewHelpful } = await import('../../services/api');
const toast = (await import('react-hot-toast')).default;
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

const myReviewRecord = {
  _id: 'r-me',
  user: { _id: 'u1', name: 'Test User' },
  comment: 'My initial review',
  rating: 4,
  status: 'approved',
  helpfulCount: 0,
  createdAt: '2025-01-02T10:00:00.000Z'
};

const defaultReviewPage = {
  data: {
    data: [review('r1', 'Ravi Kumar', 'Great rice!')],
    ratingDistribution: { 5: 21, 4: 0, 3: 0, 2: 0, 1: 0 },
    pagination: { total: 21, page: 1, pages: 3 }
  }
};

describe('ProductDetail Reviews Pagination', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseAuth.mockReturnValue({ user: null });
    getProduct.mockResolvedValue({ data: { data: baseProduct } });
    getProductReviews.mockResolvedValue(defaultReviewPage);
  });

  it('shows a Load More Reviews button when a product has more than one page of reviews', async () => {
    render(<ProductDetail />);
    await screen.findByText('Great rice!');
    expect(screen.getByRole('button', { name: 'Load More Reviews' })).toBeInTheDocument();
    expect(getProductReviews).toHaveBeenCalledWith('p1', { page: 1, limit: 10 });
  });

  it('omits the Helpful button for logged-out guests', async () => {
    render(<ProductDetail />);
    await screen.findByText('Great rice!');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Helpful/ })).not.toBeInTheDocument();
    });
    expect(markReviewHelpful).not.toHaveBeenCalled();
  });

  it('shows the Helpful button for logged-in users and uses a normalized user id for the my-review lookup', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 'u1', name: 'Test User' } });
    getAllReviews.mockResolvedValue({ data: { data: [] } });
    render(<ProductDetail />);
    expect(await screen.findByRole('button', { name: /Helpful/ })).toBeInTheDocument();
    expect(getAllReviews).toHaveBeenCalledWith({ product: 'p1', user: 'u1', limit: 1 });
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

describe('ProductDetail Review Edit/Delete', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseAuth.mockReturnValue({ user: { _id: 'u1', name: 'Test User' } });
    getProduct.mockResolvedValue({ data: { data: baseProduct } });
    getProductReviews.mockResolvedValue(defaultReviewPage);
    getAllReviews.mockResolvedValue({ data: { data: [myReviewRecord] } });
  });

  it('screens the user\'s existing review into an edit panel instead of the create form', async () => {
    render(<ProductDetail />);
    const updateBtn = await screen.findByRole('button', { name: 'Update Review' });
    expect(updateBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit Review' })).not.toBeInTheDocument();
    expect(screen.getByText('You have already reviewed this product. Update or delete it below.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('My initial review')).toBeInTheDocument();
    expect(getAllReviews).toHaveBeenCalledWith({ product: 'p1', user: 'u1', limit: 1 });
  });

  it('surfaces the create form when a logged-in user has not reviewed yet', async () => {
    getAllReviews.mockResolvedValue({ data: { data: [] } });
    render(<ProductDetail />);
    expect(await screen.findByRole('button', { name: 'Submit Review' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update Review' })).not.toBeInTheDocument();
  });

  it('updates the review via PUT when Update Review is clicked and reverts to awaiting-approval state', async () => {
    getAllReviews
      .mockResolvedValueOnce({ data: { data: [myReviewRecord] } })
      .mockResolvedValueOnce({ data: { data: [{ ...myReviewRecord, status: 'pending', comment: 'Updated comment', rating: 5 }] } });
    updateReview.mockResolvedValue({ data: { success: true } });

    render(<ProductDetail />);
    const textarea = await screen.findByDisplayValue('My initial review');
    fireEvent.change(textarea, { target: { value: 'Updated comment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Review' }));

    expect(await screen.findByText('Your review is awaiting approval and will appear once moderated.')).toBeInTheDocument();
    expect(updateReview).toHaveBeenCalledWith('r-me', { rating: 4, comment: 'Updated comment' });
    expect(toast.success).toHaveBeenCalledWith('Review updated! It will reappear after approval.');
  });

  it('deletes the review after the inline confirm and restores the create form', async () => {
    getAllReviews
      .mockResolvedValueOnce({ data: { data: [myReviewRecord] } })
      .mockResolvedValueOnce({ data: { data: [] } });
    deleteReview.mockResolvedValue({ data: { success: true } });

    render(<ProductDetail />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Review' }));

    const confirmBtn = await screen.findByRole('button', { name: 'Yes, Delete Review' });
    expect(confirmBtn).toBeInTheDocument();

    fireEvent.click(confirmBtn);
    expect(await screen.findByRole('button', { name: 'Submit Review' })).toBeInTheDocument();
    expect(deleteReview).toHaveBeenCalledWith('r-me');
  });

  it('switches to the edit panel after a fresh review is submitted', async () => {
    getAllReviews
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({ data: { data: [{ ...myReviewRecord, status: 'pending' }] } });
    createReview.mockResolvedValue({ data: { success: true } });

    render(<ProductDetail />);
    const createForm = (await screen.findByRole('button', { name: 'Submit Review' })).closest('form');
    fireEvent.change(screen.getByPlaceholderText(/Share your experience/), { target: { value: 'Nice rice' } });
    fireEvent.submit(createForm);

    await waitFor(() => expect(createReview).toHaveBeenCalled());
    expect(createReview).toHaveBeenCalledWith({ product: 'p1', rating: 5, comment: 'Nice rice' });
    expect(await screen.findByRole('button', { name: 'Update Review' })).toBeInTheDocument();
  });
});