import { useState, useEffect } from 'react';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../../services/api';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiEdit2 } from 'react-icons/fi';

const CATEGORIES = ['electricity', 'salary', 'transport', 'maintenance', 'miscellaneous', 'supplies'];

const EMPTY_FORM = { category: 'miscellaneous', amount: '', description: '' };

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });

  const fetchExpenses = (page = 1) => {
    getExpenses({ page, limit: 50 }).then(res => {
      setExpenses(res.data.data);
      setPagination(res.data.pagination);
    }).catch(() => toast.error('Failed to load expenses')).finally(() => setLoading(false));
  };

  useEffect(() => { fetchExpenses(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateExpense(editingId, form);
        toast.success('Expense updated');
      } else {
        await createExpense(form);
        toast.success('Expense recorded');
      }
      setShowModal(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      fetchExpenses(pagination.page);
    } catch { toast.error('Failed to save expense'); }
  };

  const openEdit = (exp) => {
    setEditingId(exp._id);
    setForm({ category: exp.category, amount: exp.amount, description: exp.description });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await deleteExpense(id);
      toast.success('Deleted');
      fetchExpenses(pagination.page);
    } catch { toast.error('Failed'); }
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
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(exp)} title="Edit expense" className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"><FiEdit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(exp._id)} title="Delete expense" className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"><FiTrash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan="6" className="text-center py-6 text-gray-400">No expenses recorded</td></tr>}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 p-4 border-t border-gray-100">
            <span className="text-xs text-gray-400 mr-2">Page {pagination.page} of {pagination.pages}</span>
            {Array.from({ length: pagination.pages }, (_, i) => (
              <button key={i + 1} onClick={() => fetchExpenses(i + 1)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${pagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Expense' : 'Record Expense'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="expense-category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select id="expense-category" value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 capitalize">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="expense-amount" className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <input id="expense-amount" type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required min="1"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div>
                <label htmlFor="expense-description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea id="expense-description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} required rows="2"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={closeModal} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-medium">{editingId ? 'Save' : 'Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}