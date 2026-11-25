import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { calculateLoosePrice, formatWeight, getLooseRate } from '../utils/quantity';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

const getStoredCart = () => {
  try {
    const saved = localStorage.getItem('gt_cart');
    const items = saved ? JSON.parse(saved) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    localStorage.removeItem('gt_cart');
    return [];
  }
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(getStoredCart);

  useEffect(() => {
    localStorage.setItem('gt_cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (product, quantity = 1) => {
    setItems(prev => {
      const stock = product.stock != null ? product.stock : Infinity;
      const clampedQty = Math.max(1, Math.min(quantity, stock));
      const existing = prev.find(i => i.product === product._id && !i.isLoose);
      if (existing) {
        const nextQty = Math.min(existing.quantity + clampedQty, existing.stock != null ? existing.stock : Infinity);
        if (nextQty !== existing.quantity + clampedQty) {
          toast.success(`${product.name} limited to ${nextQty} — only ${existing.stock} in stock`);
        } else {
          toast.success(`Updated ${product.name} quantity`);
        }
        return prev.map(i => i.product === product._id && !i.isLoose ? { ...i, quantity: nextQty, stock: existing.stock ?? stock } : i);
      }
      if (clampedQty < quantity) {
        toast.success(`${product.name} limited to ${clampedQty} — only ${stock} in stock`);
      } else {
        toast.success(`${product.name} added to cart`);
      }
      if (clampedQty === 0) return prev;
      return [...prev, { product: product._id, name: product.name, price: product.price, image: product.image, quantity: clampedQty, stock }];
    });
  };

  const addLooseToCart = (product, grams, options = {}) => {
    const stockGrams = Number(options.stockGrams ?? product.stockGrams ?? 0);
    const minGrams = Math.max(1, Number(options.minOrderQtyGrams ?? product.minOrderQtyGrams ?? 1));
    const requested = Math.round(Number(grams));

    if (!Number.isFinite(requested) || requested < minGrams) {
      toast.error(`Minimum order is ${formatWeight(minGrams)}`);
      return;
    }
    if (stockGrams <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    if (requested > stockGrams) {
      toast.error(`Only ${formatWeight(stockGrams)} available`);
      return;
    }

    const rate = Number(options.pricePerKg ?? getLooseRate(product, options.user));

    setItems(prev => {
      const existing = prev.find(i => i.product === product._id && i.isLoose);
      if (existing) {
        const nextGrams = Math.min((existing.quantityGrams || 0) + requested, stockGrams);
        if (nextGrams !== (existing.quantityGrams || 0) + requested) {
          toast.success(`${product.name} limited to ${formatWeight(nextGrams)} — only ${formatWeight(stockGrams)} in stock`);
        } else {
          toast.success(`Updated ${product.name} quantity`);
        }
        return prev.map(i => i.product === product._id && i.isLoose
          ? { ...i, quantityGrams: nextGrams, stockGrams, minOrderQtyGrams: minGrams, pricePerKg: rate, price: rate }
          : i);
      }

      toast.success(`${product.name} added to cart (${formatWeight(requested)})`);
      return [...prev, {
        product: product._id,
        name: product.name,
        image: product.image,
        isLoose: true,
        quantityGrams: requested,
        minOrderQtyGrams: minGrams,
        stockGrams,
        pricePerKg: rate,
        price: rate
      }];
    });
  };

  const removeFromCart = (productId, isLoose) => {
    setItems(prev => prev.filter(i => {
      if (i.product !== productId) return true;
      return isLoose == null ? false : Boolean(i.isLoose) !== Boolean(isLoose);
    }));
    toast.success('Item removed');
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) return removeFromCart(productId, false);
    setItems(prev => prev.map(i => {
      if (i.product !== productId || i.isLoose) return i;
      const maxQty = i.stock != null ? i.stock : Infinity;
      return { ...i, quantity: Math.min(quantity, maxQty) };
    }));
  };

  const updateLooseQuantity = (productId, grams) => {
    const requested = Math.round(Number(grams));
    if (!Number.isFinite(requested)) return;
    setItems(prev => prev.map(i => {
      if (i.product !== productId || !i.isLoose) return i;
      const minGrams = Math.max(1, Number(i.minOrderQtyGrams) || 1);
      const maxGrams = i.stockGrams != null ? Number(i.stockGrams) : Infinity;
      if (requested < minGrams) return i;
      return { ...i, quantityGrams: Math.min(requested, maxGrams) };
    }));
  };

  const clearCart = () => { setItems([]); localStorage.removeItem('gt_cart'); };

  const totalItems = items.reduce((sum, i) => sum + (i.isLoose ? 1 : (i.quantity || 0)), 0);
  const totalAmount = items.reduce((sum, i) => {
    if (i.isLoose) {
      return sum + calculateLoosePrice(i.pricePerKg ?? i.price, i.quantityGrams);
    }
    return sum + ((i.price || 0) * i.quantity);
  }, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, addLooseToCart, removeFromCart, updateQuantity, updateLooseQuantity, clearCart, totalItems, totalAmount }}>
      {children}
    </CartContext.Provider>
  );
};
