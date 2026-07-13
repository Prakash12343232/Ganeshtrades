import { useState, useEffect } from 'react';
import { getSuppliers, getPurchaseOrders, createSupplier } from '../../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiBox } from 'react-icons/fi';

export default function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', mobile: '', gstNumber: '' });

  const fetchData = () => {
    Promise.all([getSuppliers(), getPurchaseOrders()])
      .then(([sRes, poRes]) => { setSuppliers(sRes.data.data); setPos(poRes.data.data); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    try {
      await createSupplier(form);
      toast.success('Supplier added');
      setShowModal(false);
      setForm({ name: '', mobile: '', gstNumber: '' });
      fetchData();
    } catch (err) { toast.error('Failed'); }
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Suppliers & POs</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700">
          <FiPlus /> New Supplier
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4">Suppliers Directory</h2>
          <div className="space-y-3">
            {suppliers.map(s => (
              <div key={s._id} className="p-4 bg-gray-50 rounded-xl flex justify-between items-center">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-gray-500">📞 {s.mobile} {s.gstNumber && `• GST: ${s.gstNumber}`}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-600">₹{s.balance}</p>
                  <p className="text-xs text-gray-400">Balance</p>
                </div>
              </div>
            ))}
            {suppliers.length === 0 && <p className="text-center text-gray-400 py-4">No suppliers found</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4">Purchase Orders</h2>
          <div className="space-y-3">
            {pos.map(po => (
              <div key={po._id} className="p-4 bg-gray-50 rounded-xl flex justify-between items-center">
                <div>
                  <p className="font-medium text-primary-700">#{po.poNumber}</p>
                  <p className="text-xs text-gray-500">{po.supplier?.name} • {po.items.length} items</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">₹{po.totalAmount}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${po.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{po.status}</span>
                </div>
              </div>
            ))}
            {pos.length === 0 && <p className="text-center text-gray-400 py-4">No purchase orders found</p>}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Add Supplier</h2>
            <form onSubmit={handleCreateSupplier} className="space-y-4">
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Supplier Name" required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              <input type="text" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} placeholder="Mobile Number (10 digits)" required pattern="[6-9][0-9]{9}"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              <input type="text" value={form.gstNumber} onChange={e => setForm({...form, gstNumber: e.target.value})} placeholder="GST Number (Optional)"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-medium">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
