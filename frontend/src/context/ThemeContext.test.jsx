import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { THEMES, ThemeProvider, useTheme } from './ThemeContext';

const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;
const renderTheme = () => renderHook(() => useTheme(), { wrapper });

function clearDocumentTheme() {
  document.documentElement.classList.remove('light', 'dark', 'theme-fresh', 'theme-royal', 'theme-midnight', 'theme-warm');
  delete document.documentElement.dataset.theme;
}

describe('ThemeContext', () => {
  afterEach(() => {
    localStorage.clear();
    clearDocumentTheme();
  });

  it('exposes all four named themes and defaults to Midnight Neon', () => {
    const { result } = renderTheme();
    expect(Object.keys(result.current.themes)).toEqual(['fresh', 'royal', 'midnight', 'warm']);
    expect(result.current.theme).toBe('midnight');
    expect(document.documentElement.dataset.theme).toBe('midnight');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(THEMES.fresh.colors).toEqual(['#176B45', '#B7E4B0', '#F7FAF5', '#FFFFFF']);
    expect(THEMES.royal.colors).toEqual(['#6D28D9', '#C4B5FD', '#F8F7FF', '#FFFFFF']);
    expect(THEMES.warm.colors).toEqual(['#C65D32', '#F2D5A7', '#FFF8EC', '#FFFFFF']);
  });

  it('switches immediately, applies the theme class and persists each selection', () => {
    const { result } = renderTheme();
    for (const id of ['fresh', 'royal', 'warm', 'midnight']) {
      act(() => result.current.setTheme(id));
      expect(result.current.theme).toBe(id);
      expect(document.documentElement.dataset.theme).toBe(id);
      expect(document.documentElement.classList.contains(`theme-${id}`)).toBe(true);
      expect(localStorage.getItem('ganesh-theme')).toBe(id);
    }
  });

  it('restores a saved theme and supports legacy light/dark preferences', () => {
    localStorage.setItem('ganesh-theme', 'royal');
    const first = renderTheme();
    expect(first.result.current.theme).toBe('royal');
    first.unmount();

    localStorage.removeItem('ganesh-theme');
    localStorage.setItem('theme', 'light');
    const legacy = renderTheme();
    expect(legacy.result.current.theme).toBe('fresh');
  });

  it('ignores unsupported theme selections and invalid stored values', () => {
    localStorage.setItem('ganesh-theme', 'not-a-theme');
    const { result } = renderTheme();
    expect(result.current.theme).toBe('midnight');
    act(() => result.current.setTheme('not-a-theme'));
    expect(result.current.theme).toBe('midnight');
  });
});

describe('useTheme outside provider', () => {
  it('throws when used without a ThemeProvider', () => {
    expect(() => renderHook(() => useTheme())).toThrow('useTheme must be used within a ThemeProvider');
  });
});
