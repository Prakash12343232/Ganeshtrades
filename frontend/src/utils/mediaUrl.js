const DEFAULT_BASE = '/api';

const stripTrailingSlash = (url) => (url || '').replace(/\/+$/, '');

export function getBackendOrigin() {
  const rawBase = import.meta.env.VITE_API_URL || DEFAULT_BASE;
  const base = stripTrailingSlash(rawBase);
  if (!/^https?:\/\//i.test(base)) return '';
  const origin = base.replace(/\/api$/i, '');
  return stripTrailingSlash(origin);
}

export function resolveMediaUrl(url) {
  if (typeof url !== 'string' || url.trim() === '') return url;
  const trimmed = url.trim();
  if (!/^\/(api\/media|uploads)\//i.test(trimmed)) return url;
  const origin = getBackendOrigin();
  if (!origin) return url;
  return `${origin}${trimmed}`;
}