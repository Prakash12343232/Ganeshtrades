import { useState, useRef } from 'react';
import {
  getImportTemplate,
  previewProductImport,
  commitProductImport,
  previewCustomerImport,
  commitCustomerImport,
  previewInventoryImport,
  commitInventoryImport
} from '../../services/api';
import {
  FiUploadCloud,
  FiFileText,
  FiDownload,
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiArrowRight,
  FiArrowLeft,
  FiRefreshCw,
  FiLayers,
  FiUsers,
  FiBox,
  FiX
} from 'react-icons/fi';

export default function DataImportWizard({ isOpen, onClose, initialType = 'products', onImportSuccess }) {
  const [importType, setImportType] = useState(initialType); // 'products' | 'customers' | 'inventory'
  const [step, setStep] = useState(1); // 1: Upload, 2: Preview & Map, 3: Completed
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Preview data from server
  const [previewResult, setPreviewResult] = useState(null);
  const [duplicateAction, setDuplicateAction] = useState('skip'); // 'skip' | 'update' | 'create'
  const [commitResult, setCommitResult] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Handle template download
  const handleDownloadTemplate = async (format) => {
    try {
      const res = await getImportTemplate(importType, format);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ganesh_trades_${importType}_template.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setErrorMsg('Failed to download template. Please try again.');
    }
  };

  // Handle file selection
  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      setErrorMsg('Please select an Excel (.xlsx, .xls) or CSV (.csv) file.');
      return;
    }
    setFile(selectedFile);
    setErrorMsg('');
  };

  // Drag & drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Trigger preview analysis
  const handleAnalyze = async () => {
    if (!file) {
      setErrorMsg('Please choose a file to import.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      let res;
      if (importType === 'products') {
        res = await previewProductImport(formData);
      } else if (importType === 'customers') {
        res = await previewCustomerImport(formData);
      } else {
        res = await previewInventoryImport(formData);
      }

      setPreviewResult(res.data);
      setStep(2);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Error analyzing spreadsheet.');
    } finally {
      setLoading(false);
    }
  };

  // Commit valid entries to database
  const handleCommit = async () => {
    if (!previewResult || !previewResult.items) return;

    setLoading(true);
    setErrorMsg('');

    try {
      let res;
      const validAndDuplicateItems = previewResult.items.filter((it) => it.status !== 'error');

      if (validAndDuplicateItems.length === 0) {
        setErrorMsg('No valid rows found to import.');
        setLoading(false);
        return;
      }

      if (importType === 'products') {
        res = await commitProductImport({
          items: validAndDuplicateItems,
          duplicateAction
        });
      } else if (importType === 'customers') {
        res = await commitCustomerImport({
          items: validAndDuplicateItems,
          duplicateAction
        });
      } else {
        res = await commitInventoryImport({
          items: validAndDuplicateItems
        });
      }

      setCommitResult(res.data);
      setStep(3);
      if (onImportSuccess) {
        onImportSuccess(importType);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Error committing import.');
    } finally {
      setLoading(false);
    }
  };

  const resetWizard = () => {
    setFile(null);
    setPreviewResult(null);
    setCommitResult(null);
    setErrorMsg('');
    setStep(1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-navy-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl h-[90vh] max-h-[820px] bg-navy-900 border border-navy-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-navy-850 border-b border-navy-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-mint-500/20 border border-mint-500/40 text-mint-400 flex items-center justify-center">
              <FiUploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Bulk Data Import & Synchronization</h3>
              <p className="text-xs text-slate-400">Import products, customer registers, and inventory balances with validation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-navy-800 rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Tracker */}
        <div className="bg-navy-950/60 border-b border-navy-800 px-6 py-3 flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                step >= 1 ? 'bg-mint-500 text-navy-950' : 'bg-navy-800 text-slate-400'
              }`}
            >
              1
            </span>
            <span className={step >= 1 ? 'text-white font-semibold' : 'text-slate-500'}>Upload File</span>
          </div>
          <div className="w-12 h-0.5 bg-navy-800" />
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                step >= 2 ? 'bg-mint-500 text-navy-950' : 'bg-navy-800 text-slate-400'
              }`}
            >
              2
            </span>
            <span className={step >= 2 ? 'text-white font-semibold' : 'text-slate-500'}>Preview & Validate</span>
          </div>
          <div className="w-12 h-0.5 bg-navy-800" />
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                step === 3 ? 'bg-mint-500 text-navy-950' : 'bg-navy-800 text-slate-400'
              }`}
            >
              3
            </span>
            <span className={step === 3 ? 'text-white font-semibold' : 'text-slate-500'}>Summary</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/50 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-2">
            <FiAlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === 1 && (
            <div className="space-y-6">
              {/* Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Select Import Dataset
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setImportType('products');
                      setFile(null);
                    }}
                    className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      importType === 'products'
                        ? 'border-mint-500 bg-mint-500/10 text-white'
                        : 'border-navy-700 bg-navy-800/40 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <FiLayers className={`w-5 h-5 mt-0.5 ${importType === 'products' ? 'text-mint-400' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-bold text-sm">Product Catalog</div>
                      <div className="text-xs text-slate-400 mt-0.5">Names, SKUs, pricing, categories, initial stock</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportType('customers');
                      setFile(null);
                    }}
                    className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      importType === 'customers'
                        ? 'border-mint-500 bg-mint-500/10 text-white'
                        : 'border-navy-700 bg-navy-800/40 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <FiUsers className={`w-5 h-5 mt-0.5 ${importType === 'customers' ? 'text-mint-400' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-bold text-sm">Customer Register</div>
                      <div className="text-xs text-slate-400 mt-0.5">Mobiles, Khata credit limits, hotel/retail type</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportType('inventory');
                      setFile(null);
                    }}
                    className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      importType === 'inventory'
                        ? 'border-mint-500 bg-mint-500/10 text-white'
                        : 'border-navy-700 bg-navy-800/40 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <FiBox className={`w-5 h-5 mt-0.5 ${importType === 'inventory' ? 'text-mint-400' : 'text-slate-400'}`} />
                    <div>
                      <div className="font-bold text-sm">Inventory Balances</div>
                      <div className="text-xs text-slate-400 mt-0.5">Bulk restock (add/set/subtract) by SKU or Name</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Starter Template Download Banner */}
              <div className="bg-navy-950/60 border border-navy-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FiFileText className="w-8 h-8 text-mint-400 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">Need a ready-made starter spreadsheet?</h4>
                    <p className="text-xs text-slate-400">
                      Download our pre-formatted template with sample rows, expected columns, and guidance.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadTemplate('xlsx')}
                    className="px-3 py-1.5 bg-navy-800 hover:bg-navy-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-navy-700 transition-colors"
                  >
                    <FiDownload className="w-3.5 h-3.5 text-mint-400" /> Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate('csv')}
                    className="px-3 py-1.5 bg-navy-800 hover:bg-navy-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-navy-700 transition-colors"
                  >
                    <FiDownload className="w-3.5 h-3.5 text-mint-400" /> CSV (.csv)
                  </button>
                </div>
              </div>

              {/* Upload Drop Zone */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => handleFileChange(e.target.files[0])}
                />
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                    dragActive
                      ? 'border-mint-400 bg-mint-500/10'
                      : file
                      ? 'border-mint-500/50 bg-navy-850'
                      : 'border-navy-700 hover:border-slate-500 bg-navy-950/40'
                  }`}
                >
                  <FiUploadCloud className="w-12 h-12 mx-auto text-mint-400 mb-3" />
                  {file ? (
                    <div>
                      <span className="text-xs uppercase font-bold text-mint-400">File Selected</span>
                      <p className="text-base font-bold text-white mt-1">{file.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB — Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Drag and drop your spreadsheet here, or <span className="text-mint-400 underline">browse files</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv) up to 10MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && previewResult && (
            <div className="space-y-6">
              {/* Validation Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-navy-950/70 border border-navy-800 p-3.5 rounded-xl">
                  <span className="text-xs text-slate-400">Total Rows</span>
                  <div className="text-xl font-black text-white mt-0.5">{previewResult.totalRows}</div>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-800/60 p-3.5 rounded-xl">
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <FiCheckCircle className="w-3.5 h-3.5" /> Ready / Valid
                  </span>
                  <div className="text-xl font-black text-emerald-300 mt-0.5">{previewResult.validCount}</div>
                </div>
                <div className="bg-amber-950/30 border border-amber-800/60 p-3.5 rounded-xl">
                  <span className="text-xs text-amber-400 flex items-center gap-1">
                    <FiAlertTriangle className="w-3.5 h-3.5" /> Duplicates
                  </span>
                  <div className="text-xl font-black text-amber-300 mt-0.5">{previewResult.duplicateCount || 0}</div>
                </div>
                <div className="bg-rose-950/30 border border-rose-800/60 p-3.5 rounded-xl">
                  <span className="text-xs text-rose-400 flex items-center gap-1">
                    <FiXCircle className="w-3.5 h-3.5" /> Invalid / Errors
                  </span>
                  <div className="text-xl font-black text-rose-300 mt-0.5">{previewResult.errorCount || 0}</div>
                </div>
              </div>

              {/* Duplicate Strategy Selector (if duplicates exist) */}
              {(previewResult.duplicateCount > 0 || importType === 'products') && (
                <div className="bg-navy-850 border border-navy-700 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white">Existing Item Conflict Strategy</h4>
                    <p className="text-xs text-slate-400">How should Ganesh Trades handle products/customers that already exist?</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDuplicateAction('skip')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        duplicateAction === 'skip'
                          ? 'bg-mint-500 text-navy-950 border-mint-500'
                          : 'bg-navy-950 text-slate-300 border-navy-700 hover:text-white'
                      }`}
                    >
                      Skip Duplicates (Safe)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateAction('update')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        duplicateAction === 'update'
                          ? 'bg-mint-500 text-navy-950 border-mint-500'
                          : 'bg-navy-950 text-slate-300 border-navy-700 hover:text-white'
                      }`}
                    >
                      Update Existing Records
                    </button>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Row Verification Preview (First {previewResult.items?.length || 0} items)
                </h4>
                <div className="overflow-x-auto border border-navy-800 rounded-xl max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-navy-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Row</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Identifier / Name</th>
                        <th className="py-2.5 px-3">Details</th>
                        <th className="py-2.5 px-3">Validation Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-850">
                      {previewResult.items?.slice(0, 50).map((it, idx) => (
                        <tr key={idx} className="hover:bg-navy-850/50">
                          <td className="py-2 px-3 text-slate-400 font-mono">#{it.rowNumber}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {it.status === 'valid' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                                Valid
                              </span>
                            )}
                            {it.status === 'duplicate' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-950 text-amber-400 border border-amber-800">
                                Duplicate
                              </span>
                            )}
                            {it.status === 'error' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-950 text-rose-400 border border-rose-800">
                                Invalid
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-semibold text-white">
                            {it.data?.name || it.identifier || '—'}
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {importType === 'products' && (
                              <span>₹{it.data?.price || 0} | Stock: {it.data?.stock || 0} {it.data?.unit || ''}</span>
                            )}
                            {importType === 'customers' && (
                              <span>📱 {it.data?.mobile} | Type: {it.data?.customerType}</span>
                            )}
                            {importType === 'inventory' && (
                              <span>Current: {it.currentStock} → <strong>New: {it.newStock}</strong> ({it.action})</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-400">
                            {it.errors?.length > 0 ? (
                              <span className="text-rose-400 font-medium">{it.errors.join('; ')}</span>
                            ) : it.duplicateReason ? (
                              <span className="text-amber-400">{it.duplicateReason}</span>
                            ) : (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <FiCheckCircle className="w-3 h-3" /> Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 3 && commitResult && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-950/80 border border-emerald-600 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/10">
                <FiCheckCircle className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold text-white">Import Successfully Executed</h4>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                Data records have been committed to MongoDB and logged in the system audit trail.
              </p>

              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto text-left pt-2">
                <div className="bg-navy-950 border border-navy-800 p-3.5 rounded-xl">
                  <span className="text-xs text-slate-400">Created / Added</span>
                  <div className="text-xl font-bold text-emerald-400 mt-0.5">{commitResult.createdCount || 0}</div>
                </div>
                <div className="bg-navy-950 border border-navy-800 p-3.5 rounded-xl">
                  <span className="text-xs text-slate-400">Updated</span>
                  <div className="text-xl font-bold text-sky-400 mt-0.5">{commitResult.updatedCount || 0}</div>
                </div>
                <div className="bg-navy-950 border border-navy-800 p-3.5 rounded-xl">
                  <span className="text-xs text-slate-400">Skipped</span>
                  <div className="text-xl font-bold text-amber-400 mt-0.5">{commitResult.skippedCount || 0}</div>
                </div>
              </div>

              {commitResult.errors?.length > 0 && (
                <div className="max-w-lg mx-auto text-left p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-xs text-rose-300">
                  <span className="font-bold block mb-1">Row Exceptions ({commitResult.errors.length}):</span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {commitResult.errors.slice(0, 5).map((e, idx) => (
                      <li key={idx}>Row #{e.rowNumber}: {e.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-navy-850 border-t border-navy-700 flex items-center justify-between">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!file || loading}
                className="px-5 py-2.5 bg-mint-500 hover:bg-mint-400 text-navy-950 font-bold text-sm rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-mint-500/20"
              >
                {loading ? (
                  <>
                    <FiRefreshCw className="w-4 h-4 animate-spin" /> Analyzing Rows...
                  </>
                ) : (
                  <>
                    Preview & Validate <FiArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={loading}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
              >
                <FiArrowLeft className="w-4 h-4" /> Choose Different File
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={loading || (previewResult?.validCount === 0 && previewResult?.duplicateCount === 0)}
                className="px-5 py-2.5 bg-mint-500 hover:bg-mint-400 text-navy-950 font-bold text-sm rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-mint-500/20"
              >
                {loading ? (
                  <>
                    <FiRefreshCw className="w-4 h-4 animate-spin" /> Committing to Database...
                  </>
                ) : (
                  <>
                    Commit & Save Changes <FiCheckCircle className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}

          {step === 3 && (
            <div className="w-full flex justify-between items-center">
              <button
                type="button"
                onClick={resetWizard}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Import Another File
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-mint-500 hover:bg-mint-400 text-navy-950 font-bold text-sm rounded-xl transition-all shadow-md shadow-mint-500/20"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
