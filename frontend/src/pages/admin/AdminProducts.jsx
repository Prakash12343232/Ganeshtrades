import { useState, useEffect } from 'react';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';

const CATEGORIES = ['rice_grains','dal_pulses','spices','oil_ghee','flour','sugar_jaggery','tea_coffee','snacks','beverages','dairy','fruits','vegetables','dry_fruits','cleaning','personal_care','packaged_food','bakery','frozen','other'];

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', category: 'rice_grains', price: '', wholesalePrice: '', stock: '', minStock: '10', unit: 'kg', brand: '' });

  const fetchProducts = () => {
    getProducts({ limit: 100, status: '' }).then(res => setProducts(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const openAdd = () => { setEditing(null); setForm({ name: '', description: '', category: 'rice_grains', price: '', wholesalePrice: '', stock: '', minStock: '10', unit: 'kg', brand: '' }); setShowModal(true); };
  const openEdit = (p) => { setEditing(p); setForm({ name: p.name, description: p.description || '', category: p.category, price: p.price, wholesalePrice: p.wholesalePrice || '', stock: p.stock, minStock: p.minStock, unit: p.unit, brand: p.brand || '' }); setShowModal(true); };

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
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this product?')) return;
    try { await deleteProduct(id); toast.success('Product removed'); fetchProducts(); }
    catch (err) { toast.error('Failed'); }
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Products ({products.length})</h1>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700" id="add-product"><FiPlus /> Add Product</button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b">
              <th className="text-left py-3 px-4 font-medium text-gray-500">Product</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Category</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Price</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Wholesale</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Stock</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Sold</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
            </tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p._id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{p.name}</td>
                  <td className="py-3 px-4 capitalize text-xs">{p.category?.replace(/_/g, ' ')}</td>
                  <td className="py-3 px-4">₹{p.price}/{p.unit}</td>
                  <td className="py-3 px-4">{p.wholesalePrice ? `₹${p.wholesalePrice}` : '-'}</td>
                  <td className="py-3 px-4"><span className={`font-medium ${p.stock <= p.minStock ? 'text-red-600' : 'text-green-600'}`}>{p.stock}</span></td>
                  <td className="py-3 px-4">{p.totalSold}</td>
                  <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${p.status === 'active' ? 'bg-green-100 text-green-700' : p.status === 'out_of_stock' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{p.status?.replace(/_/g, ' ')}</span></td>
                  <td className="py-3 px-4">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"><FiEdit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(p._id)} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"><FiTrash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Product Name" required />
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Description" rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 capitalize">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                </select>
                <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400">
                  {['kg','g','l','ml','piece','packet','dozen','box'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Price (₹)" required min="0" />
                <input type="number" value={form.wholesalePrice} onChange={e => setForm({...form, wholesalePrice: e.target.value})}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Wholesale Price" min="0" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Stock" required min="0" />
                <input type="number" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Min Stock" min="0" />
                <input type="text" value={form.brand} onChange={e => setForm({...form, brand: e.target.value})}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="Brand" />
              </div>
              <button type="submit" className="w-full py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700">
                {editing ? 'Update Product' : 'Add Product'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
