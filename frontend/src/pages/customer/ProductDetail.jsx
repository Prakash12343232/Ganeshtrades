import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getProduct, getProductReviews, createReview } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { FiShoppingCart, FiMinus, FiPlus, FiStar } from 'react-icons/fi';

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const { addToCart } = useCart();
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([getProduct(id), getProductReviews(id)])
      .then(([pRes, rRes]) => { setProduct(pRes.data.data); setReviews(rRes.data.data); })
      .catch(() => toast.error('Failed to load product'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleReview = async (e) => {
    e.preventDefault();
    try {
      await createReview({ productId: id, ...reviewForm });
      toast.success('Review submitted!');
      const { data } = await getProductReviews(id);
      setReviews(data.data);
      setReviewForm({ rating: 5, comment: '' });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;
  if (!product) return <div className="text-center py-20 text-gray-500">Product not found</div>;

  return (
    <div className="animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          <div className="h-64 md:h-96 bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
            <span className="text-8xl">{{'rice_grains':'🍚','dal_pulses':'🫘','spices':'🌶️','oil_ghee':'🫒','flour':'🌾','sugar_jaggery':'🍬','tea_coffee':'☕','dry_fruits':'🥜','cleaning':'🧹','packaged_food':'📦'}[product.category] || '📦'}</span>
          </div>
          <div className="p-6 md:p-8 flex flex-col justify-center">
            <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-3 py-1 rounded-full w-fit capitalize">{product.category?.replace(/_/g, ' ')}</span>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mt-3">{product.name}</h1>
            <p className="text-gray-500 mt-2">{product.description}</p>

            {product.avgRating > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <div className="flex">{[...Array(5)].map((_, i) => <FiStar key={i} className={`w-4 h-4 ${i < Math.round(product.avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />)}</div>
                <span className="text-sm text-gray-500">{product.avgRating} ({product.reviewCount} reviews)</span>
              </div>
            )}

            <div className="mt-4">
              <span className="text-3xl font-bold text-primary-600">₹{product.price}</span>
              <span className="text-gray-400 ml-2">per {product.unit}</span>
              {product.wholesalePrice && <p className="text-sm text-green-600 mt-1">Wholesale: ₹{product.wholesalePrice}/{product.unit}</p>}
            </div>

            <div className="flex items-center gap-4 mt-6">
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-3 hover:bg-gray-100"><FiMinus /></button>
                <span className="px-4 font-semibold">{quantity}</span>
                <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="p-3 hover:bg-gray-100"><FiPlus /></button>
              </div>
              <button onClick={() => addToCart(product, quantity)} disabled={product.stock === 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all disabled:opacity-50 shadow-lg shadow-primary-200">
                <FiShoppingCart /> {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
              <span className={product.stock > product.minStock ? 'text-green-600' : 'text-orange-500'}>
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              </span>
              {product.brand && <span>Brand: {product.brand}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Reviews ({reviews.length})</h2>

        {user && (
          <form onSubmit={handleReview} className="mb-6 p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm font-medium">Rating:</label>
              <div className="flex">{[1,2,3,4,5].map(s => (
                <button key={s} type="button" onClick={() => setReviewForm(p => ({...p, rating: s}))}
                  className={`text-xl ${s <= reviewForm.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>
              ))}</div>
            </div>
            <textarea value={reviewForm.comment} onChange={e => setReviewForm(p => ({...p, comment: e.target.value}))}
              className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Write your review..." rows={3} />
            <button type="submit" className="mt-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Submit Review</button>
          </form>
        )}

        <div className="space-y-4">
          {reviews.length === 0 && <p className="text-gray-400 text-center py-4">No reviews yet</p>}
          {reviews.map(review => (
            <div key={review._id} className="border-b border-gray-100 pb-4 last:border-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 text-sm font-bold">{review.user?.name?.[0]}</div>
                  <span className="font-medium text-sm">{review.user?.name}</span>
                </div>
                <div className="flex">{[...Array(5)].map((_, i) => <span key={i} className={`text-sm ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>)}</div>
              </div>
              {review.comment && <p className="text-sm text-gray-600 mt-2 ml-10">{review.comment}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
