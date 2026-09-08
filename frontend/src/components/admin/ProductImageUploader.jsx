import { useState, useRef } from 'react';
import { Upload, X, Star, Trash2, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import ProductImage from '../common/ProductImage';
import { uploadProductImages, setPrimaryProductImage, deleteProductImageApi } from '../../services/api';
import toast from 'react-hot-toast';

export default function ProductImageUploader({ productId, existingImages = [], primaryImage = '', onImagesUpdated }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const processFiles = (files) => {
    const validFiles = [];
    const newPreviews = [];

    files.forEach(file => {
      if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
        toast.error(`Invalid file type for ${file.name}. Only JPG, PNG, and WebP are allowed.`);
        return;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`File ${file.name} is too large. Max size is 10MB.`);
        return;
      }

      validFiles.push(file);
      newPreviews.push({
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2)
      });
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleRemovePreview = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      const target = prev[index];
      if (target && target.url) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUploadNewImages = async () => {
    if (selectedFiles.length === 0) return;
    if (!productId) {
      toast.error('Save product details first before uploading images');
      return;
    }

    setUploading(true);
    setProgress(10);

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('images', file);
    });

    try {
      const res = await uploadProductImages(productId, formData, (evt) => {
        if (evt.total) {
          const percent = Math.round((evt.loaded * 100) / evt.total);
          setProgress(percent);
        }
      });

      if (res.data.success) {
        toast.success('Product image(s) uploaded successfully!');
        setSelectedFiles([]);
        setPreviews([]);
        if (onImagesUpdated) onImagesUpdated(res.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload product images');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleSetPrimary = async (imageUrl) => {
    if (!productId) return;
    try {
      const res = await setPrimaryProductImage(productId, imageUrl);
      if (res.data.success) {
        toast.success('Set as primary product photograph');
        if (onImagesUpdated) onImagesUpdated(res.data.data);
      }
    } catch {
      toast.error('Failed to set primary image');
    }
  };

  const handleDeleteExistingImage = async (imageUrl) => {
    if (!productId) return;
    if (!window.confirm('Are you sure you want to delete this product photo?')) return;

    try {
      const res = await deleteProductImageApi(productId, imageUrl);
      if (res.data.success) {
        toast.success('Product photograph removed');
        if (onImagesUpdated) onImagesUpdated(res.data.data);
      }
    } catch {
      toast.error('Failed to delete product photo');
    }
  };

  return (
    <div className="space-y-4">
      {/* Existing Photographs Grid */}
      {existingImages.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">
            Current Product Photographs ({existingImages.length})
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {existingImages.map((imgUrl, idx) => {
              const isPrimary = imgUrl === primaryImage;
              return (
                <div key={idx} className={`relative group rounded-xl overflow-hidden border-2 transition-all ${isPrimary ? 'border-mint-500 shadow-lg shadow-mint-500/10 ring-2 ring-mint-500/20' : 'border-navy-800 hover:border-navy-700'}`}>
                  <div className="h-24 bg-navy-950">
                    <ProductImage src={imgUrl} alt={`Product photo ${idx + 1}`} showFallbackLabel={false} />
                  </div>
                  {isPrimary && (
                    <span className="absolute top-1 left-1 bg-mint-500 text-navy-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" /> Main Photo
                    </span>
                  )}
                  <div className="absolute inset-0 bg-navy-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-1">
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(imgUrl)}
                        className="p-1.5 bg-navy-900 text-mint-400 border border-mint-500/30 rounded-full hover:bg-mint-500 hover:text-navy-950 transition"
                        title="Set as Main Image"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingImage(imgUrl)}
                      className="p-1.5 bg-navy-900 text-rose-400 border border-rose-500/30 rounded-full hover:bg-rose-500 hover:text-white transition"
                      title="Delete Image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
          isDragOver ? 'border-mint-500 bg-mint-500/10 scale-[1.01]' : 'border-navy-700 hover:border-mint-500/50 bg-navy-950/60'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
        />
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-mint-500/10 border border-mint-500/30 text-mint-400 flex items-center justify-center shadow-inner">
            <Upload className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              Click or drag real product photographs here
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Supports JPG, JPEG, PNG, and WebP (Max 10MB each)
            </p>
          </div>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {uploading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium text-slate-300">
            <span>Optimizing & Uploading...</span>
            <span className="text-mint-400">{progress}%</span>
          </div>
          <div className="w-full bg-navy-950 rounded-full h-2 overflow-hidden border border-navy-800">
            <div className="bg-mint-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      {/* New Image Previews Before Saving */}
      {previews.length > 0 && (
        <div className="space-y-3 bg-navy-950 border border-mint-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-mint-300 uppercase tracking-wide flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-mint-400" /> Previews Ready to Upload ({previews.length})
            </h4>
            {productId && (
              <button
                type="button"
                onClick={handleUploadNewImages}
                disabled={uploading}
                className="bg-mint-500 hover:bg-mint-400 text-navy-950 text-xs font-extrabold px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Upload Now
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {previews.map((item, idx) => (
              <div key={idx} className="relative group rounded-xl overflow-hidden border border-navy-700 bg-navy-900 shadow-sm">
                <img src={item.url} alt={item.name} className="h-20 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemovePreview(idx)}
                  className="absolute top-1 right-1 p-1 bg-rose-500 text-white rounded-full hover:bg-rose-600 shadow"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="p-1 bg-navy-950 text-[10px] text-slate-400 truncate border-t border-navy-800">
                  {item.name} ({item.size}MB)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
