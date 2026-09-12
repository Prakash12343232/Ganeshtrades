import { useState, useEffect, useCallback } from 'react';
import { getLowStock, getProducts, updateStock } from '../../services/api';
import toast from 'react-hot-toast';
import { FiAlertTriangle, FiSearch, FiUploadCloud } from 'react-icons/fi';
import ProductImage from '../../components/common/ProductImage';
import DataImportWizard from '../../components/admin/DataImportWizard';

const STOCK_ACTIONS = [
  { value: 'add', label: 'Add', color: 'bg-green-100 text-green-700 hover:bg-green-200' },
  { value: 'subtract', label: 'Subtract', color: 'bg-orange-100 text-orange-700 hover:bg-orange-200' },
  { value: 'set', label: 'Set', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' }
];

export default function AdminInventory() {
  const [lowStock, setLowStock] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockInputs, setStockInputs] = useState({});
  const [showImportWizard, setShowImportWizard] = useState(false);

  const fetchLowStock = () => {
    getLowStock().then(res => setLowStock(res.data.data)).catch(() => {});
  };

  const fetchAll = useCallback(() => {
    const params = { limit: 100, status: 'all', sort: 'name' };
    if (search.trim()) params.search = search.trim();
    return getProducts(params)
      .then(res => setProducts(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    fetchLowStock();
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const doStockUpdate = async (id, amount, action) => {
    try {
      await updateStock(id, { stock: amount, action });
      toast.success('Stock updated');
      setStockInputs(prev => ({ ...prev, [id]: '' }));
      fetchLowStock();
      fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed');
    }
  };

  const handleStockUpdate = (id, amount, action) => {
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!confirm(`Confirm stock update: ${action} ${amount}?`)) return;
    doStockUpdate(id, amount, action);
  };

  const handleQuickAdd = (id, amount) => {
    if (!confirm(`Add ${amount} units to stock?`)) return;
    doStockUpdate(id, amount, 'add');
  };

  const getInput = (id) => stockInputs[id] || '';

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>
        <button
          type="button"
          onClick={() => setShowImportWizard(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-gray-700 hover:text-primary-700 border border-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-50 shadow-sm transition-all self-start sm:self-auto"
        >
          <FiUploadCloud className="text-primary-600 w-4 h-4" /> Bulk Stock Update (Excel/CSV)
        </button>
      </div>

      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white mb-6">
        <div className="flex items-center gap-3">
          <FiAlertTriangle className="w-8 h-8" />
          <div>
            <h2 className="text-xl font-bold">Low Stock Alerts</h2>
            <p className="text-orange-100">{lowStock.length} products need restocking</p>
          </div>
        </div>
      </div>

      {loading ? <div className="text-center py-10">Loading...</div> : (
        <>
          <div className="space-y-4 mb-8">
            {lowStock.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <span className="text-5xl mb-4 block">✅</span>
                <p className="text-gray-500 text-lg">All products are well-stocked!</p>
              </div>
            ) : (
              lowStock.map(product => (
                <div key={product._id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0 relative">
                      <ProductImage src={product.image} alt={product.name} showFallbackLabel={false} />
                      <span className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white ${product.stock === 0 ? 'bg-red-500' : 'bg-orange-500'}`} title={product.stock === 0 ? 'Out of Stock' : 'Low Stock'} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{product.name}</h3>
                      <p className="text-xs text-gray-400 capitalize">{product.category?.replace(/_/g, ' ')} • ₹{product.price}/{product.unit}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className={`text-2xl font-bold ${product.stock === 0 ? 'text-red-600' : 'text-orange-500'}`}>{product.stock}</p>
                      <p className="text-xs text-gray-400">Current</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-600">{product.minStock}</p>
                      <p className="text-xs text-gray-400">Min</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleQuickAdd(product._id, 10)} className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200">+10</button>
                      <button onClick={() => handleQuickAdd(product._id, 50)} className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200">+50</button>
                      <button onClick={() => handleQuickAdd(product._id, 100)} className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200">+100</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between gap-4 p-4 border-b border-gray-100 flex-wrap">
              <h2 className="text-lg font-bold text-gray-800">All Products</h2>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search products..."
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Price</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Stock</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Min</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Adjust Stock</th>
                </tr></thead>
                <tbody>
                  {products.map(product => {
                    const statusDot = product.stock === 0 ? 'bg-red-500' : (product.stock <= product.minStock ? 'bg-orange-500' : 'bg-green-500');
                    return (
                      <tr key={product._id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0">
                              <ProductImage src={product.image} alt={product.name} showFallbackLabel={false} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{product.name}</p>
                              <p className="text-xs text-gray-400 capitalize">{product.category?.replace(/_/g, ' ')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">₹{product.price}<span className="text-xs text-gray-400">/{product.unit}</span></td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-2 font-semibold text-gray-800">
                            <span className={`w-2 h-2 rounded-full ${statusDot}`}></span>
                            {product.stock}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-gray-600">{product.minStock}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="number"
                              min="1"
                              value={getInput(product._id)}
                              onChange={e => setStockInputs(prev => ({ ...prev, [product._id]: e.target.value }))}
                              placeholder="Qty"
                              className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                            />
                            {STOCK_ACTIONS.map(a => (
                              <button key={a.value} onClick={() => handleStockUpdate(product._id, parseInt(getInput(product._id), 10), a.value)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium ${a.color} disabled:opacity-40`}
                                disabled={!getInput(product._id) || parseInt(getInput(product._id), 10) <= 0}>
                                {a.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-gray-400">No products found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Bulk Inventory Import Wizard */}
      <DataImportWizard
        isOpen={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        initialType="inventory"
        onImportSuccess={() => {
          fetchLowStock();
          fetchAll();
        }}
      />
    </div>
  );
}