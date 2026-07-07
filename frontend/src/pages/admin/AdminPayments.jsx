import { useState, useEffect } from 'react';
import { getPayments, getPendingPayments, createPayment } from '../../services/api';
import toast from 'react-hot-toast';
import { FiDollarSign, FiPlus, FiX } from 'react-icons/fi';

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [pending, setPending] = useState([]);
  const [tab, setTab] = useState('payments');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPayments({ limit: 50 }), getPendingPayments()])
      .then(([pRes, pendRes]) => { setPayments(pRes.data.data); setPending(pendRes.data.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Payments</h1>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('payments')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'payments' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'}`}>All Payments</button>
        <button onClick={() => setTab('pending')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'pending' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'}`}>
          Pending ({pending.length})
        </button>
      </div>

      {tab === 'payments' ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-500">Customer</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Order</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Amount</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Method</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
              </tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p._id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{p.user?.name}<br /><span className="text-xs text-gray-400">{p.user?.mobile}</span></td>
                    <td className="py-3 px-4">#{p.order?.orderNumber}</td>
                    <td className="py-3 px-4 font-semibold text-primary-600">₹{p.amount}</td>
                    <td className="py-3 px-4 capitalize">{p.paymentMethod}</td>
                    <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${p.paymentStatus === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.paymentStatus}</span></td>
                    <td className="py-3 px-4 text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payments.length === 0 && <div className="text-center py-10 text-gray-400">No payments found</div>}
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(u => (
            <div key={u._id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600"><FiDollarSign /></div>
                <div><p className="font-medium">{u.name}</p><p className="text-xs text-gray-400">{u.mobile} • {u.customerType?.replace(/_/g, '/')}</p></div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-red-600">₹{u.pendingAmount}</p>
                <p className="text-xs text-gray-400">pending</p>
              </div>
            </div>
          ))}
          {pending.length === 0 && <div className="text-center py-10 text-gray-400 bg-white rounded-xl">No pending payments 🎉</div>}
        </div>
      )}
    </div>
  );
}
