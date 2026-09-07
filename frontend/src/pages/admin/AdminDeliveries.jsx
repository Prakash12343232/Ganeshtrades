import { useState, useEffect, useCallback } from 'react';
import { getTodayPriority, updateDeliveryStatus, getDeliveries } from '../../services/api';
import toast from 'react-hot-toast';
import { FiTruck, FiMapPin, FiClock, FiCalendar, FiAlertTriangle, FiZap, FiGrid, FiList } from 'react-icons/fi';

const DELIVERY_STATUSES = ['assigned', 'picked_up', 'on_the_way', 'delivered', 'failed'];
const TIME_SLOTS = [
  '8 AM - 10 AM', '10 AM - 12 PM', '12 PM - 2 PM',
  '2 PM - 4 PM', '4 PM - 6 PM', '6 PM - 8 PM', '8 PM - 10 PM'
];
const HISTORY_STATUS_COLORS = {
  assigned: 'bg-blue-100 text-blue-700',
  picked_up: 'bg-amber-100 text-amber-700',
  on_the_way: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700'
};

export default function AdminDeliveries() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('today'); // late, today, instant, future
  const [view, setView] = useState('priority'); // priority | history

  // History view state
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, pages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [slotFilter, setSlotFilter] = useState('');

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

  const fetchHistory = useCallback((page = 1) => {
    setHistoryLoading(true);
    const params = { page, limit: 20 };
    if (statusFilter) params.status = statusFilter;
    if (typeFilter) params.deliveryType = typeFilter;
    if (dateFilter) params.scheduledDate = dateFilter;
    if (slotFilter) params.timeSlot = slotFilter;
    getDeliveries(params).then(res => {
      setHistoryData(res.data.data);
      setHistoryPagination(res.data.pagination);
    }).catch(() => toast.error('Failed to load delivery history'))
      .finally(() => setHistoryLoading(false));
  }, [statusFilter, typeFilter, dateFilter, slotFilter]);

  useEffect(() => {
    if (view === 'history') fetchHistory(1);
  }, [view, fetchHistory]);

  const handleUpdate = async (id, status) => {
    try {
      await updateDeliveryStatus(id, { status });
      toast.success('Status updated');
      fetchDeliveries();
      if (view === 'history') fetchHistory(historyPagination.page || 1);
    } catch { toast.error('Failed to update'); }
  };

  const resetHistoryFilters = () => {
    setStatusFilter('');
    setTypeFilter('');
    setDateFilter('');
    setSlotFilter('');
  };

  const statusActions = (d) => (
    d.status !== 'delivered' && d.status !== 'failed' && (
      <div className="flex flex-wrap gap-2">
        {d.status === 'assigned' && <button onClick={() => handleUpdate(d._id, 'picked_up')} className="flex-1 min-w-[110px] py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">Mark Picked Up</button>}
        {d.status === 'picked_up' && <button onClick={() => handleUpdate(d._id, 'on_the_way')} className="flex-1 min-w-[110px] py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-medium hover:bg-purple-100 transition-colors">On The Way</button>}
        {d.status === 'on_the_way' && <button onClick={() => handleUpdate(d._id, 'delivered')} className="flex-1 min-w-[110px] py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors">Mark Delivered</button>}
      </div>
    )
  );

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Delivery Management</h1>
          <p className="text-sm text-gray-500 mt-1">Track, dispatch and review deliveries.</p>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button onClick={() => setView('priority')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'priority' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <FiGrid className="w-4 h-4" /> Priority
          </button>
          <button onClick={() => setView('history')} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${view === 'history' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <FiList className="w-4 h-4" /> All Deliveries
          </button>
        </div>
      </div>

      {view === 'priority' ? (
        loading ? (
          <div className="text-center py-10">Loading...</div>
        ) : !data ? (
          <div className="text-center py-10 text-gray-500">Failed to load deliveries. Please try again.</div>
        ) : (
          <>
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
              {(data[tab] || []).map(d => (
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
              {(data[tab] || []).length === 0 && (
                <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-gray-100">
                  <span className="text-4xl block mb-3">📭</span>
                  <p className="text-gray-500 font-medium">No deliveries in this queue</p>
                </div>
              )}
            </div>
          </>
        )
      ) : (
        <>
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl border border-gray-100 mb-6 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="status-filter" className="block text-xs font-medium text-gray-500 mb-1">Delivery Status</label>
                <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                  <option value="">All Statuses</option>
                  {DELIVERY_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="type-filter" className="block text-xs font-medium text-gray-500 mb-1">Delivery Type</label>
                <select id="type-filter" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                  <option value="">All Types</option>
                  <option value="instant">Instant</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>
              {typeFilter === 'scheduled' && (
                <>
                  <div className="animate-fadeIn">
                    <label htmlFor="date-filter" className="block text-xs font-medium text-gray-500 mb-1">Scheduled Date</label>
                    <input id="date-filter" type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  </div>
                  <div className="animate-fadeIn">
                    <label htmlFor="slot-filter" className="block text-xs font-medium text-gray-500 mb-1">Time Slot</label>
                    <select id="slot-filter" value={slotFilter} onChange={e => setSlotFilter(e.target.value)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                      <option value="">All Slots</option>
                      {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </>
              )}
              {(statusFilter || typeFilter || dateFilter || slotFilter) && (
                <button onClick={resetHistoryFilters} className="text-xs text-red-500 hover:underline mb-1.5">Clear Filters</button>
              )}
            </div>
          </div>

          {/* History table */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Order #</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Customer</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Rider</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Amount</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Assigned</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
                </tr></thead>
                <tbody>
                  {historyData.map(d => (
                    <tr key={d._id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-medium">#{d.order?.orderNumber}</td>
                      <td className="py-3 px-4">{d.order?.user?.name}<br /><span className="text-xs text-gray-400">{d.order?.user?.mobile}</span></td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{d.deliveryPersonName}</p>
                        <p className="text-xs text-gray-400">{d.deliveryPersonMobile}</p>
                      </td>
                      <td className="py-3 px-4">
                        {d.order?.deliveryType === 'scheduled' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-indigo-600 font-medium text-xs bg-indigo-50 px-2 py-0.5 rounded-full mb-1">
                              <FiCalendar className="w-3 h-3" /> Scheduled
                            </span>
                            {d.order?.scheduledDelivery?.date && (
                              <p className="text-xs text-gray-600">
                                {new Date(d.order.scheduledDelivery.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                <span className="text-gray-400"> • {d.order.scheduledDelivery.timeSlot}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-medium text-xs bg-amber-50 px-2 py-0.5 rounded-full">
                            <FiZap className="w-3 h-3" /> Instant
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-primary-600">₹{d.order?.finalAmount}</td>
                      <td className="py-3 px-4"><span className={`px-2 py-1 rounded-full text-[11px] font-medium capitalize ${HISTORY_STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-700'}`}>{d.status?.replace(/_/g, ' ')}</span></td>
                      <td className="py-3 px-4 text-xs text-gray-500">{new Date(d.createdAt).toLocaleDateString('en-IN')}</td>
                      <td className="py-3 px-4">{statusActions(d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historyLoading && <div className="text-center py-8 text-gray-400">Loading...</div>}
            {!historyLoading && historyData.length === 0 && (
              <div className="text-center py-10 text-gray-400">No deliveries found</div>
            )}
          </div>

          {historyPagination.pages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              {Array.from({ length: historyPagination.pages }, (_, i) => (
                <button key={i + 1} onClick={() => fetchHistory(i + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${historyPagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}