import { useState, useEffect } from 'react';
import { getTodayPriority, updateDeliveryStatus } from '../../services/api';
import toast from 'react-hot-toast';
import { FiTruck, FiMapPin, FiClock, FiCalendar, FiAlertTriangle, FiZap } from 'react-icons/fi';
import { Link } from 'react-router-dom';

export default function AdminDeliveries() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('today'); // late, today, instant, future

  const fetchDeliveries = () => {
    getTodayPriority().then(res => {
      setData(res.data.data);
      if (res.data.data.stats.lateCount > 0) setTab('late');
      else if (res.data.data.stats.todayCount > 0) setTab('today');
      else if (res.data.data.stats.instantCount > 0) setTab('instant');
      else setTab('future');
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchDeliveries(); }, []);

  const handleUpdate = async (id, status) => {
    try {
      await updateDeliveryStatus(id, { status });
      toast.success('Status updated');
      fetchDeliveries();
    } catch (err) { toast.error('Failed to update'); }
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;

  const currentList = data[tab] || [];

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Delivery Management</h1>
          <p className="text-sm text-gray-500 mt-1">Priority list for active and scheduled deliveries.</p>
        </div>
      </div>

      {/* Priority Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <button onClick={() => setTab('late')} className={`p-4 rounded-xl border text-left transition-all ${tab === 'late' ? 'bg-red-500 border-red-600 text-white shadow-lg' : 'bg-white border-red-100 hover:border-red-300'}`}>
          <div className="flex items-center justify-between mb-2">
            <FiAlertTriangle className={tab === 'late' ? 'text-red-200' : 'text-red-500'} />
            <span className={`text-2xl font-bold ${tab === 'late' ? 'text-white' : 'text-red-600'}`}>{data?.stats?.lateCount || 0}</span>
          </div>
          <p className={`font-semibold ${tab === 'late' ? 'text-white' : 'text-gray-800'}`}>Late Deliveries</p>
          <p className={`text-xs mt-1 ${tab === 'late' ? 'text-red-100' : 'text-gray-500'}`}>Scheduled date passed</p>
        </button>

        <button onClick={() => setTab('today')} className={`p-4 rounded-xl border text-left transition-all ${tab === 'today' ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg' : 'bg-white border-indigo-100 hover:border-indigo-300'}`}>
          <div className="flex items-center justify-between mb-2">
            <FiCalendar className={tab === 'today' ? 'text-indigo-200' : 'text-indigo-500'} />
            <span className={`text-2xl font-bold ${tab === 'today' ? 'text-white' : 'text-indigo-600'}`}>{data?.stats?.todayCount || 0}</span>
          </div>
          <p className={`font-semibold ${tab === 'today' ? 'text-white' : 'text-gray-800'}`}>Today's Schedule</p>
          <p className={`text-xs mt-1 ${tab === 'today' ? 'text-indigo-100' : 'text-gray-500'}`}>High priority slots</p>
        </button>

        <button onClick={() => setTab('instant')} className={`p-4 rounded-xl border text-left transition-all ${tab === 'instant' ? 'bg-amber-500 border-amber-600 text-white shadow-lg' : 'bg-white border-amber-100 hover:border-amber-300'}`}>
          <div className="flex items-center justify-between mb-2">
            <FiZap className={tab === 'instant' ? 'text-amber-200' : 'text-amber-500'} />
            <span className={`text-2xl font-bold ${tab === 'instant' ? 'text-white' : 'text-amber-600'}`}>{data?.stats?.instantCount || 0}</span>
          </div>
          <p className={`font-semibold ${tab === 'instant' ? 'text-white' : 'text-gray-800'}`}>Instant Orders</p>
          <p className={`text-xs mt-1 ${tab === 'instant' ? 'text-amber-100' : 'text-gray-500'}`}>Deliver ASAP</p>
        </button>

        <button onClick={() => setTab('future')} className={`p-4 rounded-xl border text-left transition-all ${tab === 'future' ? 'bg-blue-500 border-blue-600 text-white shadow-lg' : 'bg-white border-blue-100 hover:border-blue-300'}`}>
          <div className="flex items-center justify-between mb-2">
            <FiClock className={tab === 'future' ? 'text-blue-200' : 'text-blue-500'} />
            <span className={`text-2xl font-bold ${tab === 'future' ? 'text-white' : 'text-blue-600'}`}>{data?.stats?.futureCount || 0}</span>
          </div>
          <p className={`font-semibold ${tab === 'future' ? 'text-white' : 'text-gray-800'}`}>Upcoming</p>
          <p className={`text-xs mt-1 ${tab === 'future' ? 'text-blue-100' : 'text-gray-500'}`}>Scheduled for later</p>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentList.map(d => (
          <div key={d._id} className={`bg-white rounded-2xl border-2 p-5 shadow-sm transition-all hover:shadow-md ${
            tab === 'late' ? 'border-red-200' : 
            tab === 'today' ? 'border-indigo-200' : 
            tab === 'instant' ? 'border-amber-200' : 'border-gray-100'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="font-bold text-gray-800 flex items-center gap-2">
                  Order #{d.order?.orderNumber}
                </p>
                <div className="mt-1">
                  {d.order?.deliveryType === 'scheduled' ? (
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                      tab === 'late' ? 'bg-red-100 text-red-700' :
                      tab === 'today' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      <FiCalendar /> {new Date(d.order.scheduledDelivery?.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} • {d.order.scheduledDelivery?.timeSlot}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      <FiZap /> Instant
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  d.status === 'delivered' ? 'bg-green-100 text-green-700' :
                  d.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-700'
                }`}>{d.status.replace(/_/g, ' ')}</span>
                <p className="text-sm font-semibold text-primary-600 mt-2">₹{d.order?.finalAmount}</p>
              </div>
            </div>
            
            <div className="space-y-3 mb-4 p-3 bg-gray-50 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-0.5"><FiTruck className="text-gray-400 w-3 h-3" /></div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{d.deliveryPersonName}</p>
                  <p className="text-xs text-gray-500">{d.deliveryPersonMobile}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center flex-shrink-0 mt-0.5"><FiMapPin className="text-gray-400 w-3 h-3" /></div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{d.order?.user?.name} <span className="text-xs text-gray-400 ml-1">({d.order?.distanceFromShop} KM)</span></p>
                  <p className="text-xs text-gray-500 leading-tight mt-0.5">
                    {[d.order?.deliveryAddress?.street, d.order?.deliveryAddress?.area].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            </div>

            {d.status !== 'delivered' && d.status !== 'failed' && (
              <div className="flex gap-2 pt-4 border-t border-gray-100">
                {d.status === 'assigned' && <button onClick={() => handleUpdate(d._id, 'picked_up')} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors">Mark Picked Up</button>}
                {d.status === 'picked_up' && <button onClick={() => handleUpdate(d._id, 'on_the_way')} className="flex-1 py-2 bg-purple-50 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors">On The Way</button>}
                {d.status === 'on_the_way' && <button onClick={() => handleUpdate(d._id, 'delivered')} className="flex-1 py-2 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors">Mark Delivered</button>}
              </div>
            )}
          </div>
        ))}
        {currentList.length === 0 && (
          <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-gray-100">
            <span className="text-4xl block mb-3">📭</span>
            <p className="text-gray-500 font-medium">No deliveries in this queue</p>
          </div>
        )}
      </div>
    </div>
  );
}
