import { useState } from 'react';
import { FiShoppingCart } from 'react-icons/fi';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import {
  calculateLoosePrice,
  formatWeight,
  getLooseRate,
  toGrams
} from '../../utils/quantity';

export default function LooseOrderControl({ product, large = false }) {
  const { addLooseToCart } = useCart();
  const auth = useAuth();
  const user = auth?.user;
  const minGrams = Math.max(1, Number(product.minOrderQtyGrams) || 1);
  const stockGrams = Math.max(0, Number(product.stockGrams) || 0);
  const rate = getLooseRate(product, user);

  const [unit, setUnit] = useState(minGrams >= 1000 ? 'kg' : 'g');
  const [amount, setAmount] = useState(() => {
    const initial = minGrams >= 1000 ? minGrams / 1000 : minGrams;
    return String(initial);
  });

  const grams = toGrams(amount, unit);
  const total = calculateLoosePrice(rate, grams);

  const error = (() => {
    if (stockGrams <= 0) return 'Out of stock';
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return 'Enter a valid weight';
    if (grams < minGrams) return `Minimum ${formatWeight(minGrams)}`;
    if (grams > stockGrams) return `Only ${formatWeight(stockGrams)} available`;
    return '';
  })();

  const disabled = Boolean(error);

  const handleAdd = () => {
    if (disabled) return;
    addLooseToCart(product, grams, { pricePerKg: rate, user });
  };

  const inputClass = large
    ? 'w-20 px-3 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-mint-500'
    : 'w-16 px-2 py-1.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-mint-500';
  const selectClass = large
    ? 'px-2 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-mint-500'
    : 'px-1.5 py-1.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-mint-500';
  const buttonClass = large
    ? 'flex-1 flex items-center justify-center gap-2 py-3.5 bg-mint-500 text-navy-950 rounded-xl font-extrabold hover:bg-mint-400 transition-all disabled:opacity-40 shadow-lg shadow-mint-500/20'
    : 'p-2 bg-mint-500 text-navy-950 font-bold rounded-lg hover:bg-mint-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className={large ? 'space-y-2' : 'mt-2 space-y-1.5'}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={unit === 'kg' ? '0.001' : '1'}
          step={unit === 'kg' ? '0.05' : '10'}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          aria-label={`Quantity for ${product.name}`}
          className={inputClass}
        />
        <select
          value={unit}
          onChange={e => setUnit(e.target.value)}
          aria-label={`Weight unit for ${product.name}`}
          className={selectClass}
        >
          <option value="g">g</option>
          <option value="kg">kg</option>
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className={buttonClass}
          aria-label={`Add ${product.name} by weight to cart`}
        >
          <FiShoppingCart className="w-4 h-4" />
          {large && (disabled ? 'Unavailable' : `Add ${formatWeight(grams)}`)}
        </button>
      </div>
      <div className={`flex items-center justify-between gap-2 ${large ? 'text-xs' : 'text-[11px]'}`}>
        <span className={error ? 'font-medium text-rose-500' : 'text-slate-500 dark:text-slate-400'}>
          {error || `₹${total.toFixed(2)} · ${formatWeight(stockGrams)} available`}
        </span>
        <span className="text-slate-500 dark:text-slate-400">₹{Number(rate).toFixed(2)}/kg</span>
      </div>
    </div>
  );
}
