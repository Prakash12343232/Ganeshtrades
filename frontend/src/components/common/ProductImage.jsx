import { useState, useEffect } from 'react';
import { Package } from 'lucide-react';
import { resolveMediaUrl } from '../../utils/mediaUrl';

/**
 * Reusable Product Image component with automatic fallback & error handling
 */
export default function ProductImage({
  src,
  alt = 'Product image',
  className = 'w-full h-full object-contain',
  containerClassName = 'w-full h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950 rounded-md overflow-hidden relative',
  onClick,
  showFallbackLabel = true
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [src]);

  const originalSrc = src;
  const resolvedSrc = resolveMediaUrl(originalSrc);
  const isValidSrc = resolvedSrc && typeof resolvedSrc === 'string' && resolvedSrc.trim() !== '' && !resolvedSrc.includes('default-product');

  if (!isValidSrc || hasError) {
    return (
      <div
        className={`${containerClassName} bg-slate-100 dark:bg-navy-900/80 text-slate-400 dark:text-slate-500 select-none`}
        onClick={onClick}
        title={alt || 'No photo available'}
        data-testid="product-image-fallback"
      >
        <div className="flex flex-col items-center justify-center text-center p-1">
          <div className="w-8 h-8 rounded-lg bg-slate-200/80 dark:bg-navy-800/90 flex items-center justify-center text-mint-600 dark:text-mint-400 shadow-sm">
            <Package className="w-4 h-4" />
          </div>
          {showFallbackLabel && (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
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
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-navy-900/50 animate-pulse">
          <Package className="w-5 h-5 text-slate-400 dark:text-navy-600" />
        </div>
      )}
      <img
        src={resolvedSrc}
        alt={alt}
        className={`${className} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        loading="lazy"
      />
    </div>
  );
}
