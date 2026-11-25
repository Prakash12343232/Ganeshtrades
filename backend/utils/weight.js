const GRAMS_PER_KG = 1000;
const MAX_ORDER_GRAMS = 100000;
const MAX_STOCK_GRAMS = 100000000;

function roundCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function normalizeWeightUnit(unit) {
  const normalized = String(unit == null ? 'g' : unit).trim().toLowerCase();
  return normalized === 'g' || normalized === 'kg' ? normalized : null;
}

function parseWeightToGrams(value, unit = 'g', options = {}) {
  const { fieldName = 'quantity', maxGrams = MAX_ORDER_GRAMS } = options;
  const normalizedUnit = normalizeWeightUnit(unit);
  if (!normalizedUnit) {
    const err = new Error(`Invalid ${fieldName}: unit must be "g" or "kg"`);
    err.exposed = true;
    throw err;
  }

  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    const err = new Error(`Invalid ${fieldName}: must be a positive weight`);
    err.exposed = true;
    throw err;
  }

  const grams = Math.round(num * (normalizedUnit === 'kg' ? GRAMS_PER_KG : 1));
  if (!Number.isFinite(grams) || grams < 1) {
    const err = new Error(`Invalid ${fieldName}: weight is too small`);
    err.exposed = true;
    throw err;
  }
  if (grams > maxGrams) {
    const err = new Error(`Invalid ${fieldName}: weight cannot exceed ${formatWeight(maxGrams)}`);
    err.exposed = true;
    throw err;
  }

  return grams;
}

function calculateLoosePrice(pricePerKg, grams) {
  const rate = Number(pricePerKg);
  const weight = Number(grams);
  if (!Number.isFinite(rate) || !Number.isFinite(weight)) return 0;
  return roundCurrency((rate * weight) / GRAMS_PER_KG);
}

function formatWeight(grams) {
  const num = Number(grams);
  if (!Number.isFinite(num) || num <= 0) return '0 g';
  if (num % GRAMS_PER_KG === 0) return `${num / GRAMS_PER_KG} kg`;
  if (num > GRAMS_PER_KG) {
    return `${Math.round((num / GRAMS_PER_KG) * 1000) / 1000} kg`;
  }
  return `${Math.round(num)} g`;
}

module.exports = {
  GRAMS_PER_KG,
  MAX_ORDER_GRAMS,
  MAX_STOCK_GRAMS,
  roundCurrency,
  normalizeWeightUnit,
  parseWeightToGrams,
  calculateLoosePrice,
  formatWeight
};
