import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getProduct, getProductReviews, createReview, markReviewHelpful } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { FiShoppingCart, FiMinus, FiPlus, FiStar, FiThumbsUp, FiCheckCircle, FiShield, FiTag } from 'react-icons/fi';
import ProductImage from '../../components/common/ProductImage';

const CATEGORY_LABELS = {
  rice_grains: '🍚 Rice & Grains', dal_pulses: '🫘 Dal & Pulses', spices: '🌶️ Spices',
  oil_ghee: '🫒 Oil & Ghee', flour: '🌾 Flour', sugar_jaggery: '🍬 Sugar & Jaggery',
  tea_coffee: '☕ Tea & Coffee', snacks: '🍿 Snacks', beverages: '🥤 Beverages',
  dairy: '🥛 Dairy', dry_fruits: '🥜 Dry Fruits', cleaning: '🧹 Cleaning',
  personal_care: '🧴 Personal Care', packaged_food: '📦 Packaged Food', other: '📋 Other'
};

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
  const { addToCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([getProduct(id), getProductReviews(id)])
      .then(([pRes, rRes]) => {
        setProduct(pRes.data.data);
        if (pRes.data.data.images && pRes.data.data.images.length > 0) {
          setSelectedImage(pRes.data.data.images[0]);
        } else {
          setSelectedImage(pRes.data.data.image || '');
        }
        setReviews(rRes.data.data || []);
        if (rRes.data.ratingDistribution) setRatingDist(rRes.data.ratingDistribution);
      })
      .catch(() => toast.error('Failed to load product details'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await createReview({ product: id, ...reviewForm });
      toast.success('Review submitted for approval!');
      const { data } = await getProductReviews(id);
      setReviews(data.data || []);
      if (data.ratingDistribution) setRatingDist(data.ratingDistribution);
      setReviewForm({ rating: 5, comment: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
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

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;
  if (!product) return <div className="text-center py-20 text-gray-500">Product not found</div>;

  const imagesList = (product.images && product.images.length > 0)
    ? product.images
    : product.image && !product.image.includes('default-product')
      ? [product.image]
      : [];

  const totalReviews = Object.values(ratingDist).reduce((a, b) => a + b, 0);

  return (
    <div className="animate-fadeIn space-y-8">
      {/* Main Product Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Image & Gallery */}
          <div className="p-6 md:p-8 bg-gray-50 flex flex-col items-center justify-between border-b lg:border-b-0 lg:border-r border-gray-100">
            <div className="h-72 md:h-96 w-full flex items-center justify-center relative rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-inner p-4">
              {product.isFeatured && (
                <span className="absolute top-3 left-3 z-10 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full shadow-md">
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
                    className={`w-16 h-16 rounded-xl border-2 overflow-hidden bg-white p-1 transition-all flex-shrink-0 ${
                      selectedImage === img ? 'border-primary-600 shadow-md scale-105' : 'border-gray-200 opacity-60 hover:opacity-100'
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
                <span className="text-xs font-semibold text-primary-700 bg-primary-100 px-3 py-1 rounded-full capitalize">
                  {product.category?.replace(/_/g, ' ')}
                </span>
                {product.brand && (
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full flex items-center gap-1">
                    <FiTag /> {product.brand}
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mt-3">{product.name}</h1>
              <p className="text-gray-500 mt-3 text-sm leading-relaxed">{product.description || 'No detailed description available.'}</p>

              {/* Rating summary */}
              {product.avgRating > 0 && (
                <div className="flex items-center gap-2 mt-4">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((_, i) => (
                      <FiStar key={i} className={`w-4 h-4 ${i < Math.round(product.avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{product.avgRating}</span>
                  <span className="text-sm text-gray-400">({product.reviewCount || reviews.length} reviews)</span>
                </div>
              )}

              {/* Price Display */}
              <div className="mt-6 p-4 bg-primary-50/50 rounded-2xl border border-primary-100">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-primary-600">₹{product.price}</span>
                  <span className="text-gray-500 text-sm">/ {product.unit}</span>
                </div>
                {product.wholesalePrice && (
                  <p className="text-xs font-semibold text-green-700 mt-1">
                    🏷️ Wholesale Price: ₹{product.wholesalePrice} / {product.unit} for bulk buyers
                  </p>
                )}
              </div>
            </div>

            <div className="mt-8 space-y-4">
              {/* Quantity selector & Add to Cart */}
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3 hover:bg-gray-200 text-gray-700"><FiMinus /></button>
                  <span className="px-5 font-bold text-gray-800 text-base">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="p-3 hover:bg-gray-200 text-gray-700"><FiPlus /></button>
                </div>

                <button
                  onClick={() => addToCart(product, quantity)}
                  disabled={product.stock === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl font-bold hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-50 shadow-lg shadow-primary-200"
                  id="add-to-cart-btn"
                >
                  <FiShoppingCart className="w-5 h-5" /> {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>
              </div>

              {/* Stock availability status */}
              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                <span>
                  Status:{' '}
                  <strong className={product.stock > product.minStock ? 'text-green-600' : product.stock > 0 ? 'text-orange-500' : 'text-red-500'}>
                    {product.stock > product.minStock ? `In Stock (${product.stock} ${product.unit} available)` : product.stock > 0 ? `Low Stock (${product.stock} left)` : 'Out of Stock'}
                  </strong>
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <FiShield /> 100% Genuine Guaranteed
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews & Ratings Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
        <h2 className="text-xl font-bold text-gray-800">Customer Reviews & Ratings</h2>

        {/* Rating Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-5xl font-extrabold text-gray-800">{product.avgRating || '0.0'}</span>
            <div className="flex my-2">
              {[1, 2, 3, 4, 5].map((_, i) => (
                <FiStar key={i} className={`w-4 h-4 ${i < Math.round(product.avgRating || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
              ))}
            </div>
            <span className="text-xs text-gray-500">Based on {totalReviews} rating(s)</span>
          </div>

          {/* Rating Bars */}
          <div className="md:col-span-2 space-y-2 flex flex-col justify-center">
            {[5, 4, 3, 2, 1].map(stars => {
              const count = ratingDist[stars] || 0;
              const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
              return (
                <div key={stars} className="flex items-center gap-3 text-xs">
                  <span className="w-8 font-semibold text-gray-600">{stars} ★</span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-gray-400 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Review Form */}
        {user ? (
          <form onSubmit={handleReview} className="p-6 bg-primary-50/40 rounded-2xl border border-primary-100 space-y-4">
            <h3 className="text-sm font-bold text-gray-800">Write a Review</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-600">Your Rating:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setReviewForm(p => ({ ...p, rating: s }))}
                    className={`text-2xl transition-all ${s <= reviewForm.rating ? 'text-amber-400 scale-110' : 'text-gray-300 hover:text-amber-200'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={reviewForm.comment}
              onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))}
              className="w-full p-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
              placeholder="Share your experience with this product (quality, freshness, packaging...)"
              rows={3}
              required
            />
            <button
              type="submit"
              disabled={submittingReview}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-all disabled:opacity-50 shadow-md"
              id="submit-review-btn"
            >
              {submittingReview ? 'Submitting...' : 'Submit Review'}
            </button>
            <p className="text-[11px] text-gray-400">Note: Reviews are moderated before appearing publicly.</p>
          </form>
        ) : (
          <div className="p-4 bg-gray-50 rounded-xl text-center text-sm text-gray-500">
            Please log in to write a review for this product.
          </div>
        )}

        {/* Reviews List */}
        <div className="space-y-4 pt-2">
          {reviews.length === 0 ? (
            <p className="text-gray-400 text-center py-6">No approved reviews yet for this product.</p>
          ) : (
            reviews.map(review => (
              <div key={review._id} className="p-5 bg-white rounded-2xl border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-sm">
                      {review.user?.name?.[0] || 'U'}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-gray-800">{review.user?.name || 'Customer'}</h4>
                      <p className="text-[11px] text-gray-400">{new Date(review.createdAt).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={`text-sm ${i < review.rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-gray-600 pl-12">{review.comment}</p>

                {/* Admin Response */}
                {review.adminResponse && (
                  <div className="ml-12 p-3 bg-primary-50 rounded-xl border border-primary-100 text-xs space-y-1">
                    <span className="font-semibold text-primary-800 flex items-center gap-1">
                      <FiCheckCircle className="text-primary-600" /> Seller Response
                    </span>
                    <p className="text-gray-700">{review.adminResponse}</p>
                  </div>
                )}

                {/* Helpful Button */}
                <div className="flex justify-end pr-2">
                  <button
                    onClick={() => handleHelpful(review._id)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-primary-600 font-medium transition-colors"
                  >
                    <FiThumbsUp /> Helpful ({review.helpfulCount || 0})
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
