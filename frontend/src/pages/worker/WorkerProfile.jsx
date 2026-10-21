import { useState, useEffect } from 'react';
import { getWorkerMe } from '../../services/api';
import { FiUser, FiPhone, FiMail, FiTag, FiCalendar, FiBriefcase } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

export default function WorkerProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWorkerMe()
      .then(res => setProfile(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-400" />
    </div>
  );

  if (!profile) return (
    <div className="text-center py-16 text-slate-400">
      <p>No staff profile found. Contact your manager.</p>
    </div>
  );

  const cat = { shop: '🏪 Shop Worker', delivery: '🚚 Delivery Rider', hybrid: '⚡ Hybrid Worker' };
  const eng = { internal: 'Internal Staff', external: 'External Partner' };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-white">My Profile</h1>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        {/* Avatar & name */}
        <div className="flex items-center gap-4">
          {user?.avatar
            ? <img src={user.avatar} alt="Avatar" className="w-16 h-16 rounded-2xl object-cover ring-2 ring-purple-500" />
            : <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center text-white text-2xl font-bold ring-2 ring-purple-500">
                {user?.name?.[0]}
              </div>
          }
          <div>
            <h2 className="text-lg font-bold text-white">{user?.name}</h2>
            <p className="text-sm text-purple-400 font-medium">{cat[profile.profile?.category] || '—'}</p>
          </div>
        </div>

        <hr className="border-slate-800" />

        {/* Details */}
        <dl className="grid grid-cols-1 gap-3">
          {user?.mobile && (
            <div className="flex items-center gap-3 text-sm">
              <FiPhone className="text-purple-400 shrink-0" />
              <span className="text-slate-400">Mobile:</span>
              <span className="text-slate-100 font-medium">{user.mobile}</span>
            </div>
          )}
          {user?.email && (
            <div className="flex items-center gap-3 text-sm">
              <FiMail className="text-purple-400 shrink-0" />
              <span className="text-slate-400">Email:</span>
              <span className="text-slate-100 font-medium">{user.email}</span>
            </div>
          )}
          {profile.profile?.employeeId && (
            <div className="flex items-center gap-3 text-sm">
              <FiTag className="text-purple-400 shrink-0" />
              <span className="text-slate-400">Employee ID:</span>
              <span className="text-slate-100 font-medium">{profile.profile.employeeId}</span>
            </div>
          )}
          {profile.profile?.designation && (
            <div className="flex items-center gap-3 text-sm">
              <FiBriefcase className="text-purple-400 shrink-0" />
              <span className="text-slate-400">Role:</span>
              <span className="text-slate-100 font-medium">{profile.profile.designation}</span>
            </div>
          )}
          {profile.profile?.joiningDate && (
            <div className="flex items-center gap-3 text-sm">
              <FiCalendar className="text-purple-400 shrink-0" />
              <span className="text-slate-400">Joined:</span>
              <span className="text-slate-100 font-medium">
                {new Date(profile.profile.joiningDate).toLocaleDateString('en-IN')}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <FiUser className="text-purple-400 shrink-0" />
            <span className="text-slate-400">Engagement:</span>
            <span className="text-slate-100 font-medium">{eng[profile.profile?.engagementType] || '—'}</span>
          </div>
          {profile.profile?.partnerOrg?.name && (
            <div className="flex items-center gap-3 text-sm">
              <FiBriefcase className="text-purple-400 shrink-0" />
              <span className="text-slate-400">Partner Org:</span>
              <span className="text-slate-100 font-medium">{profile.profile.partnerOrg.name}</span>
            </div>
          )}
        </dl>

        {/* Status badge */}
        <div className={`inline-flex px-3 py-1.5 rounded-xl text-xs font-bold ${profile.profile?.isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'}`}>
          {profile.profile?.isActive ? '✓ Active' : '✗ Inactive — Contact manager'}
        </div>
      </div>
    </div>
  );
}
