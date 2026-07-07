import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, getCategories } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { FiShoppingCart, FiSearch, FiStar, FiArrowRight, FiTruck, FiShield, FiClock } from 'react-icons/fi';

const CATEGORY_LABELS = {
  rice_grains: '🍚 Rice & Grains', dal_pulses: '🫘 Dal & Pulses', spices: '🌶️ Spices',
  oil_ghee: '🫒 Oil & Ghee', flour: '🌾 Flour', sugar_jaggery: '🍬 Sugar & Jaggery',
  tea_coffee: '☕ Tea & Coffee', snacks: '🍿 Snacks', beverages: '🥤 Beverages',
  dairy: '🥛 Dairy', dry_fruits: '🥜 Dry Fruits', cleaning: '🧹 Cleaning',
  personal_care: '🧴 Personal Care', packaged_food: '📦 Packaged Food', other: '📋 Other'
};

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const { addToCart } = useCart();

  useEffect(() => {
    getProducts({ limit: 8, sort: '-totalSold' }).then(res => setFeaturedProducts(res.data.data)).catch(() => {});
    getCategories().then(res => setCategories(res.data.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-12 animate-fadeIn">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-700 via-primary-600 to-primary-500 text-white p-8 md:p-14">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30"></div>
        <div className="relative z-10 max-w-2xl">
          <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-semibold mb-4 backdrop-blur-sm">🛒 Fresh Groceries Delivered</span>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">Welcome to<br /><span className="text-yellow-300">Ganesh Trades</span></h1>
          <p className="text-primary-100 text-lg mb-8 max-w-xl">Your trusted grocery and wholesale shop. Quality products at best prices for homes, hotels & PGs.</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary-700 rounded-xl font-semibold hover:bg-gray-100 transition-all shadow-xl">
              Browse Products <FiArrowRight />
            </Link>
            <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 text-white rounded-xl font-semibold hover:bg-white/30 transition-all backdrop-blur-sm border border-white/30">
              Register Now
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: <FiTruck className="w-6 h-6" />, title: 'Fast Delivery', desc: 'Same day delivery for local orders' },
          { icon: <FiShield className="w-6 h-6" />, title: 'Quality Products', desc: 'Only genuine and fresh items' },
          { icon: <FiClock className="w-6 h-6" />, title: 'Wholesale Prices', desc: 'Best prices for bulk orders' },
        ].map((f, i) => (
          <div key={i} className="flex items-start gap-4 p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-200 transition-all group">
            <div className="p-3 bg-primary-100 text-primary-600 rounded-xl group-hover:bg-primary-600 group-hover:text-white transition-all">{f.icon}</div>
            <div>
              <h3 className="font-semibold text-gray-800">{f.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{f.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Shop by Category</h2>
            <Link to="/products" className="text-primary-600 hover:text-primary-700 font-medium text-sm flex items-center gap-1">View All <FiArrowRight /></Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories.slice(0, 12).map((cat) => (
              <Link key={cat._id} to={`/products?category=${cat._id}`}
                className="flex flex-col items-center p-4 bg-white rounded-2xl border border-gray-100 hover:border-primary-300 hover:shadow-lg transition-all group text-center">
                <span className="text-3xl mb-2">{CATEGORY_LABELS[cat._id]?.split(' ')[0] || '📦'}</span>
                <span className="text-sm font-medium text-gray-700 group-hover:text-primary-600">
                  {CATEGORY_LABELS[cat._id]?.slice(2)?.trim() || cat._id}
                </span>
                <span className="text-xs text-gray-400 mt-1">{cat.count} items</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Popular Products</h2>
            <Link to="/products" className="text-primary-600 hover:text-primary-700 font-medium text-sm flex items-center gap-1">See All <FiArrowRight /></Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.map(product => (
              <div key={product._id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-primary-200 transition-all group">
                <Link to={`/products/${product._id}`}>
                  <div className="h-40 bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
                    <span className="text-5xl">{CATEGORY_LABELS[product.category]?.split(' ')[0] || '📦'}</span>
                  </div>
                </Link>
                <div className="p-4">
                  <Link to={`/products/${product._id}`}>
                    <h3 className="font-semibold text-gray-800 text-sm line-clamp-1 group-hover:text-primary-600 transition-colors">{product.name}</h3>
                  </Link>
                  <p className="text-xs text-gray-400 mt-1 capitalize">{product.category?.replace(/_/g, ' ')}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <span className="text-lg font-bold text-primary-600">₹{product.price}</span>
                      <span className="text-xs text-gray-400 ml-1">/{product.unit}</span>
                    </div>
                    <button onClick={() => addToCart(product)}
                      className="p-2 bg-primary-100 text-primary-600 rounded-lg hover:bg-primary-600 hover:text-white transition-all"
                      disabled={product.stock === 0}>
                      <FiShoppingCart className="w-4 h-4" />
                    </button>
                  </div>
                  {product.stock <= product.minStock && product.stock > 0 && (
                    <p className="text-xs text-orange-500 mt-2">⚠️ Low stock</p>
                  )}
                  {product.stock === 0 && <p className="text-xs text-red-500 mt-2">Out of stock</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
