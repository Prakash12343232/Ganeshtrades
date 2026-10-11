import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductImage from './ProductImage';

describe('ProductImage component', () => {
  it('renders a clean fallback placeholder when src is missing or empty', () => {
    render(<ProductImage src="" alt="Test Product" />);
    const fallback = screen.getByTestId('product-image-fallback');
    expect(fallback).toBeInTheDocument();
    expect(screen.getByText('No Photo')).toBeInTheDocument();
  });

  it('hides the fallback label when showFallbackLabel is false', () => {
    render(<ProductImage src="" alt="Cart Product" showFallbackLabel={false} />);
    const fallback = screen.getByTestId('product-image-fallback');
    expect(fallback).toBeInTheDocument();
    expect(screen.queryByText('No Photo')).not.toBeInTheDocument();
  });

  it('renders a clean fallback when default-product placeholder is supplied', () => {
    render(<ProductImage src="/uploads/default-product.png" alt="Fallback Product" />);
    expect(screen.getByTestId('product-image-fallback')).toBeInTheDocument();
  });

  it('renders an img tag with resolved URL for valid src and switches to fallback on error', () => {
    const { container } = render(<ProductImage src="https://example.com/product.jpg" alt="Valid Product" />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/product.jpg');

    // Trigger image loading failure
    fireEvent.error(img);
    expect(screen.getByTestId('product-image-fallback')).toBeInTheDocument();
  });
});
