import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';

const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

const renderTheme = () => renderHook(() => useTheme(), { wrapper });

function clearDocumentThemeClasses() {
  document.documentElement.classList.remove('light', 'dark');
}

describe('ThemeContext', () => {
  afterEach(() => {
    clearDocumentThemeClasses();
  });

  it('defaults to dark theme and applies the dark class', () => {
    const { result } = renderTheme();
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('toggleTheme switches between dark and light and updates the document class', () => {
    const { result } = renderTheme();
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists the chosen theme in localStorage', () => {
    const { result } = renderTheme();
    act(() => result.current.toggleTheme());
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('restores a saved light preference on mount', () => {
    localStorage.setItem('theme', 'light');
    const { result } = renderTheme();
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('keeps dark when a stored value is not a known light theme', () => {
    localStorage.setItem('theme', 'garbage');
    const { result } = renderTheme();
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

describe('useTheme outside provider', () => {
  it('throws when used without a ThemeProvider', () => {
    expect(() => renderHook(() => useTheme())).toThrow('useTheme must be used within a ThemeProvider');
  });
});