import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cartApi } from '../api/services';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const EMPTY = { items: [], pricing: { subtotal: 0, discount: 0, tax: 0, shipping: 0, total: 0 }, itemCount: 0, hasIssues: false, couponCode: null, couponError: null };

/** The server owns the cart (persisted per user). This context just mirrors it for the UI. */
export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const isCustomer = user?.role === 'customer';

  const refresh = useCallback(async () => {
    if (!isCustomer) { setCart(EMPTY); return EMPTY; }
    setLoading(true);
    try { const r = await cartApi.get(); setCart(r.cart); return r.cart; } finally { setLoading(false); }
  }, [isCustomer]);

  useEffect(() => { refresh().catch(() => {}); }, [refresh]);

  const wrap = (fn) => async (...args) => { const r = await fn(...args); setCart(r.cart); return r.cart; };
  const value = useMemo(() => ({
    cart, loading, refresh,
    add: wrap((productId, sku, quantity = 1) => cartApi.add({ productId, sku, quantity })),
    setQty: wrap((productId, sku, quantity) => cartApi.setQty({ productId, sku, quantity })),
    remove: wrap((productId, sku) => cartApi.remove(productId, sku)),
    applyCoupon: wrap((code) => cartApi.applyCoupon(code)),
    removeCoupon: wrap(() => cartApi.removeCoupon()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cart, loading, refresh]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
export const useCart = () => useContext(CartContext);
