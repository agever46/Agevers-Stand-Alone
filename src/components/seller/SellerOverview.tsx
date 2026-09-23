import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Profile {
  display_name: string | null;
  avatar_url: string | null;
}

interface Product {
  id: string;
  title: string;
  image_url: string | null;
  status: string;
}

interface Order {
  id: string;
  game_title: string;
  platform: string;
  price: number;
  status: string;
  created_at: string;
}

interface SellerOverviewProps {
  products: Product[];
  onViewSelling: () => void;
  onEditProfile: () => void;
}

const SellerOverview = ({ products, onViewSelling, onEditProfile }: SellerOverviewProps) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>({ display_name: null, avatar_url: null });
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [onHoldEarnings, setOnHoldEarnings] = useState(0);
  const [availableEarnings, setAvailableEarnings] = useState(0);

  useEffect(() => {
    if (!user) return;
    // Fetch profile
    supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) { setProfile(data); setAvatarLoadError(false); } });
    // Fetch orders (purchases)
    // Explicit column list (excludes `game_code`, which is no longer readable
    // via PostgREST for regular users after security hardening).
    supabase.from("orders").select("id, game_title, platform, price, status, created_at, paypal_order_id, quantity, image_url, code_delivered, is_held").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6)
      .then(({ data }) => { if (data) setOrders(data); });
    // Calculate earnings from seller sales with hold period
    supabase.from("seller_sales").select("net_earnings, available_at").eq("seller_id", user.id)
      .then(({ data }) => {
        if (data) {
          const now = new Date();
          let available = 0;
          let onHold = 0;
          data.forEach((s: any) => {
            const amount = Number(s.net_earnings);
            if (new Date(s.available_at) <= now) {
              available += amount;
            } else {
              onHold += amount;
            }
          });
          setAvailableEarnings(available);
          setOnHoldEarnings(onHold);
          setTotalEarnings(available + onHold);
        }
      });
  }, [user]);

  const activeProducts = products.filter(p => p.status === "active").slice(0, 3);
  const avatarUrl = profile.avatar_url
    ? (profile.avatar_url.startsWith("http")
        ? profile.avatar_url
        : supabase.storage.from("product-images").getPublicUrl(profile.avatar_url).data.publicUrl)
    : null;

  return (
    <div>
      <h1 className="font-display text-2xl font-black tracking-wider text-foreground mb-6">OVERVIEW</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile card */}
          <div className="glass rounded-xl p-6">
            <h2 className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase mb-4">Profile</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg overflow-hidden">
                  {avatarUrl && !avatarLoadError ? (
                    <img
                      src={avatarUrl}
                      alt={profile.display_name || "Seller avatar"}
                      className="h-full w-full object-cover"
                      onError={() => setAvatarLoadError(true)}
                    />
                  ) : (
                    profile.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?"
                  )}
                </div>
                <div>
                  <p className="font-display font-bold text-foreground">{profile.display_name || "Seller"}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Total Balance card */}
          <div className="glass rounded-xl p-6">
            <h2 className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">Total Balance</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-3xl font-black text-primary">€{availableEarnings.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-1">Available earnings from completed orders</p>
              </div>
            </div>

            <div className="mt-6 space-y-4 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase">Earnings Balance</p>
                  <p className="text-xs text-muted-foreground">Available for withdrawal</p>
                </div>
                <p className="font-display font-bold text-foreground">€{availableEarnings.toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between border-t border-border/50 pt-4">
                <div>
                  <p className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase">On-Hold Balance</p>
                  <p className="text-xs text-muted-foreground">Will be available after on-hold period ends</p>
                </div>
                <p className="font-display font-bold text-foreground">€{onHoldEarnings.toFixed(2)}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Currently Selling */}
          <div className="glass rounded-xl p-6">
            <h2 className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase mb-4">Currently Selling</h2>
            {activeProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {activeProducts.map((p) => (
                    <div key={p.id} className="aspect-[3/4] rounded-lg overflow-hidden bg-secondary">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px] text-center px-1 font-display">
                          {p.title}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full text-xs" onClick={onViewSelling}>
                  <Eye className="h-3.5 w-3.5 mr-2" />
                  View currently selling
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No active products</p>
            )}
          </div>

          {/* Latest Purchases */}
          <div className="glass rounded-xl p-6">
            <h2 className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase mb-4">Latest Purchases</h2>
            {orders.length > 0 ? (
              <div className="space-y-3">
                {orders.slice(0, 3).map((o) => (
                  <div key={o.id} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{o.game_title}</p>
                      <p className="text-[10px] text-muted-foreground">{o.platform}</p>
                    </div>
                    <span className="text-xs font-bold text-primary shrink-0">€{o.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No purchases yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerOverview;
