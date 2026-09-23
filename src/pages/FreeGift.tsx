import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, Sparkles, CheckCircle2, AlertCircle, ArrowRight, Lock, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import AgeversLoader from "@/components/AgeversLoader";
import { motion } from "framer-motion";

interface Product {
  id: string;
  title: string;
  image_url: string | null;
  platform: string;
  platform_details: string | null;
  region: string;
  slug: string;
  claimed_count?: number;
}

const FreeGift = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<{ held: boolean; code: string | null; productTitle: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Get enabled products from the free gift list
        const { data: giftRows } = await supabase
          .from('free_gift_products')
          .select('allowed_product_id');

        const allowedGiftIds: string[] = (giftRows || []).map((r: any) => r.allowed_product_id);
        if (allowedGiftIds.length === 0) {
          setIsEnabled(false);
          setLoading(false);
          return;
        }
        setIsEnabled(true);

        // 2. Fetch claim counts for stock display — via RPC so this stays
        // anonymous-safe (aggregate counts only, no user_id/paypal_order_id).
        const { data: claimCounts, error: countsError } = await supabase
          .rpc('get_free_gift_claim_counts');

        if (countsError) {
          console.error('Error fetching claim counts:', countsError);
        }

        const countsMap: Record<string, number> = {};
        if (Array.isArray(claimCounts)) {
          claimCounts.forEach((c: any) => {
            countsMap[c.allowed_product_id] = Number(c.claim_count) || 0;
          });
        }

        // 3. Fetch product details
        const { data: prodData } = await supabase
          .from('allowed_products')
          .select('id, title, image_url, platform, platform_details, region, slug')
          .in('id', allowedGiftIds);
        
        const productsWithStock = (prodData || []).map(p => ({
          ...p,
          claimed_count: countsMap[p.id] || 0
        }));
        
        setProducts(productsWithStock);

        // 3. If logged in, check claim status
        if (user) {
          const { data: claim } = await supabase
            .from('free_gift_claims')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
          if (claim) setHasClaimed(true);
        }
      } catch (err) {
        console.error('Error fetching free gift data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) fetchData();
  }, [user, authLoading]);

  const handleClaim = async (productId: string) => {
    if (!user) {
      navigate('/auth?reason=free_gift');
      return;
    }
    if (claiming) return;

    setSelectedProductId(productId);

    // First step: Trigger verification code
    setClaiming(productId);
    try {
      const { data, error } = await supabase.functions.invoke('purchase-otp', {
        body: { action: "send", channel: "email" }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setShowVerify(true);
      toast.info("A verification code has been sent to your email.");
    } catch (err: any) {
      toast.error(err.message || "Failed to send verification code");
    } finally {
      setClaiming(null);
    }
  };

  const verifyAndClaim = async () => {
    console.log("verifyAndClaim called", { selectedProductId, user: !!user, verifyCode });
    if (!selectedProductId || !user) {
      console.error("Missing selectedProductId or user", { selectedProductId, user: !!user });
      return;
    }
    // Guard against double-submission: the button's disabled={isVerifying}
    // doesn't take effect until after re-render, so a fast double-click can
    // fire this twice before that lands. Two concurrent calls race on the
    // same OTP code — one consumes it, the other sees it as already used
    // and reports "Invalid or expired code" even though verification
    // actually succeeded moments earlier.
    if (isVerifying) return;

    setIsVerifying(true);
    try {
      // 1. Verify OTP
      console.log("Invoking purchase-otp verify...");
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('purchase-otp', {
        body: { action: "verify", code: verifyCode }
      });
      
      console.log("purchase-otp verify result:", { verifyData, verifyError });

      if (verifyError || verifyData?.error) {
        console.error("OTP verification error:", verifyError || verifyData?.error);
        throw new Error(verifyData?.error || verifyError?.message || "Invalid code");
      }
      if (!verifyData?.verified) throw new Error("Verification failed: code might be incorrect or expired.");

      // 2. Claim gift
      console.log("Invoking claim-free-gift...");
      const { data, error } = await supabase.functions.invoke('claim-free-gift', {
        body: { product_id: selectedProductId }
      });

      console.log("claim-free-gift result:", { data, error });

      if (error) {
        // supabase-js gives a generic FunctionsHttpError on non-2xx responses —
        // the actual { error: "..." } body claim-free-gift sent back is only
        // reachable via error.context (the raw, unconsumed Response).
        let serverMessage: string | null = null;
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.clone().json();
            serverMessage = body?.error || null;
          }
        } catch (parseErr) {
          console.error("Could not parse claim-free-gift error body:", parseErr);
        }
        console.error("claim-free-gift error detail:", serverMessage || error.message);
        throw new Error(serverMessage || error.message);
      }
      if (data?.error) throw new Error(data.error);

      const productTitle = products.find(p => p.id === selectedProductId)?.title || "Your game";
      toast.success(data?.message || "Gift claimed successfully!");
      setHasClaimed(true);
      setShowVerify(false);

      if (data?.is_held) {
        setResultModal({ held: true, code: null, productTitle });
      } else {
        // Reuses the same reveal_order_codes RPC the rest of the site uses to
        // show codes post-OTP-verification — the OTP we just verified above
        // already satisfies its 24h/used=true requirement.
        const { data: revealRows, error: revealError } = await supabase.rpc(
          'reveal_order_codes',
          { _paypal_order_id: data.paypal_order_id }
        );
        if (revealError) console.error("reveal_order_codes error:", revealError);
        const code = Array.isArray(revealRows) && revealRows[0] ? revealRows[0].game_code : null;
        setResultModal({ held: false, code, productTitle });
      }
    } catch (err: any) {
      console.error("Error in verifyAndClaim:", err);
      toast.error(err.message || "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <AgeversLoader />
      </div>
    );
  }

  if (!isEnabled) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Program Currently Unavailable</h2>
            <p className="text-muted-foreground mb-6">The free gift program is not active at the moment. Please check back later!</p>
            <Button onClick={() => navigate('/')}>Back to Home</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 pt-32 pb-20">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-bold uppercase tracking-wider mb-6">
              <Gift className="h-4 w-4" /> Exclusive Reward Program
            </div>
            <h1 className="font-display text-4xl md:text-6xl font-black mb-6 leading-tight">
              Pick Your <span className="text-primary text-glow">Free Game</span>
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl">
              {hasClaimed 
                ? "You have already claimed your free gift. Check your account for your keys!" 
                : "Choose one game from our catalog for free. No payment required, just pick and activation key is yours!"}
            </p>
          </motion.div>

          {hasClaimed ? (
            <div className="max-w-md mx-auto glass rounded-2xl p-12 text-center border-2 border-primary/30 shadow-2xl shadow-primary/20">
              <CheckCircle2 className="h-20 w-20 text-primary mx-auto mb-6" />
              <h2 className="text-2xl font-bold mb-4 tracking-tight uppercase">Already Claimed!</h2>
              <p className="text-muted-foreground mb-8">
                Your free game has been added to your account. You can find your keys in the "My Orders" section.
              </p>
              <Button size="lg" className="w-full gap-2 font-bold uppercase tracking-wider shadow-lg shadow-primary/40" onClick={() => navigate('/account')}>
                Go to My Account <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {products.map((product) => (
                <motion.div
                  key={product.id}
                  whileHover={{ y: -5 }}
                  className={`glass rounded-2xl overflow-hidden border flex flex-col group transition-all duration-300 ${
                    (product.claimed_count || 0) >= 5 
                      ? "opacity-60 grayscale border-white/10" 
                      : "border-primary/20 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10"
                  }`}
                >
                  <div className="aspect-[4/5] relative overflow-hidden bg-secondary/40">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.title}
                        className="w-full h-full object-contain bg-black/20 transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gift className="h-20 w-20 text-primary/20" />
                      </div>
                    )}
                    <div className="absolute top-4 left-4 flex flex-col gap-2">
                      {product.platform_details && (
                        <div className="bg-primary backdrop-blur-md border border-white/20 rounded-lg px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider shadow-lg shadow-primary/20">
                          {product.platform_details}
                        </div>
                      )}
                      <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-lg px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                        {product.platform}
                      </div>
                      <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg px-3 py-1 text-[10px] font-bold text-white/80 uppercase tracking-wider">
                        {product.region}
                      </div>
                    </div>

                    {(product.claimed_count || 0) >= 5 ? (
                      <div className="absolute top-4 right-4 bg-red-600/90 backdrop-blur-md border border-white/20 rounded-lg px-3 py-1 text-[10px] font-black text-white uppercase tracking-widest shadow-lg">
                        OUT OF STOCK
                      </div>
                    ) : (
                      <div className="absolute top-4 right-4 bg-orange-500/90 backdrop-blur-md border border-white/20 rounded-lg px-3 py-1 text-[10px] font-black text-white uppercase tracking-widest shadow-lg">
                        {5 - (product.claimed_count || 0)} LEFT
                      </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                      <h3 className="font-display text-lg font-bold text-white leading-tight mb-1 group-hover:text-primary transition-colors">
                        {product.title}
                      </h3>
                    </div>
                  </div>
                  
                  <div className="p-5 mt-auto flex flex-col gap-4">
                    <div className="p-3 rounded-xl bg-secondary/30 border border-white/5 text-[11px] text-muted-foreground leading-relaxed">
                      <p className="font-bold text-primary mb-1 uppercase tracking-wider">How to activate:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Claim your key with OTP verification</li>
                        <li>Go to "My Account" to find your code</li>
                        <li>Activate on the <span className="text-white font-medium">{product.platform_details || product.platform}</span> client</li>
                      </ul>
                    </div>
                    <Button
                      onClick={() => handleClaim(product.id)}
                      disabled={claiming !== null || (product.claimed_count || 0) >= 5}
                      variant={user ? "default" : "outline"}
                      className="w-full h-12 font-bold uppercase tracking-wider group/btn"
                    >
                      {(product.claimed_count || 0) >= 5 ? (
                        "No Stock Remaining"
                      ) : claiming === product.id ? (
                        "Claiming..."
                      ) : user ? (
                        <>Claim for Free <Gift className="ml-2 h-5 w-5 group-hover/btn:animate-bounce" /></>
                      ) : (
                        <>Login to Claim <Lock className="ml-2 h-4 w-4" /></>
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {showVerify && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass max-w-md w-full p-8 rounded-2xl border-2 border-primary/30 text-center"
            >
              <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Verify it's you</h2>
              <p className="text-muted-foreground mb-6">
                Enter the 6-digit code sent to your email to claim your free game.
              </p>
              
              <input
                type="text"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  console.log("Input change:", val);
                  setVerifyCode(val);
                }}
                autoFocus
                placeholder="000000"
                className="w-full h-14 bg-secondary/50 border-2 border-primary/20 rounded-xl text-center text-3xl font-mono tracking-[0.5em] focus:border-primary focus:outline-none mb-6 text-white"
              />
              
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setShowVerify(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 font-bold bg-primary hover:bg-primary/90 text-white cursor-pointer relative z-[60]" 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("Verify & Claim clicked", { selectedProductId, verifyCode });
                    verifyAndClaim();
                  }}
                  disabled={isVerifying || verifyCode.length !== 6}
                >
                  {isVerifying ? "Verifying..." : "Verify & Claim"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {resultModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass max-w-md w-full p-8 rounded-2xl border-2 border-primary/30 text-center"
            >
              {resultModal.held ? (
                <>
                  <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Security Review in Progress</h2>
                  <p className="text-muted-foreground mb-6">
                    Your claim for <span className="text-white font-medium">{resultModal.productTitle}</span> was received and is being verified before delivery — most reviews complete within 1 hour. Check "My Orders" for your key once it's released.
                  </p>
                </>
              ) : resultModal.code ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Here's Your Key!</h2>
                  <p className="text-muted-foreground mb-4">{resultModal.productTitle}</p>
                  <div className="bg-secondary/50 border-2 border-primary/20 rounded-xl p-4 mb-6">
                    <code className="text-xl font-mono tracking-wider text-primary break-all">{resultModal.code}</code>
                  </div>
                  <p className="text-xs text-muted-foreground mb-6">This code is also saved in "My Orders" if you need it again.</p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Gift Claimed!</h2>
                  <p className="text-muted-foreground mb-6">
                    Your key for <span className="text-white font-medium">{resultModal.productTitle}</span> is ready — check "My Orders" to view it.
                  </p>
                </>
              )}
              <Button size="lg" className="w-full font-bold uppercase tracking-wider" onClick={() => setResultModal(null)}>
                Close
              </Button>
            </motion.div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default FreeGift;
