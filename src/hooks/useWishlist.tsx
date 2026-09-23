import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface WishlistContextType {
  ids: Set<string>;          // allowed_product_id set
  count: number;
  isInWishlist: (allowedProductId: string) => boolean;
  toggle: (params: {
    allowedProductId: string;
    title: string;
    platform: string;
    image_url: string | null;
    price: number | null;
  }) => Promise<{ added: boolean; needsAuth?: boolean }>;
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!user) {
      setIds(new Set());
      return;
    }
    const { data } = await supabase
      .from("wishlist")
      .select("allowed_product_id")
      .eq("user_id", user.id);
    const next = new Set<string>();
    (data || []).forEach((row: any) => {
      if (row.allowed_product_id) next.add(row.allowed_product_id);
    });
    setIds(next);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isInWishlist = useCallback((id: string) => ids.has(id), [ids]);

  const toggle = useCallback<WishlistContextType["toggle"]>(async ({
    allowedProductId, title, platform, image_url, price,
  }) => {
    if (!user) return { added: false, needsAuth: true };
    if (ids.has(allowedProductId)) {
      await supabase
        .from("wishlist")
        .delete()
        .eq("user_id", user.id)
        .eq("allowed_product_id", allowedProductId);
      setIds(prev => {
        const next = new Set(prev);
        next.delete(allowedProductId);
        return next;
      });
      return { added: false };
    }
    const { error } = await supabase.from("wishlist").insert({
      user_id: user.id,
      allowed_product_id: allowedProductId,
      game_title: title,
      platform,
      image_url,
      price,
      price_at_add: price,
    });
    if (!error || error.code === "23505") {
      setIds(prev => new Set(prev).add(allowedProductId));
      return { added: true };
    }
    return { added: false };
  }, [user, ids]);

  const value = useMemo<WishlistContextType>(() => ({
    ids,
    count: ids.size,
    isInWishlist,
    toggle,
    refresh,
  }), [ids, isInWishlist, toggle, refresh]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
};