import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getProducts } from '../../services/api';
import { useCart } from '../../context/CartContext';
import { FiSearch, FiShoppingCart, FiFilter } from 'react-icons/fi';

const CATEGORIES = [
  { value: '', label: 'All' }, { value: 'rice_grains', label: '🍚 Rice' }, { value: 'dal_pulses', label: '🫘 Dal' },
  { value: 'spices', label: '🌶️ Spices' }, { value: 'oil_ghee', label: '🫒 Oil' }, { value: 'flour', label: '🌾 Flour' },
  { value: 'sugar_jaggery', label: '🍬 Sugar' }, { value: 'tea_coffee', label: '☕ Tea' }, { value: 'dry_fruits', label: '🥜 Dry Fruits' },
  { value: 'cleaning', label: '🧹 Cleaning' }, { value: 'packaged_food', label: '📦 Packaged' },
];

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const { addToCart } = useCart();

  useEffect(() => {
    fetchProducts();
  }, [category, pagination.page]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: 16 };
      if (category) params.category = category;
      if (search) params.search = search;
      const { data } = await getProducts(params);
      setProducts(data.data);
      setPagination(data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(p => ({ ...p, page: 1 }));
    fetchProducts();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">All Products</h1>
        <form onSubmit={handleSearch} className="relative max-w-md w-full">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            placeholder="Search products..." id="search-products" />
        </form>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button key={cat.value} onClick={() => { setCategory(cat.value); setPagination(p => ({ ...p, page: 1 })); }}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${category === cat.value ? 'bg-primary-600 text-white shadow-lg' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'}`}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
              <div className="h-40 bg-gray-200"></div>
              <div className="p-4 space-y-3"><div className="h-4 bg-gray-200 rounded w-3/4"></div><div className="h-4 bg-gray-200 rounded w-1/2"></div></div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16"><span className="text-5xl mb-4 block">🔍</span><p className="text-gray-500 text-lg">No products found</p></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(product => (
            <div key={product._id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-primary-200 transition-all group">
              <Link to={`/products/${product._id}`}>
                <div className="h-40 bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center relative">
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold">Out of Stock</span></div>
                  )}
                  <span className="text-5xl">
                    {{'rice_grains':'🍚','dal_pulses':'🫘','spices':'🌶️','oil_ghee':'🫒','flour':'🌾','sugar_jaggery':'🍬','tea_coffee':'☕','dry_fruits':'🥜','cleaning':'🧹','packaged_food':'📦'}[product.category] || '📦'}
                  </span>
                </div>
              </Link>
              <div className="p-4">
                <Link to={`/products/${product._id}`}><h3 className="font-semibold text-gray-800 text-sm line-clamp-1 group-hover:text-primary-600">{product.name}</h3></Link>
                <p className="text-xs text-gray-400 mt-1 capitalize">{product.category?.replace(/_/g, ' ')}</p>
                {product.avgRating > 0 && <div className="flex items-center gap-1 mt-1"><span className="text-yellow-400 text-xs">★</span><span className="text-xs text-gray-500">{product.avgRating}</span></div>}
                <div className="flex items-center justify-between mt-3">
                  <div><span className="text-lg font-bold text-primary-600">₹{product.price}</span><span className="text-xs text-gray-400 ml-1">/{product.unit}</span></div>
                  <button onClick={() => addToCart(product)} disabled={product.stock === 0}
                    className="p-2 bg-primary-100 text-primary-600 rounded-lg hover:bg-primary-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <FiShoppingCart className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(pagination.pages)].map((_, i) => (
            <button key={i} onClick={() => setPagination(p => ({ ...p, page: i + 1 }))}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${pagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
