import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CartProvider, useCart } from './CartContext';

const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;

const product = { _id: 'p1', name: 'Sugar', price: 50, image: 'sugar.jpg' };
const limitedProduct = { _id: 'p2', name: 'Rice', price: 80, image: 'rice.jpg', stock: 4 };

const renderCart = () => renderHook(() => useCart(), { wrapper });

describe('CartContext', () => {
  beforeEach(() => {
    localStorage.removeItem('gt_cart');
  });

  it('starts with an empty cart', () => {
    const { result } = renderCart();
    expect(result.current.items).toEqual([]);
    expect(result.current.totalAmount).toBe(0);
    expect(result.current.totalItems).toBe(0);
  });

  it('adds a product to the cart', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(product));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ product: 'p1', name: 'Sugar', price: 50, quantity: 1 });
    expect(result.current.totalAmount).toBe(50);
    expect(result.current.totalItems).toBe(1);
  });

  it('increments quantity when the same product is added again', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(product));
    act(() => result.current.addToCart(product, 3));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(4);
    expect(result.current.totalAmount).toBe(200);
  });

  it('updates quantity for a product', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(product));
    act(() => result.current.updateQuantity('p1', 5));
    expect(result.current.items[0].quantity).toBe(5);
    expect(result.current.totalAmount).toBe(250);
  });

  it('removes the item when quantity drops below 1', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(product));
    act(() => result.current.updateQuantity('p1', 0));
    expect(result.current.items).toEqual([]);
  });

  it('removes a product from the cart', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(product));
    act(() => result.current.removeFromCart('p1'));
    expect(result.current.items).toEqual([]);
  });

  it('clears the cart', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(product));
    act(() => result.current.clearCart());
    expect(result.current.items).toEqual([]);
    expect(JSON.parse(localStorage.getItem('gt_cart'))).toEqual([]);
  });

  it('persists cart items and restores them on remount', () => {
    const first = renderCart();
    act(() => first.result.current.addToCart(product));
    first.unmount();

    const second = renderCart();
    expect(second.result.current.items).toHaveLength(1);
    expect(second.result.current.items[0].product).toBe('p1');
  });

  it('recovers gracefully from corrupt stored cart data', () => {
    localStorage.setItem('gt_cart', 'not-valid-json{{{');
    expect(() => renderCart()).not.toThrow();
    const { result } = renderCart();
    expect(result.current.items).toEqual([]);
  });

  it('falls back to empty cart when stored value is not an array', () => {
    localStorage.setItem('gt_cart', JSON.stringify({ not: 'an array' }));
    const { result } = renderCart();
    expect(result.current.items).toEqual([]);
  });

  it('clamps the first add to the product stock', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(limitedProduct, 10));
    expect(result.current.items[0].quantity).toBe(4);
    expect(result.current.totalAmount).toBe(320);
  });

  it('clamps merged quantities to the product stock', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(limitedProduct, 3));
    act(() => result.current.addToCart(limitedProduct, 5));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(4);
  });

  it('clamps updateQuantity to the product stock', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(limitedProduct, 2));
    act(() => result.current.updateQuantity('p2', 99));
    expect(result.current.items[0].quantity).toBe(4);
  });

  it('keeps quantities unbounded for products without a stock field', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(product, 5));
    act(() => result.current.updateQuantity('p1', 25));
    expect(result.current.items[0].quantity).toBe(25);
  });

  const looseProduct = {
    _id: 'p9',
    name: 'Loose Rice',
    price: 120,
    pricePerKg: 100,
    stockGrams: 5000,
    minOrderQtyGrams: 250,
    allowLooseSelling: true
  };

  it('adds loose products by grams and prices them per kg', () => {
    const { result } = renderCart();
    act(() => result.current.addLooseToCart(looseProduct, 500));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      product: 'p9',
      isLoose: true,
      quantityGrams: 500,
      pricePerKg: 100,
      stockGrams: 5000,
      minOrderQtyGrams: 250
    });
    expect(result.current.totalAmount).toBe(50);
    expect(result.current.totalItems).toBe(1);
  });

  it('merges repeated loose additions and clamps them to the gram stock', () => {
    const { result } = renderCart();
    act(() => result.current.addLooseToCart(looseProduct, 1000));
    act(() => result.current.addLooseToCart(looseProduct, 4500));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantityGrams).toBe(5000);
    expect(result.current.totalAmount).toBe(500);
  });

  it('updates loose quantities within the minimum and available gram stock', () => {
    const { result } = renderCart();
    act(() => result.current.addLooseToCart(looseProduct, 500));
    act(() => result.current.updateLooseQuantity('p9', 750));
    expect(result.current.items[0].quantityGrams).toBe(750);
    act(() => result.current.updateLooseQuantity('p9', 100));
    expect(result.current.items[0].quantityGrams).toBe(750);
    act(() => result.current.updateLooseQuantity('p9', 9000));
    expect(result.current.items[0].quantityGrams).toBe(5000);
  });

  it('keeps fixed and loose lines separate when removing a loose line', () => {
    const { result } = renderCart();
    act(() => result.current.addToCart(looseProduct, 1));
    act(() => result.current.addLooseToCart(looseProduct, 500));
    expect(result.current.items).toHaveLength(2);
    act(() => result.current.removeFromCart('p9', true));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].isLoose).toBeFalsy();
  });
});