import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Gift, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";

const FreeGiftBanner = () => {
  const { user } = useAuth();
  const [hasClaimed, setHasClaimed] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [giftProducts, setGiftProducts] = useState<any[]>([]);

  useEffect(() => {
    const checkStatus = async () => {
      // 1. Check the admin banner toggle
      const { data: settingsRow } = await supabase
        .from('free_gift_settings' as any)
        .select('banner_enabled')
        .eq('id', 1)
        .maybeSingle() as any;

      if (settingsRow && settingsRow.banner_enabled === false) {
        setIsEnabled(false);
        setLoading(false);
        return;
      }

      // 2. Get enabled products from the free gift list
      const { data: giftRows } = await (supabase
        .from('free_gift_products' as any)
        .select('allowed_product_id') as any);

      const allowedGiftIds: string[] = (giftRows || []).map((r: any) => r.allowed_product_id);

      if (allowedGiftIds.length === 0) {
        setIsEnabled(false);
        setLoading(false);
        return;
      }
      setIsEnabled(true);

      // 3. Fetch product details for thumbnails
      const { data: prodData } = await supabase
        .from('allowed_products')
        .select('id, title, image_url')
        .in('id', allowedGiftIds)
        .limit(4);
      
      if (prodData) setGiftProducts(prodData);

      // 4. If logged in, check if already claimed
      if (user) {
        const { data: existingClaim } = await supabase
          .from('free_gift_claims' as any)
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (existingClaim) {
          setHasClaimed(true);
        }
      }
      setLoading(false);
    };

    checkStatus();
  }, [user]);

  if (loading || !isEnabled || hasClaimed) return null;

  return (
    <div className="container mx-auto px-4 py-4 md:py-6 animate-in fade-in slide-in-from-top-2 duration-500">
      <Link
        to="/free-gift"
        className="block group relative overflow-hidden rounded-3xl border-2 border-primary/50 bg-black/40 hover:border-primary hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] transition-all shadow-2xl min-h-[160px]"
      >
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/10 to-primary/20 opacity-30 animate-pulse" />
        
        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl pointer-events-none group-hover:bg-primary/30 transition-colors" />
        <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative px-6 md:px-10 py-8 flex flex-col md:flex-row items-center gap-8 h-full">
          {/* Main Icon and Text */}
          <div className="flex items-center gap-6 flex-1">
            <div className="relative">
              <div className="absolute inset-0 bg-primary blur-xl opacity-40 animate-pulse rounded-full" />
              <div className="relative flex h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-white items-center justify-center shrink-0 border border-white/20 shadow-xl">
                <Gift className="h-10 w-10 md:h-12 md:w-12 animate-bounce" />
              </div>
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-primary uppercase tracking-[0.2em]">
                <Sparkles className="h-4 w-4 animate-spin-slow" /> Don't Miss Out
              </div>
              <div className="font-display text-2xl md:text-4xl font-black text-white leading-tight drop-shadow-sm">
                GET A <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">FREE GAME</span> NOW!
              </div>
              <div className="text-sm md:text-base text-muted-foreground max-w-lg">
                We're giving away premium games. Claim your key instantly before stock runs out.
              </div>
            </div>
          </div>

          {/* Product Thumbnails Display */}
          <div className="hidden lg:flex items-center gap-3">
            {giftProducts.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="w-16 h-20 rounded-lg overflow-hidden border border-white/10 shadow-lg bg-secondary/50 group-hover:border-primary/50 transition-colors"
              >
                {product.image_url ? (
                  <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/5">
                    <Gift className="h-6 w-6 text-primary/40" />
                  </div>
                )}
              </motion.div>
            ))}
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary border border-primary/30">
              <span className="text-xs font-bold">+{giftProducts.length > 3 ? '...' : giftProducts.length}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-8 py-4 rounded-full bg-primary text-primary-foreground font-black uppercase tracking-widest text-sm hover:scale-105 transition-transform shadow-[0_0_20px_rgba(139,92,246,0.5)]">
            Claim Your Gift <ArrowRight className="h-5 w-5 ml-1" />
          </div>
        </div>

        {/* Shimmer effect overlay */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer" />
      </Link>
    </div>
  );
};

export default FreeGiftBanner;