import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from './NotFound.jsx';

describe('NotFound', () => {
  it('renders the 404 heading and page-not-found message', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>);
    expect(screen.getByText('404')).toBeTruthy();
    expect(screen.getByText('Page Not Found')).toBeTruthy();
  });

  it('provides a back-to-home navigation link', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>);
    const homeLink = screen.getByRole('link', { name: /back to home/i });
    expect(homeLink.getAttribute('href')).toBe('/');
  });

  it('provides a browse-products navigation link', () => {
    render(<MemoryRouter><NotFound /></MemoryRouter>);
    const productsLink = screen.getByRole('link', { name: /browse products/i });
    expect(productsLink.getAttribute('href')).toBe('/products');
  });
});