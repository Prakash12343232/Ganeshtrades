import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

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
      const existing = prev.find(i => i.product === product._id);
      if (existing) {
        const nextQty = Math.min(existing.quantity + clampedQty, existing.stock != null ? existing.stock : Infinity);
        if (nextQty !== existing.quantity + clampedQty) {
          toast.success(`${product.name} limited to ${nextQty} — only ${existing.stock} in stock`);
        } else {
          toast.success(`Updated ${product.name} quantity`);
        }
        return prev.map(i => i.product === product._id ? { ...i, quantity: nextQty, stock: existing.stock ?? stock } : i);
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

  const removeFromCart = (productId) => {
    setItems(prev => prev.filter(i => i.product !== productId));
    toast.success('Item removed');
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) return removeFromCart(productId);
    setItems(prev => prev.map(i => {
      if (i.product !== productId) return i;
      const maxQty = i.stock != null ? i.stock : Infinity;
      return { ...i, quantity: Math.min(quantity, maxQty) };
    }));
  };

  const clearCart = () => { setItems([]); localStorage.removeItem('gt_cart'); };

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalAmount }}>
      {children}
    </CartContext.Provider>
  );
};
