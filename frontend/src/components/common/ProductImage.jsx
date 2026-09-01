import { useState, useEffect } from 'react';
import { Package, ImageOff } from 'lucide-react';

/**
 * Reusable Product Image component with automatic fallback & error handling
 */
export default function ProductImage({
  src,
  alt = 'Product image',
  className = 'w-full h-full object-contain',
  containerClassName = 'w-full h-full flex items-center justify-center bg-gray-50 rounded-md overflow-hidden relative',
  onClick,
  showFallbackLabel = true
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [src]);

  const isValidSrc = src && typeof src === 'string' && src.trim() !== '' && !src.includes('default-product');

  if (!isValidSrc || hasError) {
    return (
      <div
        className={`${containerClassName} border border-gray-100 bg-slate-50/80 text-gray-400 p-2 select-none`}
        onClick={onClick}
        title="No image available"
      >
        <div className="flex flex-col items-center justify-center text-center p-2">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-1.5 text-gray-400 shadow-inner">
            <ImageOff className="w-5 h-5" />
          </div>
          {showFallbackLabel && (
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              No Photo
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName} onClick={onClick}>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse">
          <Package className="w-6 h-6 text-gray-300" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
}
