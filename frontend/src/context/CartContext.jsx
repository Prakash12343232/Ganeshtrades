import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem('gt_cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('gt_cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (product, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.product === product._id);
      if (existing) {
        toast.success(`Updated ${product.name} quantity`);
        return prev.map(i => i.product === product._id ? { ...i, quantity: i.quantity + quantity } : i);
      }
      toast.success(`${product.name} added to cart`);
      return [...prev, { product: product._id, name: product.name, price: product.price, image: product.image, quantity, stock: product.stock }];
    });
  };

  const removeFromCart = (productId) => {
    setItems(prev => prev.filter(i => i.product !== productId));
    toast.success('Item removed');
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity < 1) return removeFromCart(productId);
    setItems(prev => prev.map(i => i.product === productId ? { ...i, quantity } : i));
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
