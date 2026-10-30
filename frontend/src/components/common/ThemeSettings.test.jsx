import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '../../context/ThemeContext';
import ThemeSettings from './ThemeSettings';

describe('ThemeSettings', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark', 'theme-fresh', 'theme-royal', 'theme-midnight', 'theme-warm');
    delete document.documentElement.dataset.theme;
  });

  it('shows all four theme cards and marks the active choice', () => {
    render(<ThemeProvider><ThemeSettings open onClose={() => {}} /></ThemeProvider>);
    expect(screen.getByRole('dialog', { name: 'Choose your theme' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Fresh Green|Royal Purple|Midnight Neon|Warm Market/ })).toHaveLength(4);
    expect(screen.getByRole('button', { name: /Midnight Neon/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('applies and persists a selection immediately', () => {
    render(<ThemeProvider><ThemeSettings open onClose={() => {}} /></ThemeProvider>);
    fireEvent.click(screen.getByRole('button', { name: /Warm Market/ }));
    expect(document.documentElement.dataset.theme).toBe('warm');
    expect(localStorage.getItem('ganesh-theme')).toBe('warm');
    expect(screen.getByRole('button', { name: /Warm Market/ }).getAttribute('aria-pressed')).toBe('true');
  });
});
