import { useState, useEffect } from 'react';
import { getBackups, triggerBackup, restoreBackup, downloadBackup } from '../../services/api';
import toast from 'react-hot-toast';
import { FiDatabase, FiDownload, FiRefreshCw, FiClock, FiAlertTriangle } from 'react-icons/fi';

export default function AdminBackups() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(null);

  const fetchBackups = () => {
    getBackups()
      .then(res => setBackups(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBackups(); }, []);

  const handleTriggerBackup = async () => {
    setIsTriggering(true);
    const loadingToast = toast.loading('Generating backup...');
    try {
      await triggerBackup();
      toast.success('Backup completed successfully', { id: loadingToast });
      fetchBackups();
    } catch (error) {
      toast.error('Backup failed', { id: loadingToast });
    }
    setIsTriggering(false);
  };

  const handleRestore = async (filename) => {
    setIsRestoring(true);
    const loadingToast = toast.loading('Restoring database. Please do not refresh...');
    try {
      await restoreBackup(filename);
      toast.success('Database restored successfully', { id: loadingToast });
      setShowRestoreModal(null);
      fetchBackups();
    } catch (error) {
      toast.error('Database restore failed', { id: loadingToast });
    }
    setIsRestoring(false);
  };

  const handleDownload = async (filename) => {
    try {
      const response = await downloadBackup(filename);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FiDatabase className="text-primary-600" /> Database Backups
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage, trigger, and restore automatic database snapshots.</p>
        </div>
        <button 
          onClick={handleTriggerBackup} 
          disabled={isTriggering}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
        >
          <FiDatabase /> {isTriggering ? 'Running...' : 'Trigger Backup Now'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left py-4 px-6 font-medium text-gray-500">Timestamp</th>
                <th className="text-left py-4 px-6 font-medium text-gray-500">File Name</th>
                <th className="text-left py-4 px-6 font-medium text-gray-500">Type</th>
                <th className="text-left py-4 px-6 font-medium text-gray-500">Size</th>
                <th className="text-left py-4 px-6 font-medium text-gray-500">Status</th>
                <th className="text-left py-4 px-6 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map(b => (
                <tr key={b._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <FiClock className="text-gray-400" />
                      {new Date(b.createdAt).toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="py-4 px-6 font-medium text-gray-700">{b.filename}</td>
                  <td className="py-4 px-6">
                    <span className="capitalize bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-medium">
                      {b.type}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-gray-600">{formatSize(b.size)}</td>
                  <td className="py-4 px-6">
                    <span className={`capitalize px-2.5 py-1 rounded-md text-xs font-medium ${
                      b.status === 'completed' ? 'bg-green-100 text-green-700' :
                      b.status === 'failed' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    {b.status === 'completed' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleDownload(b.filename)}
                          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Download Backup"
                        >
                          <FiDownload />
                        </button>
                        <button 
                          onClick={() => setShowRestoreModal(b.filename)}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Restore Database"
                        >
                          <FiRefreshCw />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr><td colSpan="6" className="text-center py-10 text-gray-400">No backups available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showRestoreModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <FiAlertTriangle className="text-red-600 text-xl" />
            </div>
            <h2 className="text-xl font-bold text-center text-gray-800 mb-2">Critical Action</h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              You are about to restore the database from <strong>{showRestoreModal}</strong>. 
              This will completely overwrite all current live data. This action cannot be undone. Are you absolutely sure?
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowRestoreModal(null)} 
                disabled={isRestoring}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleRestore(showRestoreModal)} 
                disabled={isRestoring}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isRestoring ? <FiRefreshCw className="animate-spin" /> : 'Yes, Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
