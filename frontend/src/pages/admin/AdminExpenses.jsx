import { useState, useEffect } from 'react';
import { getExpenses, createExpense, deleteExpense } from '../../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiFileText } from 'react-icons/fi';

const CATEGORIES = ['electricity', 'salary', 'transport', 'maintenance', 'miscellaneous', 'supplies'];

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ category: 'miscellaneous', amount: '', description: '' });

  const fetchExpenses = () => {
    getExpenses().then(res => setExpenses(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchExpenses(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createExpense(form);
      toast.success('Expense recorded');
      setShowModal(false);
      setForm({ category: 'miscellaneous', amount: '', description: '' });
      fetchExpenses();
    } catch (err) { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await deleteExpense(id);
      toast.success('Deleted');
      fetchExpenses();
    } catch (err) { toast.error('Failed'); }
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Expenses</h1>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700">
          <FiPlus /> Record Expense
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b">
              <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Category</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Description</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Logged By</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Amount</th>
              <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
            </tr></thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp._id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-4">{new Date(exp.date).toLocaleDateString('en-IN')}</td>
                  <td className="py-3 px-4 capitalize"><span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs">{exp.category}</span></td>
                  <td className="py-3 px-4">{exp.description}</td>
                  <td className="py-3 px-4">{exp.loggedBy?.name}</td>
                  <td className="py-3 px-4 font-bold text-red-600">₹{exp.amount}</td>
                  <td className="py-3 px-4">
                    <button onClick={() => handleDelete(exp._id)} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"><FiTrash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan="6" className="text-center py-6 text-gray-400">No expenses recorded</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Record Expense</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 capitalize">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required min="1"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} required rows="2"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-medium">Record</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
