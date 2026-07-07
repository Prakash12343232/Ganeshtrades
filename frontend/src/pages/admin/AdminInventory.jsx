import { useState, useEffect } from 'react';
import { getLowStock, updateStock } from '../../services/api';
import toast from 'react-hot-toast';
import { FiAlertTriangle, FiPlus, FiMinus } from 'react-icons/fi';

export default function AdminInventory() {
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLowStock = () => {
    getLowStock().then(res => setLowStock(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchLowStock(); }, []);

  const handleStockUpdate = async (id, amount, action) => {
    try {
      await updateStock(id, { stock: amount, action });
      toast.success('Stock updated');
      fetchLowStock();
    } catch (err) { toast.error('Failed'); }
  };

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Inventory Management</h1>

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
        <div className="space-y-4">
          {lowStock.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <span className="text-5xl mb-4 block">✅</span>
              <p className="text-gray-500 text-lg">All products are well-stocked!</p>
            </div>
          ) : (
            lowStock.map(product => (
              <div key={product._id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${product.stock === 0 ? 'bg-red-100' : 'bg-orange-100'}`}>
                    {product.stock === 0 ? '🚫' : '⚠️'}
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
                    <button onClick={() => handleStockUpdate(product._id, 10, 'add')} className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200">+10</button>
                    <button onClick={() => handleStockUpdate(product._id, 50, 'add')} className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200">+50</button>
                    <button onClick={() => handleStockUpdate(product._id, 100, 'add')} className="px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200">+100</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
