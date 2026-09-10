import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProducts } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { FiSearch, FiShoppingCart, FiFilter, FiStar, FiX } from 'react-icons/fi';
import ProductImage from '../../components/common/ProductImage';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'rice_grains', label: '🍚 Rice & Grains' },
  { value: 'dal_pulses', label: '🫘 Dal & Pulses' },
  { value: 'spices', label: '🌶️ Spices' },
  { value: 'oil_ghee', label: '🫒 Oil & Ghee' },
  { value: 'flour', label: '🌾 Flour' },
  { value: 'sugar_jaggery', label: '🍬 Sugar & Jaggery' },
  { value: 'tea_coffee', label: '☕ Tea & Coffee' },
  { value: 'snacks', label: '🍿 Snacks' },
  { value: 'beverages', label: '🥤 Beverages' },
  { value: 'dairy', label: '🥛 Dairy' },
  { value: 'dry_fruits', label: '🥜 Dry Fruits' },
  { value: 'cleaning', label: '🧹 Cleaning' },
  { value: 'personal_care', label: '🧴 Personal Care' },
  { value: 'packaged_food', label: '📦 Packaged Food' },
  { value: 'other', label: '📋 Other' },
];

const SORT_OPTIONS = [
  { value: '-createdAt', label: 'Newest First' },
  { value: 'price', label: 'Price: Low to High' },
  { value: '-price', label: 'Price: High to Low' },
  { value: '-avgRating', label: 'Highest Rated' },
];

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filters state initialized from URL search params
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '');
  const [availability, setAvailability] = useState(searchParams.get('availability') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || '-createdAt');
  const fetchRef = useRef(0);

  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const { addToCart } = useCart();

  const fetchProducts = useCallback(async (page = 1) => {
    setLoading(true);
    const requestId = ++fetchRef.current;
    try {
      const params = { page, limit: 16, sort };
      if (category) params.category = category;
      if (debouncedSearch) params.search = debouncedSearch;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (minRating) params.minRating = minRating;
      if (availability) params.availability = availability;

      const { data } = await getProducts(params);
      if (requestId !== fetchRef.current) return; // ignore stale responses
      setProducts(data.data);
      setPagination(data.pagination);
    } catch {
      if (requestId !== fetchRef.current) return;
      toast.error('Failed to load products');
    } finally {
      if (requestId === fetchRef.current) setLoading(false);
    }
  }, [category, debouncedSearch, minPrice, maxPrice, minRating, availability, sort]);

  useEffect(() => {
    fetchProducts(1);
  }, [fetchProducts]);

  // Debounce live search so typing doesn't fire an API request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setDebouncedSearch(search);
  };

  const clearAllFilters = () => {
    setSearch('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
    setAvailability('');
    setSort('-createdAt');
    setSearchParams({});
  };

  const activeFilterCount = [category, minPrice, maxPrice, minRating, availability].filter(Boolean).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">All Products</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{pagination.total} products available</p>
        </div>

        <div className="flex items-center gap-3 max-w-lg w-full">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-mint-500 focus:border-transparent text-sm transition-all shadow-sm"
              placeholder="Search by name, brand, description..."
              id="search-products"
            />
          </form>

          {/* Toggle Filter Panel (Mobile/Desktop) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              activeFilterCount > 0
                ? 'bg-mint-500/10 border-mint-500/40 text-mint-600 dark:text-mint-400'
                : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 shadow-sm'
            }`}
          >
            <FiFilter /> Filters {activeFilterCount > 0 && <span className="w-5 h-5 bg-mint-500 text-navy-950 rounded-full text-xs font-bold flex items-center justify-center">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-xl animate-fadeIn space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FiFilter className="text-mint-600 dark:text-mint-400" /> Filter & Sort Products
            </h3>
            {activeFilterCount > 0 && (
              <button onClick={clearAllFilters} className="text-xs text-rose-500 hover:underline flex items-center gap-1">
                <FiX /> Clear Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-mint-500 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Price Range (₹)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-mint-500 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-mint-500 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Min Rating */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Minimum Rating</label>
              <select
                value={minRating}
                onChange={e => setMinRating(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-mint-500 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100"
              >
                <option value="">Any Rating</option>
                <option value="4">4★ & above</option>
                <option value="3">3★ & above</option>
                <option value="2">2★ & above</option>
              </select>
            </div>

            {/* Availability */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Availability</label>
              <select
                value={availability}
                onChange={e => setAvailability(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-mint-500 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100"
              >
                <option value="">All Items</option>
                <option value="in_stock">In Stock Only</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Sort By</label>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-navy-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-mint-500 bg-slate-50 dark:bg-navy-950 text-mint-600 dark:text-mint-400 font-semibold"
              >
                {SORT_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Category Pills (Quick Filter) */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              category === cat.value
                ? 'bg-mint-500 text-navy-950 shadow-md shadow-mint-500/20'
                : 'bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-800 hover:border-mint-500/40 shadow-sm'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} data-testid="product-skeleton" className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 overflow-hidden animate-pulse shadow-sm">
              <div className="h-44 bg-slate-100 dark:bg-navy-950"></div>
              <div className="p-4 space-y-3">
                <div className="h-4 bg-slate-200 dark:bg-navy-800 rounded w-3/4"></div>
                <div className="h-4 bg-slate-200 dark:bg-navy-800 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm">
          <span className="text-5xl mb-4 block">🔍</span>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No products match your criteria</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Try adjusting your filters or search term</p>
          {activeFilterCount > 0 && (
            <button onClick={clearAllFilters} className="mt-4 px-4 py-2 bg-mint-500/10 border border-mint-500/30 text-mint-600 dark:text-mint-400 rounded-xl text-sm font-semibold hover:bg-mint-500/20 transition-all">
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(product => (
            <div key={product._id} data-testid="product-card" className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800/80 overflow-hidden shadow-sm hover:shadow-xl hover:border-mint-500/40 hover:shadow-mint-500/10 transition-all group relative flex flex-col justify-between">
              {product.isFeatured && (
                <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-mint-500 text-navy-950 text-[10px] font-extrabold rounded-full shadow-md">
                  Featured
                </span>
              )}
              <Link to={`/products/${product._id}`}>
                <div className="h-44 bg-slate-50 dark:bg-navy-950 flex items-center justify-center p-2 relative overflow-hidden border-b border-slate-100 dark:border-navy-800/60 product-img-box">
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
                      <span className="bg-rose-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">Out of Stock</span>
                    </div>
                  )}
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
                    <button
                      onClick={() => addToCart(product)}
                      disabled={product.stock === 0}
                      className="p-2 bg-mint-500 text-navy-950 font-bold rounded-lg hover:bg-mint-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FiShoppingCart className="w-4 h-4" />
                    </button>
                  </div>
                  {product.stock <= product.minStock && product.stock > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-medium">⚠️ Low stock ({product.stock} left)</p>
                  )}
                  {product.stock > product.minStock && (
                    <p className="text-xs text-mint-600 dark:text-mint-400 mt-2 font-medium">✓ In Stock</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          {[...Array(pagination.pages)].map((_, i) => (
            <button
              key={i}
              onClick={() => fetchProducts(i + 1)}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                pagination.page === i + 1
                  ? 'bg-mint-500 text-navy-950 font-bold shadow-md shadow-mint-500/20'
                  : 'bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-800 hover:border-mint-500/40 shadow-sm'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
