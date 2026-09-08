import { useState, useEffect } from 'react';
import { getProducts, bulkUploadProductImages } from '../../services/api';
import ProductImage from '../common/ProductImage';
import { Upload, Search, Filter, Image as ImageIcon, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function BulkImageManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('missing'); // 'all', 'missing', 'has_photo'
  const [pendingUploads, setPendingUploads] = useState({}); // { productId: { file, previewUrl } }
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await getProducts({ limit: 200, sort: 'name', status: 'all' });
      if (res.data.success) {
        setProducts(res.data.data || []);
      }
    } catch {
      toast.error('Failed to load products for bulk image management');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSelectImageForProduct = (productId, file) => {
    if (!file) return;

    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      toast.error('Only JPG, JPEG, PNG, and WebP images are allowed.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB.');
      return;
    }

    setPendingUploads(prev => ({
      ...prev,
      [productId]: {
        file,
        previewUrl: URL.createObjectURL(file)
      }
    }));
  };

  const handleRemovePending = (productId) => {
    setPendingUploads(prev => {
      const updated = { ...prev };
      if (updated[productId]?.previewUrl) {
        URL.revokeObjectURL(updated[productId].previewUrl);
      }
      delete updated[productId];
      return updated;
    });
  };

  const handleBulkUploadSubmit = async () => {
    const entries = Object.entries(pendingUploads);
    if (entries.length === 0) {
      toast.error('No pending photo uploads selected');
      return;
    }

    setUploading(true);
    setProgress(5);

    const formData = new FormData();
    const productIdsArr = [];

    entries.forEach(([productId, data]) => {
      formData.append('images', data.file);
      productIdsArr.push(productId);
    });

    formData.append('productIds', JSON.stringify(productIdsArr));

    try {
      const res = await bulkUploadProductImages(formData, (evt) => {
        if (evt.total) {
          const pct = Math.round((evt.loaded * 100) / evt.total);
          setProgress(pct);
        }
      });

      if (res.data.success) {
        toast.success(`Successfully updated photos for ${entries.length} product(s)!`);
        setPendingUploads({});
        fetchProducts();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.category.toLowerCase().includes(search.toLowerCase());
    const hasPhoto = p.image && p.image.trim() !== '' && !p.image.includes('default-product');

    if (filterType === 'missing') return matchesSearch && !hasPhoto;
    if (filterType === 'has_photo') return matchesSearch && hasPhoto;
    return matchesSearch;
  });

  const pendingCount = Object.keys(pendingUploads).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-navy-850 via-navy-900 to-navy-950 border border-mint-500/30 rounded-2xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-mint-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <ImageIcon className="w-6 h-6 text-mint-400" /> Bulk Product Image Management
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Quickly assign real photographs to multiple catalog products in batch. Select photos for missing items and save all at once!
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <button
            type="button"
            onClick={fetchProducts}
            className="p-2.5 bg-navy-950/80 border border-navy-800 hover:border-mint-500/30 rounded-xl transition text-slate-300 hover:text-mint-400"
            title="Refresh List"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={handleBulkUploadSubmit}
              disabled={uploading}
              className="bg-mint-500 text-navy-950 hover:bg-mint-400 font-extrabold px-4 py-2.5 rounded-xl text-sm shadow-lg shadow-mint-500/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-navy-950" /> Save {pendingCount} Photo(s)
            </button>
          )}
        </div>
      </div>

      {/* Uploading Progress */}
      {uploading && (
        <div className="bg-navy-900 p-4 rounded-xl shadow-sm border border-mint-500/30 space-y-2">
          <div className="flex justify-between text-xs font-semibold text-white">
            <span>Uploading & Optimizing Product Photographs...</span>
            <span className="text-mint-400">{progress}%</span>
          </div>
          <div className="w-full bg-navy-950 rounded-full h-2.5 overflow-hidden border border-navy-800">
            <div className="bg-mint-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-navy-900 p-4 rounded-2xl shadow-sm border border-navy-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-mint-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products by name or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-navy-950 border border-navy-700 text-slate-100 placeholder-slate-500 rounded-xl focus:ring-2 focus:ring-mint-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-navy-950 border border-navy-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:ring-2 focus:ring-mint-500 focus:outline-none"
          >
            <option value="missing">Missing Real Photos Only ({products.filter(p => !p.image || p.image.includes('default-product')).length})</option>
            <option value="all">All Catalog Products ({products.length})</option>
            <option value="has_photo">Has Real Photo ({products.filter(p => p.image && !p.image.includes('default-product')).length})</option>
          </select>
        </div>
      </div>

      {/* Products Bulk Table */}
      <div className="bg-navy-900 rounded-2xl shadow-sm border border-navy-800 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-mint-400 mb-2" />
            Loading catalog products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-300">No products match the selected filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-slate-300">
              <thead>
                <tr className="bg-navy-950 text-slate-400 text-xs font-semibold uppercase border-b border-navy-800">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Current Photograph</th>
                  <th className="py-3 px-4 text-right">Assign New Photograph</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800 text-sm">
                {filteredProducts.map(product => {
                  const pending = pendingUploads[product._id];

                  return (
                    <tr key={product._id} className="hover:bg-navy-950/50 transition">
                      <td className="py-3 px-4 font-semibold text-white">
                        {product.name}
                        {product.brand && <span className="text-xs font-normal text-slate-400 block">{product.brand}</span>}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 capitalize">
                        {product.category?.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4 font-bold text-mint-400">
                        ₹{product.price} / {product.unit}
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-14 h-14 rounded-xl overflow-hidden border border-navy-800 bg-navy-950">
                          <ProductImage src={product.image} alt={product.name} showFallbackLabel={false} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {pending ? (
                          <div className="inline-flex items-center gap-2 bg-navy-950 border border-mint-500/40 p-1.5 rounded-xl">
                            <img src={pending.previewUrl} alt="Pending" className="w-12 h-12 object-cover rounded-lg" />
                            <div className="text-left">
                              <span className="text-[11px] font-bold text-mint-300 block truncate max-w-[120px]">
                                Ready to upload
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemovePending(product._id)}
                                className="text-[10px] text-rose-400 hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-mint-500/10 text-mint-400 hover:bg-mint-500/20 rounded-xl text-xs font-semibold cursor-pointer transition border border-mint-500/30">
                            <Upload className="w-3.5 h-3.5" /> Select Photo
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/webp"
                              className="hidden"
                              onChange={e => {
                                if (e.target.files?.[0]) {
                                  handleSelectImageForProduct(product._id, e.target.files[0]);
                                }
                              }}
                            />
                          </label>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
