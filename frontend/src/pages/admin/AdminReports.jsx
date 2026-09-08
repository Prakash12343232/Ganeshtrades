import { useState, useEffect, useCallback } from 'react';
import { getSalesReport, getProfitLoss, exportOrders, exportProducts } from '../../services/api';
import toast from 'react-hot-toast';
import { FiDownload } from 'react-icons/fi';

export default function AdminReports() {
  const [tab, setTab] = useState('sales');
  const [report, setReport] = useState(null);
  const [period, setPeriod] = useState('daily');
  const [pl, setPl] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab !== 'sales') return;
    setLoading(true);
    getSalesReport({ period }).then(res => setReport(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, [period, tab]);

  const fetchProfitLoss = useCallback(() => {
    setLoading(true);
    getProfitLoss({ startDate, endDate })
      .then(res => setPl(res.data.data))
      .catch(() => toast.error('Failed to load profit & loss'))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  useEffect(() => {
    if (tab !== 'profitloss') return;
    fetchProfitLoss();
  }, [tab, fetchProfitLoss]);

  const handleExportOrders = async () => {
    try {
      const res = await exportOrders();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'orders-report.xlsx');
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('Orders exported!');
    } catch { toast.error('Export failed'); }
  };

  const handleExportProducts = async () => {
    try {
      const res = await exportProducts();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'products-report.xlsx');
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('Products exported!');
    } catch { toast.error('Export failed'); }
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
        <div className="flex gap-3">
          <button onClick={handleExportOrders} className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-xl text-sm font-medium hover:bg-green-200"><FiDownload /> Export Orders</button>
          <button onClick={handleExportProducts} className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-200"><FiDownload /> Export Products</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('sales')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'sales' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'}`}>Sales Report</button>
        <button onClick={() => setTab('profitloss')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'profitloss' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'}`}>Profit &amp; Loss</button>
      </div>

      {tab === 'sales' && (
        <>
          {/* Period selector */}
          <div className="flex gap-2">
            {['daily', 'weekly', 'monthly'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${period === p ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border'}`}>{p}</button>
            ))}
          </div>

          {/* Summary Cards */}
          {report && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <p className="text-sm text-gray-500">Total Orders</p>
                <p className="text-3xl font-bold text-primary-600 mt-2">{report.totalOrders}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <p className="text-sm text-gray-500">Total Revenue</p>
                <p className="text-3xl font-bold text-green-600 mt-2">₹{report.totalRevenue?.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <p className="text-sm text-gray-500">Avg Order Value</p>
                <p className="text-3xl font-bold text-emerald-600 mt-2">₹{report.totalOrders ? Math.round(report.totalRevenue / report.totalOrders) : 0}</p>
              </div>
            </div>
          )}

          {/* Orders Table */}
          {report?.orders?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-bold text-gray-800 mb-4">Orders ({period})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Order</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Customer</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                  </tr></thead>
                  <tbody>
                    {report.orders.slice(0, 20).map(o => (
                      <tr key={o._id} className="border-b border-gray-50">
                        <td className="py-3 px-4 font-medium">#{o.orderNumber}</td>
                        <td className="py-3 px-4">{o.user?.name}</td>
                        <td className="py-3 px-4 font-semibold text-primary-600">₹{o.finalAmount}</td>
                        <td className="py-3 px-4 capitalize text-xs">{o.orderStatus?.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-4 text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'profitloss' && (
        <>
          {/* Date range selector */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <button onClick={fetchProfitLoss} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
              Apply
            </button>
          </div>

          {loading && pl === null && <div className="text-center py-10 text-gray-400">Loading...</div>}

          {pl && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <p className="text-sm text-gray-500">Revenue</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">₹{pl.revenue?.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <p className="text-sm text-gray-500">Expenses</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">₹{pl.totalExpenses?.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                  <p className="text-sm text-gray-500">Cost of Goods</p>
                  <p className="text-3xl font-bold text-orange-600 mt-2">₹{pl.costOfGoods?.toLocaleString('en-IN')}</p>
                </div>
                <div className={`bg-white rounded-2xl border p-6 ${pl.netProfit >= 0 ? 'border-emerald-100' : 'border-red-100'}`}>
                  <p className="text-sm text-gray-500">Net Profit</p>
                  <p className={`text-3xl font-bold mt-2 ${pl.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ₹{pl.netProfit?.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="font-bold text-gray-800 mb-4">Breakdown</h2>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-600">Revenue from delivered orders</span>
                    <span className="text-sm font-semibold text-green-600">₹{pl.revenue?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-600">Total expenses</span>
                    <span className="text-sm font-semibold text-red-600">−₹{pl.totalExpenses?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-600">Cost of goods (POs received)</span>
                    <span className="text-sm font-semibold text-orange-600">−₹{pl.costOfGoods?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm font-medium text-gray-800">Net Profit</span>
                    <span className={`text-sm font-bold ${pl.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ₹{pl.netProfit?.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}