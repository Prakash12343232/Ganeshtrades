import { useState, useEffect } from 'react';
import { getSuppliers, getPurchaseOrders, createSupplier, createPurchaseOrder, receivePurchaseOrder, createSupplierPayment, getProducts } from '../../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiTruck, FiDollarSign } from 'react-icons/fi';

export default function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [pos, setPos] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(null);
  const [form, setForm] = useState({ name: '', mobile: '', gstNumber: '' });
  const [poForm, setPoForm] = useState({ supplierId: '', expectedDelivery: '', notes: '' });
  const [poItems, setPoItems] = useState([]);
  const [payForm, setPayForm] = useState({ amount: '', paymentMethod: 'cash', referenceNumber: '', notes: '' });
  const [receivingId, setReceivingId] = useState(null);

  const fetchData = () => {
    Promise.all([getSuppliers(), getPurchaseOrders()])
      .then(([sRes, poRes]) => { setSuppliers(sRes.data.data); setPos(poRes.data.data); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    getProducts({ status: 'all', limit: 500 }).then(res => setProducts(res.data.data)).catch(() => {});
  }, []);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    try {
      await createSupplier(form);
      toast.success('Supplier added');
      setShowSupplierModal(false);
      setForm({ name: '', mobile: '', gstNumber: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const addPoItem = () => {
    setPoItems([...poItems, { product: '', quantity: 1, unitPrice: '' }]);
  };

  const updatePoItem = (idx, field, value) => {
    setPoItems(poItems.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      if (field === 'product') {
        const prod = products.find(p => p._id === value);
        if (prod) updated.unitPrice = prod.wholesalePrice || prod.price;
      }
      return updated;
    }));
  };

  const removePoItem = (idx) => setPoItems(poItems.filter((_, i) => i !== idx));

  const poTotal = poItems.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unitPrice) || 0), 0);

  const handleCreatePO = async (e) => {
    e.preventDefault();
    const validItems = poItems.filter(it => it.product && it.quantity > 0 && Number(it.unitPrice) > 0);
    if (validItems.length === 0) { toast.error('Add at least one product with quantity and price'); return; }
    try {
      await createPurchaseOrder({
        supplierId: poForm.supplierId,
        items: validItems.map(it => ({ product: it.product, quantity: it.quantity, unitPrice: it.unitPrice })),
        expectedDelivery: poForm.expectedDelivery || undefined,
        notes: poForm.notes || undefined
      });
      toast.success('Purchase order created');
      setShowPOModal(false);
      setPoForm({ supplierId: '', expectedDelivery: '', notes: '' });
      setPoItems([]);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleReceivePO = async (poId) => {
    setReceivingId(poId);
    try {
      await receivePurchaseOrder(poId);
      toast.success('PO received — stock updated');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setReceivingId(null);
    }
  };

  const handlePaySupplier = async (e) => {
    e.preventDefault();
    try {
      await createSupplierPayment({
        supplierId: showPaymentModal._id,
        amount: payForm.amount,
        paymentMethod: payForm.paymentMethod,
        referenceNumber: payForm.referenceNumber || undefined,
        notes: payForm.notes || undefined
      });
      toast.success('Payment recorded');
      setShowPaymentModal(null);
      setPayForm({ amount: '', paymentMethod: 'cash', referenceNumber: '', notes: '' });
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const statusBadge = (status) => {
    const map = {
      received: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-blue-100 text-blue-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${map[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>;
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Suppliers & POs</h1>
        <div className="flex gap-3">
          <button onClick={() => setShowPOModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
            <FiTruck /> Create PO
          </button>
          <button onClick={() => setShowSupplierModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700">
            <FiPlus /> New Supplier
          </button>
        </div>
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
                  <div className="flex items-center justify-end gap-2">
                    <p className="text-xs text-gray-400">Balance</p>
                    <button onClick={() => setShowPaymentModal(s)} disabled={s.balance <= 0}
                      className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${s.balance > 0 ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                      <FiDollarSign /> Pay
                    </button>
                  </div>
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
              <div key={po._id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-primary-700">#{po.poNumber}</p>
                    <p className="text-xs text-gray-500">{po.supplier?.name} • {po.items.length} items</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">₹{po.totalAmount}</p>
                    {statusBadge(po.status)}
                  </div>
                </div>
                {po.status === 'pending' && (
                  <div className="mt-3 flex justify-end">
                    <button onClick={() => handleReceivePO(po._id)} disabled={receivingId === po._id}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                      <FiTruck /> {receivingId === po._id ? 'Receiving...' : 'Receive PO'}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {pos.length === 0 && <p className="text-center text-gray-400 py-4">No purchase orders found</p>}
          </div>
        </div>
      </div>

      {/* New Supplier Modal */}
      {showSupplierModal && (
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
                <button type="button" onClick={() => setShowSupplierModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-medium">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create PO Modal */}
      {showPOModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 my-8">
            <h2 className="text-xl font-bold mb-4">Create Purchase Order</h2>
            <form onSubmit={handleCreatePO} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label htmlFor="po-supplier" className="block text-xs font-medium text-gray-500 mb-1">Supplier *</label>
                  <select id="po-supplier" value={poForm.supplierId} onChange={e => setPoForm({...poForm, supplierId: e.target.value})} required
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                    <option value="">Select supplier</option>
                    {suppliers.filter(s => s.status === 'active').map(s => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="po-delivery" className="block text-xs font-medium text-gray-500 mb-1">Expected Delivery</label>
                  <input id="po-delivery" type="date" value={poForm.expectedDelivery} onChange={e => setPoForm({...poForm, expectedDelivery: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
                <div>
                  <label htmlFor="po-notes" className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                  <input id="po-notes" type="text" value={poForm.notes} onChange={e => setPoForm({...poForm, notes: e.target.value})} placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Items</p>
                  <button type="button" onClick={addPoItem} className="text-sm px-3 py-1.5 bg-primary-50 text-primary-600 rounded-lg font-medium hover:bg-primary-100">
                    + Add item
                  </button>
                </div>
                {poItems.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <select aria-label="Product" value={it.product} onChange={e => updatePoItem(idx, 'product', e.target.value)} required
                      className="col-span-5 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                      <option value="">Product</option>
                      {products.filter(p => p.status !== 'inactive').map(p => (
                        <option key={p._id} value={p._id}>{p.name} ({p.unit})</option>
                      ))}
                    </select>
                    <input type="number" min="1" value={it.quantity} onChange={e => updatePoItem(idx, 'quantity', Number(e.target.value))} placeholder="Qty"
                      className="col-span-2 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                    <input type="number" min="0" step="0.01" value={it.unitPrice} onChange={e => updatePoItem(idx, 'unitPrice', Number(e.target.value))} placeholder="₹/unit"
                      className="col-span-3 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                    <button type="button" onClick={() => removePoItem(idx)} className="col-span-2 text-red-500 text-sm hover:text-red-700">Remove</button>
                  </div>
                ))}
                {poItems.length === 0 && <p className="text-xs text-gray-400">No items added yet</p>}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-sm font-semibold text-gray-700">Total: <span className="text-primary-600">₹{poTotal.toLocaleString('en-IN')}</span></span>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowPOModal(false)} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm">Cancel</button>
                  <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700">Create PO</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-1">Pay {showPaymentModal.name}</h2>
            <p className="text-sm text-gray-500 mb-4">Outstanding balance: <span className="font-semibold text-red-600">₹{showPaymentModal.balance}</span></p>
            <form onSubmit={handlePaySupplier} className="space-y-4">
              <input type="number" min="1" max={showPaymentModal.balance} step="0.01" value={payForm.amount} onChange={e => setPayForm({...payForm, amount: e.target.value})} placeholder="Amount" required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              <select value={payForm.paymentMethod} onChange={e => setPayForm({...payForm, paymentMethod: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="upi">UPI</option>
              </select>
              <input type="text" value={payForm.referenceNumber} onChange={e => setPayForm({...payForm, referenceNumber: e.target.value})} placeholder="Reference Number (Optional)"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              <input type="text" value={payForm.notes} onChange={e => setPayForm({...payForm, notes: e.target.value})} placeholder="Notes (Optional)"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowPaymentModal(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}