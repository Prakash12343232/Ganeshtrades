import { describe, expect, it } from 'vitest';
import {
  calculateLoosePrice,
  formatWeight,
  getLooseRate,
  orderItemLineTotal,
  orderItemPriceLabel,
  orderItemQuantityLabel,
  toGrams
} from './quantity';

describe('quantity helpers', () => {
  it('converts kilograms to grams', () => {
    expect(toGrams(1, 'kg')).toBe(1000);
    expect(toGrams(1.5, 'kg')).toBe(1500);
    expect(toGrams('250', 'g')).toBe(250);
    expect(toGrams(0, 'g')).toBe(0);
  });

  it('prices loose quantities from a per-kg rate and rounds to paise', () => {
    expect(calculateLoosePrice(100, 500)).toBe(50);
    expect(calculateLoosePrice(99.99, 250)).toBe(25);
    expect(calculateLoosePrice(120, 1500)).toBe(180);
    expect(calculateLoosePrice(0, 500)).toBe(0);
  });

  it('formats grams as a readable weight', () => {
    expect(formatWeight(250)).toBe('250 g');
    expect(formatWeight(1000)).toBe('1 kg');
    expect(formatWeight(1500)).toBe('1.5 kg');
    expect(formatWeight(0)).toBe('0 g');
  });

  it('uses the wholesale per-kg rate for non-public customers', () => {
    const product = { price: 120, pricePerKg: 110, wholesalePrice: 95 };
    expect(getLooseRate(product, null)).toBe(110);
    expect(getLooseRate(product, { customerType: 'public' })).toBe(110);
    expect(getLooseRate(product, { customerType: 'wholesale' })).toBe(95);
  });

  it('labels and totals loose order items', () => {
    const item = { isLoose: true, price: 100, pricePerKg: 100, quantity: 500, quantityGrams: 500 };
    expect(orderItemQuantityLabel(item)).toBe('500 g');
    expect(orderItemPriceLabel(item)).toBe('₹100.00/kg');
    expect(orderItemLineTotal(item)).toBe(50);
  });

  it('labels and totals fixed order items', () => {
    const item = { price: 120, quantity: 2, total: 240 };
    expect(orderItemQuantityLabel(item)).toBe('2');
    expect(orderItemPriceLabel(item)).toBe('₹120.00');
    expect(orderItemLineTotal(item)).toBe(240);
  });
});
