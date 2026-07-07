import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getOrder, cancelOrder, downloadInvoice } from '../../services/api';
import toast from 'react-hot-toast';
import { FiDownload, FiX, FiCheck, FiClock, FiTruck, FiPackage } from 'react-icons/fi';

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered'];
const STEP_ICONS = { pending: <FiClock />, confirmed: <FiCheck />, processing: <FiPackage />, out_for_delivery: <FiTruck />, delivered: <FiCheck /> };

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrder(id).then(res => setOrder(res.data.data)).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [id]);

  const handleCancel = async () => {
    if (!confirm('Cancel this order?')) return;
    try {
      await cancelOrder(id, { reason: 'Cancelled by customer' });
      toast.success('Order cancelled');
      const { data } = await getOrder(id);
      setOrder(data.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDownloadInvoice = async () => {
    try {
      const res = await downloadInvoice(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${order.orderNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Invoice downloaded!');
    } catch (err) { toast.error('Failed to download invoice'); }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>;
  if (!order) return <div className="text-center py-20 text-gray-500">Order not found</div>;

  const currentStep = STATUS_STEPS.indexOf(order.orderStatus);

  return (
    <div className="animate-fadeIn space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Order #{order.orderNumber}</h1>
            <p className="text-sm text-gray-400 mt-1">{new Date(order.createdAt).toLocaleString('en-IN')}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleDownloadInvoice} className="flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-200 transition-all" id="download-invoice">
              <FiDownload /> Invoice
            </button>
            {!['delivered', 'cancelled'].includes(order.orderStatus) && (
              <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 transition-all">
                <FiX /> Cancel
              </button>
            )}
          </div>
        </div>

        {/* Status Tracker */}
        {order.orderStatus !== 'cancelled' && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              {STATUS_STEPS.map((step, i) => (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${i <= currentStep ? 'bg-primary-600 text-white shadow-lg' : 'bg-gray-200 text-gray-400'}`}>
                    {STEP_ICONS[step]}
                  </div>
                  <span className={`text-xs mt-2 capitalize ${i <= currentStep ? 'text-primary-600 font-medium' : 'text-gray-400'}`}>{step.replace(/_/g, ' ')}</span>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`h-0.5 w-full mt-[-22px] mb-[22px] ${i < currentStep ? 'bg-primary-600' : 'bg-gray-200'}`} style={{ position: 'absolute' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {order.orderStatus === 'cancelled' && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg text-red-600 text-sm">❌ Order cancelled. {order.cancelReason && `Reason: ${order.cancelReason}`}</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4">Order Items</h2>
          <div className="space-y-3">
            {order.items?.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center text-lg">📦</div>
                  <div><p className="font-medium text-sm">{item.name}</p><p className="text-xs text-gray-400">₹{item.price} × {item.quantity}</p></div>
                </div>
                <span className="font-bold text-gray-800">₹{item.total?.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t mt-4 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{order.totalAmount?.toFixed(2)}</span></div>
            {order.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{order.discount?.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-lg text-gray-800 pt-2 border-t"><span>Total</span><span className="text-primary-600">₹{order.finalAmount?.toFixed(2)}</span></div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 mb-3">Payment</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Method</span><span className="capitalize">{order.paymentMethod}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span>
                <span className={`capitalize font-medium ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-orange-500'}`}>{order.paymentStatus}</span>
              </div>
            </div>
          </div>

          {order.deliveryAddress && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-3">Delivery Address</h3>
              <p className="text-sm text-gray-600">
                {[order.deliveryAddress.street, order.deliveryAddress.area, order.deliveryAddress.city, order.deliveryAddress.pincode].filter(Boolean).join(', ')}
              </p>
            </div>
          )}

          {order.notes && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-2">Notes</h3>
              <p className="text-sm text-gray-600">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
