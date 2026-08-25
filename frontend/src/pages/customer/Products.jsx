import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProducts } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { FiSearch, FiShoppingCart, FiFilter, FiStar, FiX, FiCheck } from 'react-icons/fi';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'rice_grains', label: '🍚 Rice & Grains' },
  { value: 'dal_pulses', label: '🫘 Dal & Pulses' },
  { value: 'spices', label: '🌶️ Spices' },
  { value: 'oil_ghee', label: '🫒 Oil & Ghee' },
  { value: 'flour', label: '🌾 Flour' },
  { value: 'sugar_jaggery', label: '🍬 Sugar & Jaggery' },
  { value: 'tea_coffee', label: '☕ Tea & Coffee' },
  { value: 'dry_fruits', label: '🥜 Dry Fruits' },
  { value: 'cleaning', label: '🧹 Cleaning' },
  { value: 'packaged_food', label: '📦 Packaged Food' },
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
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '');
  const [availability, setAvailability] = useState(searchParams.get('availability') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || '-createdAt');

  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const { addToCart } = useCart();

  const fetchProducts = async (page = pagination.page) => {
    setLoading(true);
    try {
      const params = { page, limit: 16, sort };
      if (category) params.category = category;
      if (search) params.search = search;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (minRating) params.minRating = minRating;
      if (availability) params.availability = availability;

      const { data } = await getProducts(params);
      setProducts(data.data);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(1);
  }, [category, minPrice, maxPrice, minRating, availability, sort]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchProducts(1);
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
          <h1 className="text-2xl font-bold text-gray-800">All Products</h1>
          <p className="text-sm text-gray-400">{pagination.total} products available</p>
        </div>

        <div className="flex items-center gap-3 max-w-lg w-full">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
              placeholder="Search by name, brand, description..."
              id="search-products"
            />
          </form>

          {/* Toggle Filter Panel (Mobile/Desktop) */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              activeFilterCount > 0
                ? 'bg-primary-100 border-primary-300 text-primary-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FiFilter /> Filters {activeFilterCount > 0 && <span className="w-5 h-5 bg-primary-600 text-white rounded-full text-xs flex items-center justify-center">{activeFilterCount}</span>}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-lg animate-fadeIn space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <FiFilter className="text-primary-600" /> Filter & Sort Products
            </h3>
            {activeFilterCount > 0 && (
              <button onClick={clearAllFilters} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                <FiX /> Clear Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Price Range (₹)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={e => setMinPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={e => setMaxPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            </div>

            {/* Min Rating */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Minimum Rating</label>
              <select
                value={minRating}
                onChange={e => setMinRating(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
              >
                <option value="">Any Rating</option>
                <option value="4">4★ & above</option>
                <option value="3">3★ & above</option>
                <option value="2">2★ & above</option>
              </select>
            </div>

            {/* Availability */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Availability</label>
              <select
                value={availability}
                onChange={e => setAvailability(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
              >
                <option value="">All Items</option>
                <option value="in_stock">In Stock Only</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Sort By</label>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white font-medium text-primary-700"
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
                ? 'bg-primary-600 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
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
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
              <div className="h-44 bg-gray-200"></div>
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <span className="text-5xl mb-4 block">🔍</span>
          <h3 className="text-lg font-bold text-gray-700">No products match your criteria</h3>
          <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or search term</p>
          {activeFilterCount > 0 && (
            <button onClick={clearAllFilters} className="mt-4 px-4 py-2 bg-primary-100 text-primary-700 rounded-xl text-sm font-semibold hover:bg-primary-200 transition-all">
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(product => (
            <div key={product._id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-primary-200 transition-all group relative flex flex-col justify-between">
              {product.isFeatured && (
                <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full shadow-md">
                  Featured
                </span>
              )}
              <Link to={`/products/${product._id}`}>
                <div className="h-44 bg-gray-50 flex items-center justify-center p-2 relative overflow-hidden">
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center">
                      <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">Out of Stock</span>
                    </div>
                  )}
                  {product.image && !product.image.includes('default-product') ? (
                    <img src={product.image} alt={product.name} className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <span className="text-5xl">
                      {{'rice_grains':'🍚','dal_pulses':'🫘','spices':'🌶️','oil_ghee':'🫒','flour':'🌾','sugar_jaggery':'🍬','tea_coffee':'☕','dry_fruits':'🥜','cleaning':'🧹','packaged_food':'📦'}[product.category] || '📦'}
                    </span>
                  )}
                </div>
              </Link>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <Link to={`/products/${product._id}`}>
                    <h3 className="font-semibold text-gray-800 text-sm line-clamp-1 group-hover:text-primary-600 transition-colors">{product.name}</h3>
                  </Link>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-400 capitalize">{product.category?.replace(/_/g, ' ')}</p>
                    {product.avgRating > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500">
                        <FiStar className="fill-amber-400 w-3 h-3" /> {product.avgRating}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-lg font-bold text-primary-600">₹{product.price}</span>
                      <span className="text-xs text-gray-400 ml-1">/{product.unit}</span>
                    </div>
                    <button
                      onClick={() => addToCart(product)}
                      disabled={product.stock === 0}
                      className="p-2 bg-primary-100 text-primary-600 rounded-lg hover:bg-primary-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiShoppingCart className="w-4 h-4" />
                    </button>
                  </div>
                  {product.stock <= product.minStock && product.stock > 0 && (
                    <p className="text-xs text-orange-500 mt-2 font-medium">⚠️ Low stock ({product.stock} left)</p>
                  )}
                  {product.stock > product.minStock && (
                    <p className="text-xs text-green-600 mt-2 font-medium">✓ In Stock</p>
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
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
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
