import { useState, useEffect } from 'react';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiImage } from 'react-icons/fi';
import ProductImage from '../../components/common/ProductImage';
import ProductImageUploader from '../../components/admin/ProductImageUploader';
import BulkImageManager from '../../components/admin/BulkImageManager';

const CATEGORIES = [
  'rice_grains','dal_pulses','spices','oil_ghee','flour','sugar_jaggery',
  'tea_coffee','snacks','beverages','dairy','fruits','vegetables','dry_fruits',
  'cleaning','personal_care','packaged_food','bakery','frozen','other'
];

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'bulk_images'
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [photoModalProduct, setPhotoModalProduct] = useState(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'rice_grains',
    price: '',
    wholesalePrice: '',
    stock: '',
    minStock: '10',
    unit: 'kg',
    brand: ''
  });

  const fetchProducts = () => {
    getProducts({ limit: 150, status: '' })
      .then(res => setProducts(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: '',
      description: '',
      category: 'rice_grains',
      price: '',
      wholesalePrice: '',
      stock: '',
      minStock: '10',
      unit: 'kg',
      brand: ''
    });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || '',
      category: p.category,
      price: p.price,
      wholesalePrice: p.wholesalePrice || '',
      stock: p.stock,
      minStock: p.minStock,
      unit: p.unit,
      brand: p.brand || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateProduct(editing._id, form);
        toast.success('Product updated');
      } else {
        await createProduct(form);
        toast.success('Product created');
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this product?')) return;
    try {
      await deleteProduct(id);
      toast.success('Product removed');
      fetchProducts();
    } catch (err) {
      toast.error('Failed');
    }
  };

  return (
    <div className="animate-fadeIn space-y-6">
      {/* Top Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Product Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage products and upload real product photographs</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-gray-100 p-1 rounded-xl flex gap-1 border border-gray-200">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'catalog' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Catalog List ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('bulk_images')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'bulk_images' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FiImage className="w-3.5 h-3.5 text-amber-500" /> Bulk Photos Uploader
            </button>
          </div>

          {activeTab === 'catalog' && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 shadow-sm"
              id="add-product"
            >
              <FiPlus /> Add Product
            </button>
          )}
        </div>
      </div>

      {/* Main Content View */}
      {activeTab === 'bulk_images' ? (
        <BulkImageManager />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 text-xs font-semibold uppercase">
                  <th className="py-3 px-4 text-left">Photo</th>
                  <th className="text-left py-3 px-4">Product</th>
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-left py-3 px-4">Price</th>
                  <th className="text-left py-3 px-4">Wholesale</th>
                  <th className="text-left py-3 px-4">Stock</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-center py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map(p => {
                  const hasPhoto = p.image && p.image.trim() !== '' && !p.image.includes('default-product');
                  return (
                    <tr key={p._id} className="hover:bg-gray-50/80 transition">
                      <td className="py-2.5 px-4">
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 relative group">
                          <ProductImage src={p.image} alt={p.name} showFallbackLabel={false} />
                          <button
                            type="button"
                            onClick={() => setPhotoModalProduct(p)}
                            className="absolute inset-0 bg-black/60 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                            title="Manage Photos"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{p.name}</div>
                        {p.brand && <div className="text-xs text-gray-400">{p.brand}</div>}
                      </td>
                      <td className="py-3 px-4 capitalize text-xs text-gray-600">{p.category?.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-4 font-medium">₹{p.price}/{p.unit}</td>
                      <td className="py-3 px-4 text-gray-500">{p.wholesalePrice ? `₹${p.wholesalePrice}` : '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`font-semibold ${p.stock <= p.minStock ? 'text-red-600' : 'text-emerald-600'}`}>
                          {p.stock}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          p.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                          p.status === 'out_of_stock' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {p.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setPhotoModalProduct(p)}
                            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition ${
                              hasPhoto
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}
                            title="Upload / Manage Real Photograph"
                          >
                            <FiImage className="w-3.5 h-3.5" />
                            {hasPhoto ? 'Photo' : 'Upload'}
                          </button>
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
                            title="Edit Product Details"
                          >
                            <FiEdit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p._id)}
                            className="p-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition"
                            title="Remove Product"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 animate-fadeIn shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h2 className="text-xl font-bold text-gray-800">{editing ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><FiX className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                  placeholder="e.g. Royal Basmati Rice (1kg)"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                  placeholder="Describe product quality, origin, packaging..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Category *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({...form, category: e.target.value})}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 capitalize text-sm"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Unit *</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm({...form, unit: e.target.value})}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                  >
                    {['kg','g','l','ml','piece','packet','dozen','box'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Retail Price (₹) *</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm({...form, price: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                    placeholder="Price ₹"
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Wholesale Price (₹)</label>
                  <input
                    type="number"
                    value={form.wholesalePrice}
                    onChange={e => setForm({...form, wholesalePrice: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                    placeholder="Wholesale ₹"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Stock *</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={e => setForm({...form, stock: e.target.value})}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                    placeholder="Stock"
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Min Stock</label>
                  <input
                    type="number"
                    value={form.minStock}
                    onChange={e => setForm({...form, minStock: e.target.value})}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                    placeholder="Alert level"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Brand</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={e => setForm({...form, brand: e.target.value})}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm"
                    placeholder="Brand name"
                  />
                </div>
              </div>

              {/* In-Modal Image Management */}
              {editing && (
                <div className="border-t pt-4 mt-2">
                  <ProductImageUploader
                    productId={editing._id}
                    existingImages={editing.images || (editing.image ? [editing.image] : [])}
                    primaryImage={editing.image}
                    onImagesUpdated={(updatedProduct) => {
                      setEditing(updatedProduct);
                      fetchProducts();
                    }}
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 shadow-md transition"
              >
                {editing ? 'Update Product' : 'Add Product'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Standalone Quick Photo Upload Modal */}
      {photoModalProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Upload Product Photograph</h3>
                <p className="text-xs text-gray-500">{photoModalProduct.name}</p>
              </div>
              <button onClick={() => setPhotoModalProduct(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><FiX className="w-5 h-5" /></button>
            </div>

            <ProductImageUploader
              productId={photoModalProduct._id}
              existingImages={photoModalProduct.images || (photoModalProduct.image ? [photoModalProduct.image] : [])}
              primaryImage={photoModalProduct.image}
              onImagesUpdated={(updatedProduct) => {
                setPhotoModalProduct(updatedProduct);
                fetchProducts();
              }}
            />

            <div className="mt-6 pt-3 border-t text-right">
              <button
                type="button"
                onClick={() => setPhotoModalProduct(null)}
                className="px-5 py-2 bg-gray-800 text-white rounded-xl text-xs font-semibold hover:bg-gray-900 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
