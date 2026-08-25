import { useState, useEffect } from 'react';
import { getAllReviews, moderateReview, deleteReview } from '../../services/api';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiStar, FiMessageSquare, FiTrash2, FiFilter } from 'react-icons/fi';

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', rating: '' });
  const [responseText, setResponseText] = useState({});
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const fetchReviews = async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (filter.status) params.status = filter.status;
      if (filter.rating) params.rating = filter.rating;
      const { data } = await getAllReviews(params);
      setReviews(data.data);
      setPagination(data.pagination);
    } catch { toast.error('Failed to load reviews'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReviews(); }, [filter]);

  const handleModerate = async (id, status) => {
    try {
      const payload = { status };
      if (responseText[id]) payload.adminResponse = responseText[id];
      await moderateReview(id, payload);
      toast.success(`Review ${status}`);
      fetchReviews(pagination.page);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this review permanently?')) return;
    try {
      await deleteReview(id);
      toast.success('Review deleted');
      fetchReviews(pagination.page);
    } catch { toast.error('Failed to delete'); }
  };

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700'
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Review Moderation</h1>
          <p className="text-sm text-gray-400">{pagination.total} total reviews</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2">
            <FiFilter className="text-gray-400 w-4 h-4" />
            <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
              className="text-sm bg-transparent focus:outline-none text-gray-600" id="filter-status">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2">
            <FiStar className="text-gray-400 w-4 h-4" />
            <select value={filter.rating} onChange={e => setFilter(f => ({ ...f, rating: e.target.value }))}
              className="text-sm bg-transparent focus:outline-none text-gray-600" id="filter-rating">
              <option value="">All Ratings</option>
              {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} ★</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary-500"></div></div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No reviews found</div>
      ) : (
        <div className="space-y-4">
          {reviews.map(review => (
            <div key={review._id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-gray-800">{review.user?.name || 'Unknown'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[review.status] || statusColors.pending}`}>
                      {review.status || 'pending'}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Product: <span className="text-gray-700 font-medium">{review.product?.name || 'N/A'}</span></p>
                  <div className="flex items-center gap-1 mt-2">
                    {[1,2,3,4,5].map(s => (
                      <FiStar key={s} className={`w-4 h-4 ${s <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                    ))}
                    <span className="text-sm text-gray-500 ml-2">{review.helpfulCount || 0} found helpful</span>
                  </div>
                  <p className="text-gray-700 mt-2 text-sm">{review.comment}</p>

                  {review.adminResponse && (
                    <div className="mt-3 p-3 bg-primary-50 rounded-lg border border-primary-100">
                      <p className="text-xs font-medium text-primary-700 mb-1">Admin Response</p>
                      <p className="text-sm text-primary-600">{review.adminResponse}</p>
                    </div>
                  )}

                  {/* Response input */}
                  {(review.status === 'pending' || !review.adminResponse) && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <FiMessageSquare className="text-gray-400 w-4 h-4 flex-shrink-0" />
                        <input
                          type="text"
                          value={responseText[review._id] || ''}
                          onChange={e => setResponseText(r => ({ ...r, [review._id]: e.target.value }))}
                          placeholder="Add admin response (optional)"
                          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {review.status !== 'approved' && (
                    <button onClick={() => handleModerate(review._id, 'approved')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-all" id={`approve-${review._id}`}>
                      <FiCheck className="w-3 h-3" /> Approve
                    </button>
                  )}
                  {review.status !== 'rejected' && (
                    <button onClick={() => handleModerate(review._id, 'rejected')}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-medium hover:bg-red-200 transition-all" id={`reject-${review._id}`}>
                      <FiX className="w-3 h-3" /> Reject
                    </button>
                  )}
                  <button onClick={() => handleDelete(review._id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs font-medium hover:bg-gray-200 transition-all" id={`delete-${review._id}`}>
                    <FiTrash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              {Array.from({ length: pagination.pages }, (_, i) => (
                <button key={i + 1} onClick={() => fetchReviews(i + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${pagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
