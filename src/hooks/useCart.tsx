import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode, type Context } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNewAccountLimit } from "@/hooks/useNewAccountLimit";
import { toast } from "sonner";

export interface CartItem {
  cartItemId: string;
  offerId: string;
  title: string;
  platform: string;
  price: number;
  sellerName: string;
  image_url: string | null;
  quantity: number;
  maxStock?: number;
}

interface CartContextType {
  items: CartItem[];
  /** Returns true when the item was actually added, false when rejected (e.g. new-account €20 cap). */
  addItem: (item: Omit<CartItem, "cartItemId" | "quantity">, options?: { silent?: boolean }) => boolean;
  /** Whether adding an item at this price would be allowed right now. */
  canAddItem: (price: number) => boolean;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (offerId: string, delta: number) => void;
  /** Corrects a cart item's price in place (e.g. a live supplier-price re-check at checkout). */
  updatePrice: (offerId: string, newPrice: number) => void;
  clearCart: () => void;
  count: number;
  total: number;
}

const CART_STORAGE_KEY = "agevers_cart";

const loadCart = (): CartItem[] => {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
};

const saveCart = (items: CartItem[]) => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {}
};

// Keep a single context instance across HMR module reloads, otherwise a hot-updated
// consumer reads a fresh context while the provider still uses the old one.
const globalRef = globalThis as unknown as { __ageversCartContext?: Context<CartContextType | undefined> };
const CartContext =
  globalRef.__ageversCartContext ??
  (globalRef.__ageversCartContext = createContext<CartContextType | undefined>(undefined));

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const { isLimited: newAccountLimited, limitEur } = useNewAccountLimit();
  // Synchronous mirror of `items`, kept current inside addItem/updateQuantity
  // (in addition to the passive useEffect below) so a same-tick sequence of
  // calls — e.g. BundlesSection adding every product in a bundle in one
  // forEach — sees each other's effect on the running cart total instead of
  // all reading the same stale total.
  const itemsRef = useRef<CartItem[]>(items);

  // Persist to localStorage on every change
  useEffect(() => {
    saveCart(items);
  }, [items]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Static import (not dynamic) — a dynamic import().then() here raced
  // against callers that navigate immediately after addItem() returns (e.g.
  // Buy Now → /checkout), so the toast could get fired but never actually
  // render before the route changed.
  const showLimitToast = (description: string) => {
    toast.error("Account Security Limit", { description, duration: 6000 });
  };

  // Distinct from showLimitToast: this is the standard per-item purchase
  // cap (cheap items max 3, expensive items max 1) that applies to every
  // account, not just new ones — a different toast title so it doesn't
  // read as an account-specific restriction.
  const showQuantityLimitToast = (description: string) => {
    toast.error("Purchase Limit", { description, duration: 6000 });
  };

  // Re-validate the cart against the new-account €20 limit whenever it's in
  // effect — the addItem() check alone doesn't cover items added while
  // browsing as a guest (not logged in yet, so the check was skipped) or
  // sitting in localStorage from before the limit applied. This runs on
  // every mount/render where the limit is active, so such items get pruned
  // rather than silently reaching checkout. The limit is on the cart's
  // TOTAL value, not any single item's price, so items are kept in order
  // while the running sum stays within the limit and everything past that
  // point is dropped.
  useEffect(() => {
    if (!newAccountLimited) return;
    setItems((prev) => {
      let runningTotal = 0;
      const kept: CartItem[] = [];
      for (const i of prev) {
        const lineTotal = i.price * i.quantity;
        if (runningTotal + lineTotal <= limitEur) {
          kept.push(i);
          runningTotal += lineTotal;
        }
      }
      if (kept.length !== prev.length) {
        showLimitToast(
          `Removed item(s) from your cart — new accounts are limited to €${limitEur} total in cart for the first 24 hours.`
        );
        itemsRef.current = kept;
        return kept;
      }
      return prev;
    });
  }, [newAccountLimited, limitEur]);

  // Sync cart snapshot to database for abandoned cart emails (debounced)
  useEffect(() => {
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      if (items.length === 0) {
        await supabase.from("abandoned_carts" as any).delete().eq("user_id", auth.user.id);
      } else {
        await supabase.from("abandoned_carts" as any).upsert({
          user_id: auth.user.id,
          cart_items: items as any,
          email_sent: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }
    }, 1500);
    return () => clearTimeout(syncTimerRef.current);
  }, [items]);

  const canAddItem = useCallback((price: number) => {
    if (!newAccountLimited) return true;
    const currentTotal = itemsRef.current.reduce((sum, i) => sum + i.price * i.quantity, 0);
    return currentTotal + price <= limitEur;
  }, [newAccountLimited, limitEur]);

  const addItem = useCallback((item: Omit<CartItem, "cartItemId" | "quantity">, options?: { silent?: boolean }): boolean => {
    const prev = itemsRef.current;

    // 1. Enforce new account limit: cart TOTAL (existing + this item) capped
    // at €limitEur for the first 24h, unless exempt.
    if (newAccountLimited) {
      const currentTotal = prev.reduce((sum, i) => sum + i.price * i.quantity, 0);
      if (currentTotal + item.price > limitEur) {
        showLimitToast(
          `Adding "${item.title}" would put your cart over €${limitEur} — new accounts are limited to €${limitEur} total in cart for the first 24 hours.`
        );
        return false;
      }
    }

    // 2. Enforce standard purchase limits based on price: cheap items (≤€15) max 3, expensive items max 1
    const priceLimit = item.price <= 15 ? 3 : 1;
    const effectiveMaxStock = item.maxStock ? Math.min(item.maxStock, priceLimit) : priceLimit;

    const existing = prev.find((i) => i.offerId === item.offerId);
    let next: CartItem[];
    if (existing) {
      const max = effectiveMaxStock;
      if (max && existing.quantity >= max) {
        showQuantityLimitToast(`You already have the maximum of ${max} "${item.title}" in your cart.`);
        // Nothing changed — false so a "Buy Now" caller stops here and the
        // customer actually sees the toast, instead of navigating straight
        // to checkout as if a fresh unit had just been added.
        return false;
      }
      next = prev.map((i) =>
        i.offerId === item.offerId ? { ...i, quantity: i.quantity + 1, maxStock: max } : i
      );
    } else {
      next = [...prev, { ...item, cartItemId: crypto.randomUUID(), quantity: 1, maxStock: effectiveMaxStock }];
    }

    itemsRef.current = next;
    setItems(next);
    if (!options?.silent) {
      toast.success("Added to cart", { description: item.title });
    }
    return true;
  }, [newAccountLimited, limitEur]);

  const removeItem = useCallback((cartItemId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.cartItemId !== cartItemId);
      itemsRef.current = next;
      return next;
    });
  }, []);

  const updateQuantity = useCallback((offerId: string, delta: number) => {
    const prev = itemsRef.current;
    const target = prev.find((i) => i.offerId === offerId);

    // Increasing quantity is subject to the same cart-total cap as adding a
    // new item; decreasing is always allowed.
    if (delta > 0 && newAccountLimited && target) {
      const currentTotal = prev.reduce((sum, i) => sum + i.price * i.quantity, 0);
      if (currentTotal + target.price * delta > limitEur) {
        showLimitToast(
          `Increasing this quantity would put your cart over €${limitEur} — new accounts are limited to €${limitEur} total in cart for the first 24 hours.`
        );
        return;
      }
    }

    // Standard per-item purchase cap (see addItem) — explain why the
    // increase didn't happen instead of leaving the customer to guess.
    if (delta > 0 && target?.maxStock && target.quantity + delta > target.maxStock) {
      showQuantityLimitToast(`You can order up to ${target.maxStock} "${target.title}" per order.`);
      return;
    }

    const next = prev
      .map((i) => {
        if (i.offerId !== offerId) return i;
        const newQty = i.quantity + delta;
        if (i.maxStock && newQty > i.maxStock) return i; // cap at max (safety net)
        return { ...i, quantity: newQty };
      })
      .filter((i) => i.quantity > 0);
    itemsRef.current = next;
    setItems(next);
  }, [newAccountLimited, limitEur]);

  const updatePrice = useCallback((offerId: string, newPrice: number) => {
    setItems((prev) => {
      const next = prev.map((i) => (i.offerId === offerId ? { ...i, price: newPrice } : i));
      itemsRef.current = next;
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    itemsRef.current = [];
    setItems([]);
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, canAddItem, removeItem, updateQuantity, updatePrice, clearCart, count, total }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};