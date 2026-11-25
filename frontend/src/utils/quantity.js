export const GRAMS_PER_KG = 1000;

export function roundCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function toGrams(amount, unit = 'g') {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.round(num * (String(unit).toLowerCase() === 'kg' ? GRAMS_PER_KG : 1));
}

export function calculateLoosePrice(pricePerKg, grams) {
  const rate = Number(pricePerKg);
  const weight = Number(grams);
  if (!Number.isFinite(rate) || !Number.isFinite(weight)) return 0;
  return roundCurrency((rate * weight) / GRAMS_PER_KG);
}

export function formatWeight(grams) {
  const num = Number(grams);
  if (!Number.isFinite(num) || num <= 0) return '0 g';
  if (num % GRAMS_PER_KG === 0) return `${num / GRAMS_PER_KG} kg`;
  if (num > GRAMS_PER_KG) {
    return `${Math.round((num / GRAMS_PER_KG) * 1000) / 1000} kg`;
  }
  return `${Math.round(num)} g`;
}

export function getLooseRate(product, user) {
  if (product?.wholesalePrice && user?.customerType && user.customerType !== 'public') {
    return Number(product.wholesalePrice);
  }
  const rate = product?.pricePerKg != null ? product.pricePerKg : product?.price;
  return Number(rate);
}

export function orderItemQuantityLabel(item) {
  if (item?.isLoose && item?.quantityGrams != null) return formatWeight(item.quantityGrams);
  return String(item?.quantity ?? '');
}

export function orderItemPriceLabel(item) {
  if (item?.isLoose) {
    return `₹${Number(item.pricePerKg ?? item.price ?? 0).toFixed(2)}/kg`;
  }
  return `₹${Number(item?.price ?? 0).toFixed(2)}`;
}

export function orderItemLineTotal(item) {
  if (item?.isLoose && item?.quantityGrams != null) {
    return calculateLoosePrice(item.pricePerKg ?? item.price, item.quantityGrams);
  }
  return Number(item?.total ?? (Number(item?.price ?? 0) * Number(item?.quantity ?? 0)));
}
