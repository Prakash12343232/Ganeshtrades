import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getProduct, getProductReviews, createReview, updateReview, deleteReview, markReviewHelpful, getAllReviews } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { FiShoppingCart, FiMinus, FiPlus, FiStar, FiThumbsUp, FiCheckCircle, FiShield, FiTag } from 'react-icons/fi';
import ProductImage from '../../components/common/ProductImage';

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [ratingDist, setRatingDist] = useState({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [selectedImage, setSelectedImage] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewHasMore, setReviewHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [myReview, setMyReview] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { addToCart } = useCart();
  const { user } = useAuth();

  const fetchReviews = useCallback(async (page) => {
    const { data } = await getProductReviews(id, { page, limit: 10 });
    setReviews(prev => page === 1 ? (data.data || []) : [...prev, ...(data.data || [])]);
    if (data.ratingDistribution) setRatingDist(data.ratingDistribution);
    setReviewHasMore((data.pagination?.page || 1) < (data.pagination?.pages || 1));
    setReviewPage(page);
    return data;
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setReviewHasMore(false);
    setLoadingMore(false);
    getProduct(id)
      .then(pRes => {
        const prod = pRes.data.data;
        setProduct(prod);
        if (prod.images && prod.images.length > 0) {
          setSelectedImage(prod.images[0]);
        } else {
          setSelectedImage(prod.image || '');
        }
      })
      .catch(() => toast.error('Failed to load product details'))
      .finally(() => setLoading(false));
    fetchReviews(1).catch(() => {});
  }, [id, fetchReviews]);

  const fetchMyReview = useCallback(async () => {
    if (!user) {
      setMyReview(null);
      setReviewForm({ rating: 5, comment: '' });
      return;
    }
    try {
      // Normalize the user id: login response uses `id`, getMe() uses `_id`.
      const userId = user._id || user.id;
      const res = await getAllReviews({ product: id, user: userId, limit: 1 });
      const mine = res.data?.data?.[0] || null;
      setMyReview(mine);
      setReviewForm(mine ? { rating: mine.rating, comment: mine.comment || '' } : { rating: 5, comment: '' });
      setConfirmingDelete(false);
    } catch {
      setMyReview(null);
      setReviewForm({ rating: 5, comment: '' });
    }
  }, [id, user]);

  useEffect(() => {
    fetchMyReview();
  }, [fetchMyReview]);

  const handleLoadMoreReviews = async () => {
    setLoadingMore(true);
    try {
      await fetchReviews(reviewPage + 1);
    } catch {
      toast.error('Failed to load more reviews');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await createReview({ product: id, ...reviewForm });
      toast.success('Review submitted for approval!');
      await fetchReviews(1);
      await fetchMyReview();
      setReviewForm({ rating: 5, comment: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleUpdateReview = async (e) => {
    e.preventDefault();
    if (!myReview) return;
    setSubmittingReview(true);
    try {
      await updateReview(myReview._id, reviewForm);
      toast.success('Review updated! It will reappear after approval.');
      await fetchReviews(1);
      await fetchMyReview();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!myReview) return;
    setSubmittingReview(true);
    try {
      await deleteReview(myReview._id);
      toast.success('Your review has been deleted');
      setMyReview(null);
      setReviewForm({ rating: 5, comment: '' });
      setConfirmingDelete(false);
      await fetchReviews(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleHelpful = async (reviewId) => {
    try {
      await markReviewHelpful(reviewId);
      toast.success('Marked as helpful!');
      setReviews(prev => prev.map(r => r._id === reviewId ? { ...r, helpfulCount: (r.helpfulCount || 0) + 1 } : r));
    } catch {
      toast.error('Failed to update');
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-mint-400"></div></div>;
  if (!product) return <div className="text-center py-20 text-slate-400">Product not found</div>;

  const imagesList = (product.images && product.images.length > 0)
    ? product.images
    : product.image && !product.image.includes('default-product')
      ? [product.image]
      : [];

  const totalReviews = Object.values(ratingDist).reduce((a, b) => a + b, 0);

  return (
    <div className="animate-fadeIn space-y-8">
      {/* Main Product Section */}
      <div className="bg-navy-900 rounded-3xl shadow-2xl border border-navy-800 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Image & Gallery */}
          <div className="p-6 md:p-8 bg-navy-950 flex flex-col items-center justify-between border-b lg:border-b-0 lg:border-r border-navy-800/80">
            <div className="h-72 md:h-96 w-full flex items-center justify-center relative rounded-2xl overflow-hidden bg-navy-900 border border-navy-800 shadow-inner p-4">
              {product.isFeatured && (
                <span className="absolute top-3 left-3 z-10 px-3 py-1 bg-mint-500 text-navy-950 text-xs font-extrabold rounded-full shadow-md">
                  Featured
                </span>
              )}
              <ProductImage src={selectedImage || product.image} alt={product.name} />
            </div>

            {/* Gallery Thumbnails */}
            {imagesList.length > 1 && (
              <div className="flex items-center gap-3 mt-4 overflow-x-auto pb-2 w-full justify-center">
                {imagesList.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`w-16 h-16 rounded-xl border-2 overflow-hidden bg-navy-900 p-1 transition-all flex-shrink-0 ${
                      selectedImage === img ? 'border-mint-400 shadow-md scale-105' : 'border-navy-700 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <ProductImage src={img} alt="" showFallbackLabel={false} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="p-6 md:p-10 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-mint-400 bg-mint-500/10 border border-mint-500/30 px-3 py-1 rounded-full capitalize">
                  {product.category?.replace(/_/g, ' ')}
                </span>
                {product.brand && (
                  <span className="text-xs font-medium text-slate-300 bg-navy-800 px-3 py-1 rounded-full border border-navy-700 flex items-center gap-1">
                    <FiTag className="text-mint-400" /> {product.brand}
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-white mt-3">{product.name}</h1>
              <p className="text-slate-400 mt-3 text-sm leading-relaxed">{product.description || 'No detailed description available.'}</p>

              {/* Rating summary */}
              {product.avgRating > 0 && (
                <div className="flex items-center gap-2 mt-4">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((_, i) => (
                      <FiStar key={i} className={`w-4 h-4 ${i < Math.round(product.avgRating) ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-slate-200">{product.avgRating}</span>
                  <span className="text-sm text-slate-400">({product.reviewCount || reviews.length} reviews)</span>
                </div>
              )}

              {/* Price Display */}
              <div className="mt-6 p-4 bg-navy-950/80 rounded-2xl border border-navy-800">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-mint-400">₹{product.price}</span>
                  <span className="text-slate-400 text-sm">/ {product.unit}</span>
                </div>
                {product.wholesalePrice && (
                  <p className="text-xs font-semibold text-mint-300 mt-1">
                    🏷️ Wholesale Price: ₹{product.wholesalePrice} / {product.unit} for bulk buyers
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {/* Quantity selector & Add to Cart */}
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-navy-700 rounded-xl overflow-hidden bg-navy-950">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3 hover:bg-navy-800 text-slate-200"><FiMinus /></button>
                  <span className="px-5 font-bold text-white text-base">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="p-3 hover:bg-navy-800 text-slate-200"><FiPlus /></button>
                </div>

                <button
                  onClick={() => addToCart(product, quantity)}
                  disabled={product.stock === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-mint-500 text-navy-950 rounded-xl font-extrabold hover:bg-mint-400 transition-all disabled:opacity-40 shadow-lg shadow-mint-500/20"
                  id="add-to-cart-btn"
                >
                  <FiShoppingCart className="w-5 h-5" /> {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>
              </div>

              {/* Stock availability status */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-navy-800">
                <span>
                  Status:{' '}
                  <strong className={product.stock > product.minStock ? 'text-mint-400' : product.stock > 0 ? 'text-amber-400' : 'text-rose-400'}>
                    {product.stock > product.minStock ? `In Stock (${product.stock} ${product.unit} available)` : product.stock > 0 ? `Low Stock (${product.stock} left)` : 'Out of Stock'}
                  </strong>
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <FiShield className="text-mint-400" /> 100% Genuine Guaranteed
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews & Ratings Section */}
      <div className="bg-navy-900 rounded-3xl shadow-2xl border border-navy-800 p-6 md:p-8 space-y-6">
        <h2 className="text-xl font-bold text-white">Customer Reviews & Ratings</h2>

        {/* Rating Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-navy-950 p-6 rounded-2xl border border-navy-800">
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-5xl font-extrabold text-white">{product.avgRating || '0.0'}</span>
            <div className="flex my-2">
              {[1, 2, 3, 4, 5].map((_, i) => (
                <FiStar key={i} className={`w-4 h-4 ${i < Math.round(product.avgRating || 0) ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`} />
              ))}
            </div>
            <span className="text-xs text-slate-400">Based on {totalReviews} rating(s)</span>
          </div>

          {/* Rating Bars */}
          <div className="md:col-span-2 space-y-2 flex flex-col justify-center">
            {[5, 4, 3, 2, 1].map(stars => {
              const count = ratingDist[stars] || 0;
              const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
              return (
                <div key={stars} className="flex items-center gap-3 text-xs">
                  <span className="w-8 font-semibold text-slate-300">{stars} ★</span>
                  <div className="flex-1 h-2 bg-navy-800 rounded-full overflow-hidden">
                    <div className="h-full bg-mint-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-slate-400 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* My Review / Add Review Form */}
        {user ? (
          myReview ? (
            <form onSubmit={handleUpdateReview} className="p-6 bg-navy-950 rounded-2xl border border-amber-500/30 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-bold text-white">Your Review</h3>
                <span className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize ${myReview.status === 'approved' ? 'bg-mint-500/20 text-mint-300 border border-mint-500/30' : myReview.status === 'rejected' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                  {myReview.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {myReview.status === 'pending'
                  ? 'Your review is awaiting approval and will appear once moderated.'
                  : myReview.status === 'rejected'
                    ? 'Your previous review was rejected by the seller. Edit it below to resubmit for approval.'
                    : 'You have already reviewed this product. Update or delete it below.'}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-300">Your Rating:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReviewForm(p => ({ ...p, rating: s }))}
                      className={`text-2xl transition-all ${s <= reviewForm.rating ? 'text-amber-400 scale-110' : 'text-slate-600 hover:text-amber-200'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={reviewForm.comment}
                onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))}
                className="w-full p-3.5 border border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-mint-500 bg-navy-900 text-slate-100 placeholder-slate-500"
                placeholder="Update your experience with this product..."
                rows={3}
                required
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="px-6 py-2.5 bg-mint-500 text-navy-950 rounded-xl text-sm font-bold hover:bg-mint-400 transition-all disabled:opacity-50 shadow-md shadow-mint-500/20"
                  id="update-review-btn"
                >
                  {submittingReview ? 'Saving...' : 'Update Review'}
                </button>
                {confirmingDelete ? (
                  <>
                    <button
                      type="button"
                      onClick={handleDeleteReview}
                      disabled={submittingReview}
                      className="px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-500 transition-all disabled:opacity-50"
                    >
                      Yes, Delete Review
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="px-4 py-2.5 bg-navy-800 border border-navy-700 text-slate-300 rounded-xl text-sm font-medium hover:bg-navy-700 transition-all"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="px-4 py-2.5 bg-navy-900 border border-rose-500/40 text-rose-400 rounded-xl text-sm font-medium hover:bg-rose-500/10 transition-all"
                    id="delete-review-btn"
                  >
                    Delete Review
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">Note: Updated reviews are re-moderated before appearing publicly.</p>
            </form>
          ) : (
            <form onSubmit={handleReview} className="p-6 bg-navy-950 rounded-2xl border border-navy-800 space-y-4">
              <h3 className="text-sm font-bold text-white">Write a Review</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-300">Your Rating:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReviewForm(p => ({ ...p, rating: s }))}
                      className={`text-2xl transition-all ${s <= reviewForm.rating ? 'text-amber-400 scale-110' : 'text-slate-600 hover:text-amber-200'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={reviewForm.comment}
                onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))}
                className="w-full p-3.5 border border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-mint-500 bg-navy-900 text-slate-100 placeholder-slate-500"
                placeholder="Share your experience with this product (quality, freshness, packaging...)"
                rows={3}
                required
              />
              <button
                type="submit"
                disabled={submittingReview}
                className="px-6 py-2.5 bg-mint-500 text-navy-950 rounded-xl text-sm font-bold hover:bg-mint-400 transition-all disabled:opacity-50 shadow-md shadow-mint-500/20"
                id="submit-review-btn"
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
              <p className="text-[11px] text-slate-500">Note: Reviews are moderated before appearing publicly.</p>
            </form>
          )
        ) : (
          <div className="p-4 bg-navy-950 rounded-xl text-center text-sm text-slate-400 border border-navy-800">
            Please log in to write a review for this product.
          </div>
        )}

        {/* Reviews List */}
        <div className="space-y-4 pt-2">
          {reviews.length === 0 ? (
            <p className="text-slate-400 text-center py-6">No approved reviews yet for this product.</p>
          ) : (
            <>
              {reviews.map(review => (
                <div key={review._id} className="p-5 bg-navy-950 rounded-2xl border border-navy-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-mint-500/10 border border-mint-500/30 text-mint-400 rounded-full flex items-center justify-center font-bold text-sm">
                        {review.user?.name?.[0] || 'U'}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-white">{review.user?.name || 'Customer'}</h4>
                        <p className="text-[11px] text-slate-400">{new Date(review.createdAt).toLocaleDateString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={`text-sm ${i < review.rating ? 'text-amber-400' : 'text-slate-700'}`}>★</span>
                      ))}
                    </div>
                  </div>

                  <p className="text-sm text-slate-300 pl-12">{review.comment}</p>

                  {/* Admin Response */}
                  {review.adminResponse && (
                    <div className="ml-12 p-3 bg-navy-900 rounded-xl border border-mint-500/20 text-xs space-y-1">
                      <span className="font-semibold text-mint-400 flex items-center gap-1">
                        <FiCheckCircle className="text-mint-400" /> Seller Response
                      </span>
                      <p className="text-slate-300">{review.adminResponse}</p>
                    </div>
                  )}

                  {/* Helpful Button — requires login; the backend endpoint is protect-guarded */}
                  {user && (
                    <div className="flex justify-end pr-2">
                      <button
                        onClick={() => handleHelpful(review._id)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-mint-400 font-medium transition-colors"
                      >
                        <FiThumbsUp /> Helpful ({review.helpfulCount || 0})
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {reviewHasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={handleLoadMoreReviews}
                    disabled={loadingMore}
                    className="px-6 py-2.5 bg-navy-900 border border-mint-500/40 text-mint-400 rounded-xl text-sm font-semibold hover:bg-mint-500/10 disabled:opacity-50 transition-all"
                    id="load-more-reviews"
                  >
                    {loadingMore ? 'Loading...' : 'Load More Reviews'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
