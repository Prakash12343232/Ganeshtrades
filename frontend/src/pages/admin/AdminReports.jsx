import { useState, useEffect } from 'react';
import { getSalesReport, exportOrders, exportProducts } from '../../services/api';
import toast from 'react-hot-toast';
import { FiDownload, FiCalendar } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminReports() {
  const [report, setReport] = useState(null);
  const [period, setPeriod] = useState('daily');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSalesReport({ period }).then(res => setReport(res.data.data)).catch(() => {}).finally(() => setLoading(false));
  }, [period]);

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
            <p className="text-3xl font-bold text-indigo-600 mt-2">₹{report.totalOrders ? Math.round(report.totalRevenue / report.totalOrders) : 0}</p>
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
    </div>
  );
}
