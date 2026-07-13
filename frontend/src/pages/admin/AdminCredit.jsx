import { useState, useEffect } from 'react';
import { getUsers, createSettlement } from '../../services/api';
import toast from 'react-hot-toast';
import { FiBookOpen, FiDollarSign } from 'react-icons/fi';

export default function AdminCredit() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const fetchCreditCustomers = () => {
    // Ideally we filter backend, but for simplicity here we fetch all and filter client side
    getUsers({ limit: 100 }).then(res => {
      const creditUsers = res.data.data.filter(u => u.creditBalance > 0 || u.creditLimit > 0);
      setCustomers(creditUsers);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchCreditCustomers(); }, []);

  const handleSettlement = async (e) => {
    e.preventDefault();
    try {
      await createSettlement({
        userId: selectedUser._id,
        amount: Number(settleAmount),
        paymentMethod
      });
      toast.success('Settlement recorded');
      setSelectedUser(null);
      setSettleAmount('');
      fetchCreditCustomers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Credit (Khata) System</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {customers.map(c => (
          <div key={c._id} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold">{c.name[0]}</div>
                <div>
                  <h3 className="font-semibold text-gray-800">{c.name}</h3>
                  <p className="text-xs text-gray-400 capitalize">{c.customerType}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4 text-center">
              <div className="bg-red-50 p-2 rounded-lg">
                <p className="text-lg font-bold text-red-600">₹{c.creditBalance}</p>
                <p className="text-xs text-gray-500">Balance Owed</p>
              </div>
              <div className="bg-green-50 p-2 rounded-lg">
                <p className="text-lg font-bold text-green-600">₹{c.creditLimit}</p>
                <p className="text-xs text-gray-500">Credit Limit</p>
              </div>
            </div>
            {c.creditBalance > 0 && (
              <button onClick={() => { setSelectedUser(c); setSettleAmount(c.creditBalance); }} 
                className="w-full py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 flex items-center justify-center gap-2">
                <FiDollarSign /> Settle Payment
              </button>
            )}
          </div>
        ))}
        {customers.length === 0 && <div className="col-span-full text-center py-10 text-gray-400">No credit accounts found</div>}
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Settle Khata - {selectedUser.name}</h2>
            <form onSubmit={handleSettlement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="number" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} max={selectedUser.creditBalance} required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400">
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setSelectedUser(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-medium">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
