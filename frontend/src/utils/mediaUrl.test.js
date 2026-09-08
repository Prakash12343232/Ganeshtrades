import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getBackendOrigin, resolveMediaUrl } from './mediaUrl';

const setApiUrl = (url) => {
  vi.stubEnv('VITE_API_URL', url);
};

beforeEach(() => {
  setApiUrl('https://ganeshtrades1.onrender.com/api');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('getBackendOrigin', () => {
  it('derives the origin from an absolute VITE_API_URL', () => {
    expect(getBackendOrigin()).toBe('https://ganeshtrades1.onrender.com');
  });

  it('handles a trailing slash on VITE_API_URL', () => {
    setApiUrl('https://ganeshtrades1.onrender.com/api/');
    expect(getBackendOrigin()).toBe('https://ganeshtrades1.onrender.com');
  });

  it('returns empty string for a relative (same-origin) base URL', () => {
    setApiUrl('/api');
    expect(getBackendOrigin()).toBe('');
  });

  it('returns empty string when VITE_API_URL is unset', () => {
    vi.unstubAllEnvs();
    expect(getBackendOrigin()).toBe('');
  });
});

describe('resolveMediaUrl', () => {
  it('prepends the backend origin to GridFS media paths', () => {
    expect(resolveMediaUrl('/api/media/abc123')).toBe('https://ganeshtrades1.onrender.com/api/media/abc123');
  });

  it('prepends the backend origin to /uploads paths', () => {
    expect(resolveMediaUrl('/uploads/product-1.webp')).toBe('https://ganeshtrades1.onrender.com/uploads/product-1.webp');
  });

  it('leaves absolute URLs untouched', () => {
    const cloudinary = 'https://res.cloudinary.com/demo/image/upload/v1/product.webp';
    expect(resolveMediaUrl(cloudinary)).toBe(cloudinary);
  });

  it('leaves same-origin relative URLs untouched when VITE_API_URL is relative', () => {
    setApiUrl('/api');
    expect(resolveMediaUrl('/api/media/abc123')).toBe('/api/media/abc123');
  });

  it('passes through empty and non-string values', () => {
    expect(resolveMediaUrl('')).toBe('');
    expect(resolveMediaUrl(undefined)).toBe(undefined);
    expect(resolveMediaUrl(null)).toBe(null);
  });

  it('passes through unrelated relative strings', () => {
    expect(resolveMediaUrl('rice.jpg')).toBe('rice.jpg');
    expect(resolveMediaUrl('default-product.png')).toBe('default-product.png');
  });
});