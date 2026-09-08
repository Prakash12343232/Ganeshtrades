import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFeaturedProducts, getProducts, getCategories } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { FiShoppingCart, FiStar, FiArrowRight, FiTruck, FiShield, FiClock, FiAward } from 'react-icons/fi';
import ProductImage from '../../components/common/ProductImage';

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
    getFeaturedProducts()
      .then(res => {
        if (res.data.data && res.data.data.length > 0) setFeaturedProducts(res.data.data);
        else getProducts({ limit: 8, sort: '-totalSold' }).then(r => setFeaturedProducts(r.data.data)).catch(() => {});
      })
      .catch(() => {
        getProducts({ limit: 8, sort: '-totalSold' }).then(r => setFeaturedProducts(r.data.data)).catch(() => {});
      });
    getCategories().then(res => setCategories(res.data.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-12 animate-fadeIn">
      {/* Hero */}
      <section className="hero-section relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-navy-850 to-navy-950 text-slate-900 dark:text-white p-8 md:p-12 border border-navy-700/80 shadow-2xl transition-all duration-200">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%2334d399%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40"></div>
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 space-y-5">
            <div className="hero-badge inline-flex items-center gap-1.5 px-3.5 py-1 bg-navy-800/90 border border-navy-700 rounded-full text-xs font-semibold text-mint-400 dark:text-mint-300 backdrop-blur-md shadow-sm">
              <span className="text-amber-400">⚡</span> Fresh Groceries Delivered
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.15]">
              <span className="hero-title-main text-slate-900 dark:text-white">Quality Groceries</span><br />
              <span className="hero-title-accent text-mint-600 dark:text-mint-400">Delivered to You</span>
            </h1>
            <p className="hero-subtext text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed max-w-lg font-medium">
              Your trusted grocery and wholesale shop. Quality products at best prices for homes, hotels &amp; PGs.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link to="/products" className="inline-flex items-center gap-2 px-6 py-3.5 bg-mint-500 hover:bg-mint-400 text-navy-950 font-bold rounded-xl transition-all shadow-lg shadow-mint-500/25 active:scale-95">
                Browse Products <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/register" className="hero-sec-btn inline-flex items-center gap-2 px-6 py-3.5 bg-navy-900/80 hover:bg-navy-800 text-slate-800 dark:text-slate-100 font-semibold rounded-xl transition-all border border-navy-600/80 hover:border-mint-500/50 backdrop-blur-sm active:scale-95">
                Register Now
              </Link>
            </div>
          </div>

          {/* Hero Right Illustration */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[340px]">
              <div className="absolute inset-0 bg-mint-400/25 dark:bg-mint-400/10 rounded-full blur-2xl transform scale-95 pointer-events-none"></div>
              <img
                src="/hero-basket.svg"
                alt="Groceries Made Simple"
                className="relative z-10 w-full h-auto drop-shadow-[0_15px_30px_rgba(52,211,153,0.18)] transition-transform hover:scale-105 duration-300 opacity-100"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { icon: <FiTruck className="w-6 h-6" />, title: 'Fast Delivery', desc: 'Same day delivery for local orders' },
          { icon: <FiShield className="w-6 h-6" />, title: 'Quality Products', desc: 'Only genuine and fresh items' },
          { icon: <FiClock className="w-6 h-6" />, title: 'Wholesale Prices', desc: 'Best prices for bulk orders' },
        ].map((f, i) => (
          <div key={i} className="feature-card flex items-start gap-4 p-5 sm:p-6 bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800/90 shadow-md hover:border-mint-500/40 hover:shadow-lg hover:shadow-mint-500/10 transition-all group">
            <div className="feature-icon-box p-3 bg-mint-500/10 text-mint-600 dark:text-mint-400 rounded-xl group-hover:bg-mint-500 group-hover:text-navy-950 transition-all flex-shrink-0">{f.icon}</div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">{f.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 leading-snug font-medium">{f.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Shop by Category</h2>
            <Link to="/products" className="text-mint-600 dark:text-mint-400 hover:underline font-semibold text-sm flex items-center gap-1">View All <FiArrowRight /></Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories.slice(0, 12).map((cat) => (
              <Link key={cat._id} to={`/products?category=${cat._id}`}
                className="flex flex-col items-center p-4 bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm hover:shadow-lg hover:border-mint-500/40 hover:shadow-mint-500/10 transition-all group text-center">
                <span className="text-3xl mb-2">{CATEGORY_LABELS[cat._id]?.split(' ')[0] || '📦'}</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-mint-600 dark:group-hover:text-mint-400">
                  {CATEGORY_LABELS[cat._id]?.slice(2)?.trim() || cat._id}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{cat.count} items</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Featured Products</h2>
              <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-300 text-xs font-semibold rounded-full flex items-center gap-1">
                <FiAward /> Handpicked
              </span>
            </div>
            <Link to="/products" className="text-mint-600 dark:text-mint-400 hover:underline font-semibold text-sm flex items-center gap-1">See All <FiArrowRight /></Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.map(product => (
              <div key={product._id} className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800/80 overflow-hidden shadow-sm hover:shadow-xl hover:border-mint-500/40 hover:shadow-mint-500/10 transition-all group relative flex flex-col justify-between">
                {product.isFeatured && (
                  <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-mint-500 text-navy-950 text-[10px] font-extrabold rounded-full shadow-md">
                    Featured
                  </span>
                )}
                <Link to={`/products/${product._id}`}>
                  <div className="h-44 bg-slate-50 dark:bg-navy-950 flex items-center justify-center p-2 relative overflow-hidden border-b border-slate-100 dark:border-navy-800/60 product-img-box">
                    <ProductImage src={product.image} alt={product.name} />
                  </div>
                </Link>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <Link to={`/products/${product._id}`}>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm line-clamp-1 group-hover:text-mint-600 dark:group-hover:text-mint-400 transition-colors">{product.name}</h3>
                    </Link>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{product.category?.replace(/_/g, ' ')}</p>
                      {product.avgRating > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500 dark:text-amber-400">
                          <FiStar className="fill-amber-400 w-3 h-3" /> {product.avgRating}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-mint-600 dark:text-mint-400">₹{product.price}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">/{product.unit}</span>
                      </div>
                      <button onClick={() => addToCart(product)}
                        className="p-2 bg-mint-500 text-navy-950 font-bold rounded-lg hover:bg-mint-400 transition-all disabled:opacity-40"
                        disabled={product.stock === 0}>
                        <FiShoppingCart className="w-4 h-4" />
                      </button>
                    </div>
                    {product.stock <= product.minStock && product.stock > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">⚠️ Low stock ({product.stock} left)</p>
                    )}
                    {product.stock === 0 && <p className="text-xs text-rose-500 mt-2 font-medium">Out of stock</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


