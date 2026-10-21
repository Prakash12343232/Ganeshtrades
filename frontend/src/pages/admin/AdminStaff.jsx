import { useState, useEffect } from 'react';
import { getStaff, createStaff, updateStaff, getPartners, createPartner, updatePartner } from '../../services/api';
import { FiUsers, FiPlus, FiToggleRight, FiToggleLeft, FiTruck, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';

const TAB_STAFF = 'staff';
const TAB_PARTNERS = 'partners';

const CATEGORY_LABELS = { shop: '🏪 Shop', delivery: '🚚 Delivery', hybrid: '⚡ Hybrid' };
const ENG_LABELS = { internal: 'Internal', external: 'External' };

export default function AdminStaff() {
  const [tab, setTab] = useState(TAB_STAFF);

  // Staff state
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [showCreateStaff, setShowCreateStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: '', mobile: '', email: '', password: '', category: 'delivery', engagementType: 'internal', employeeId: '', designation: '', notes: '' });
  const [staffSubmitting, setStaffSubmitting] = useState(false);

  // Partners state
  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [showCreatePartner, setShowCreatePartner] = useState(false);
  const [partnerForm, setPartnerForm] = useState({ name: '', contactPerson: '', mobile: '', email: '', address: '', notes: '' });
  const [partnerSubmitting, setPartnerSubmitting] = useState(false);

  const loadStaff = () => {
    setStaffLoading(true);
    getStaff().then(r => setStaff(r.data.data || [])).catch(() => toast.error('Failed to load staff')).finally(() => setStaffLoading(false));
  };
  const loadPartners = () => {
    setPartnersLoading(true);
    getPartners().then(r => setPartners(r.data.data || [])).catch(() => toast.error('Failed to load partners')).finally(() => setPartnersLoading(false));
  };

  useEffect(() => { loadStaff(); loadPartners(); }, []);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setStaffSubmitting(true);
    try {
      await createStaff(staffForm);
      toast.success('Staff member created!');
      setShowCreateStaff(false);
      setStaffForm({ name: '', mobile: '', email: '', password: '', category: 'delivery', engagementType: 'internal', employeeId: '', designation: '', notes: '' });
      loadStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create staff');
    } finally {
      setStaffSubmitting(false);
    }
  };

  const toggleStaffActive = async (profile) => {
    try {
      await updateStaff(profile._id, { isActive: !profile.isActive });
      toast.success(`Staff ${profile.isActive ? 'deactivated' : 'activated'}`);
      loadStaff();
    } catch {
      toast.error('Failed to update staff status');
    }
  };

  const handleCreatePartner = async (e) => {
    e.preventDefault();
    setPartnerSubmitting(true);
    try {
      await createPartner(partnerForm);
      toast.success('Delivery partner created!');
      setShowCreatePartner(false);
      setPartnerForm({ name: '', contactPerson: '', mobile: '', email: '', address: '', notes: '' });
      loadPartners();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create partner');
    } finally {
      setPartnerSubmitting(false);
    }
  };

  const togglePartnerActive = async (partner) => {
    try {
      await updatePartner(partner._id, { isActive: !partner.isActive });
      toast.success(`Partner ${partner.isActive ? 'deactivated' : 'activated'}`);
      loadPartners();
    } catch {
      toast.error('Failed to update partner status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Staff Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">Manage delivery workers and external partners</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-900 rounded-xl p-1 w-fit">
        <button onClick={() => setTab(TAB_STAFF)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === TAB_STAFF ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          <FiUsers /> Staff Members
        </button>
        <button onClick={() => setTab(TAB_PARTNERS)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === TAB_PARTNERS ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          <FiTruck /> Delivery Partners
        </button>
      </div>

      {/* ── STAFF TAB ── */}
      {tab === TAB_STAFF && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">Staff Members ({staff.length})</h2>
            <div className="flex gap-2">
              <button onClick={loadStaff} className="p-2 text-slate-400 hover:text-purple-400 transition-colors"><FiRefreshCw /></button>
              <button onClick={() => setShowCreateStaff(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold transition-all">
                <FiPlus /> Add Staff
              </button>
            </div>
          </div>

          {/* Create Staff Modal */}
          {showCreateStaff && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <form onSubmit={handleCreateStaff} className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-lg p-6 space-y-4">
                <h3 className="text-lg font-bold text-white">Add New Staff Member</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-slate-400 mb-1 block">Full Name *</label>
                    <input required value={staffForm.name} onChange={e => setStaffForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-navy-800 border border-navy-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" placeholder="Rider / Worker name" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Mobile</label>
                    <input value={staffForm.mobile} onChange={e => setStaffForm(p => ({ ...p, mobile: e.target.value }))}
                      className="w-full bg-navy-800 border border-navy-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" placeholder="9876543210" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Email</label>
                    <input type="email" value={staffForm.email} onChange={e => setStaffForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full bg-navy-800 border border-navy-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" placeholder="rider@example.com" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Password *</label>
                    <input required type="password" value={staffForm.password} onChange={e => setStaffForm(p => ({ ...p, password: e.target.value }))}
                      className="w-full bg-navy-800 border border-navy-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" placeholder="Min 8 chars" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Category</label>
                    <select value={staffForm.category} onChange={e => setStaffForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full bg-navy-800 border border-navy-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                      <option value="delivery">Delivery</option>
                      <option value="shop">Shop</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Engagement</label>
                    <select value={staffForm.engagementType} onChange={e => setStaffForm(p => ({ ...p, engagementType: e.target.value }))}
                      className="w-full bg-navy-800 border border-navy-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500">
                      <option value="internal">Internal</option>
                      <option value="external">External</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Employee ID</label>
                    <input value={staffForm.employeeId} onChange={e => setStaffForm(p => ({ ...p, employeeId: e.target.value }))}
                      className="w-full bg-navy-800 border border-navy-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" placeholder="Optional" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Designation</label>
                    <input value={staffForm.designation} onChange={e => setStaffForm(p => ({ ...p, designation: e.target.value }))}
                      className="w-full bg-navy-800 border border-navy-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" placeholder="Delivery Rider" />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreateStaff(false)} className="flex-1 py-2 rounded-xl border border-navy-600 text-slate-400 hover:bg-navy-800 text-sm font-semibold transition-all">Cancel</button>
                  <button type="submit" disabled={staffSubmitting} className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold disabled:opacity-50 transition-all">
                    {staffSubmitting ? 'Creating...' : 'Create Staff'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Staff list */}
          {staffLoading ? (
            <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-400" /></div>
          ) : staff.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No staff members yet. Add your first worker.</div>
          ) : (
            <div className="space-y-2">
              {staff.map(p => (
                <div key={p._id} className="bg-navy-900 border border-navy-800 rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-sm shrink-0">
                      {p.user?.name?.[0] || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{p.user?.name}</p>
                      <p className="text-xs text-slate-400 truncate">{p.user?.mobile || p.user?.email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-purple-400 font-medium">{CATEGORY_LABELS[p.category]}</span>
                        <span className="text-xs text-slate-500">·</span>
                        <span className="text-xs text-slate-500">{ENG_LABELS[p.engagementType]}</span>
                        {p.designation && <><span className="text-xs text-slate-500">·</span><span className="text-xs text-slate-400">{p.designation}</span></>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${p.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button onClick={() => toggleStaffActive(p)} title={p.isActive ? 'Deactivate' : 'Activate'}
                      className="p-1.5 text-slate-400 hover:text-purple-400 transition-colors text-lg">
                      {p.isActive ? <FiToggleRight className="text-emerald-400" /> : <FiToggleLeft />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PARTNERS TAB ── */}
      {tab === TAB_PARTNERS && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">Delivery Partners ({partners.length})</h2>
            <div className="flex gap-2">
              <button onClick={loadPartners} className="p-2 text-slate-400 hover:text-purple-400 transition-colors"><FiRefreshCw /></button>
              <button onClick={() => setShowCreatePartner(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold transition-all">
                <FiPlus /> Add Partner
              </button>
            </div>
          </div>

          {/* Create Partner Modal */}
          {showCreatePartner && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <form onSubmit={handleCreatePartner} className="bg-navy-900 border border-navy-700 rounded-2xl w-full max-w-md p-6 space-y-4">
                <h3 className="text-lg font-bold text-white">Add Delivery Partner</h3>
                {[
                  { label: 'Company Name *', key: 'name', required: true, placeholder: 'SpeedEx Logistics' },
                  { label: 'Contact Person', key: 'contactPerson', placeholder: 'Ravi Kumar' },
                  { label: 'Mobile', key: 'mobile', placeholder: '9876543210' },
                  { label: 'Email', key: 'email', placeholder: 'contact@partner.com' },
                  { label: 'Address', key: 'address', placeholder: 'Office address' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-slate-400 mb-1 block">{f.label}</label>
                    <input required={f.required} value={partnerForm[f.key]} onChange={e => setPartnerForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full bg-navy-800 border border-navy-600 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" placeholder={f.placeholder} />
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreatePartner(false)} className="flex-1 py-2 rounded-xl border border-navy-600 text-slate-400 hover:bg-navy-800 text-sm font-semibold transition-all">Cancel</button>
                  <button type="submit" disabled={partnerSubmitting} className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold disabled:opacity-50 transition-all">
                    {partnerSubmitting ? 'Creating...' : 'Create Partner'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Partners list */}
          {partnersLoading ? (
            <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-400" /></div>
          ) : partners.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No delivery partners yet.</div>
          ) : (
            <div className="space-y-2">
              {partners.map(p => (
                <div key={p._id} className="bg-navy-900 border border-navy-800 rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm">{p.name}</p>
                    {p.contactPerson && <p className="text-xs text-slate-400">{p.contactPerson}</p>}
                    {p.mobile && <p className="text-xs text-slate-500">{p.mobile}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${p.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button onClick={() => togglePartnerActive(p)} className="p-1.5 text-slate-400 hover:text-purple-400 transition-colors text-lg">
                      {p.isActive ? <FiToggleRight className="text-emerald-400" /> : <FiToggleLeft />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
