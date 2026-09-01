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
      const res = await getProducts({ limit: 200, sort: 'name' });
      if (res.data.success) {
        setProducts(res.data.data || []);
      }
    } catch (err) {
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
      <div className="bg-gradient-to-r from-primary-600 to-amber-600 rounded-2xl p-6 text-white shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ImageIcon className="w-6 h-6" /> Bulk Product Image Management
          </h2>
          <p className="text-xs text-primary-100 mt-1 max-w-xl">
            Quickly assign real photographs to multiple catalog products in batch. Select photos for missing items and save all at once!
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchProducts}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition text-white"
            title="Refresh List"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={handleBulkUploadSubmit}
              disabled={uploading}
              className="bg-white text-primary-700 hover:bg-amber-50 font-bold px-4 py-2 rounded-xl text-sm shadow flex items-center gap-2 transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Save {pendingCount} Photo(s)
            </button>
          )}
        </div>
      </div>

      {/* Uploading Progress */}
      {uploading && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-primary-200 space-y-2">
          <div className="flex justify-between text-xs font-semibold text-primary-900">
            <span>Uploading & Optimizing Product Photographs...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div className="bg-gradient-to-r from-primary-500 to-amber-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products by name or category..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none"
          >
            <option value="missing">Missing Real Photos Only ({products.filter(p => !p.image || p.image.includes('default-product')).length})</option>
            <option value="all">All Catalog Products ({products.length})</option>
            <option value="has_photo">Has Real Photo ({products.filter(p => p.image && !p.image.includes('default-product')).length})</option>
          </select>
        </div>
      </div>

      {/* Products Bulk Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-2" />
            Loading catalog products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-700">No products match the selected filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase border-b border-gray-200">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Current Photograph</th>
                  <th className="py-3 px-4 text-right">Assign New Photograph</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredProducts.map(product => {
                  const pending = pendingUploads[product._id];
                  const hasRealPhoto = product.image && product.image.trim() !== '' && !product.image.includes('default-product');

                  return (
                    <tr key={product._id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-4 font-semibold text-gray-800">
                        {product.name}
                        {product.brand && <span className="text-xs font-normal text-gray-400 block">{product.brand}</span>}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-500 capitalize">
                        {product.category?.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-700">
                        ₹{product.price} / {product.unit}
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                          <ProductImage src={product.image} alt={product.name} showFallbackLabel={false} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {pending ? (
                          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-300 p-1.5 rounded-xl">
                            <img src={pending.previewUrl} alt="Pending" className="w-12 h-12 object-cover rounded-lg" />
                            <div className="text-left">
                              <span className="text-[11px] font-bold text-amber-900 block truncate max-w-[120px]">
                                Ready to upload
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemovePending(product._id)}
                                className="text-[10px] text-red-600 hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg text-xs font-semibold cursor-pointer transition border border-primary-200">
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
