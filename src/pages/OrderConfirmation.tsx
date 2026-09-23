import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNoIndex } from "@/hooks/useNoIndex";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ShieldCheck, Copy, Check, Package, ArrowLeft, Key, Eye, ExternalLink, AlertCircle, Send, ImagePlus, X, Star } from "lucide-react";
import ReviewForm from "@/components/ReviewForm";
import PostPurchaseVerifyGate from "@/components/PostPurchaseVerifyGate";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { hasTrackingConsent } from "@/lib/consentScripts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import AgeversLoader from "@/components/AgeversLoader";
import mascot from "@/assets/agevers-mascot.png";
import { fireConfetti } from "@/lib/confetti";
import NextAchievementBanner from "@/components/account/NextAchievementBanner";

// Explicit column list — the raw `game_code` column is no longer readable via
// PostgREST for regular users (security hardening). Codes are fetched separately
// through the `reveal_order_codes` RPC after the buyer passes the OTP gate.
const ORDER_COLUMNS =
  "id, user_id, game_title, platform, price, status, created_at, paypal_order_id, quantity, image_url, codes_viewed, ip_address, user_agent, buyer_country, buyer_city, code_viewed_at, is_held, held_until, held_reason, approved_by, approved_at, shipping_full_name, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_zip_code, shipping_country, shipping_phone, tracking_number, tracking_url, carrier_name, shipped_at, aliexpress_order_id, pending_kinguin, guest_email, guest_phone, access_token, paypal_payer_snapshot, code_delivered";

interface OrderItem {
  id: string;
  game_title: string;
  platform: string;
  price: number;
  quantity: number;
  game_code: string | null;
  status: string;
  image_url: string | null;
  created_at: string;
  is_held: boolean;
  held_until: string | null;
  codes_viewed: boolean;
  pending_kinguin: any;
  code_delivered?: boolean;
}

const activationLinks: Record<string, { label: string; url: string }> = {
  Steam: { label: "Steam", url: "https://store.steampowered.com/account/redeemwalletcode" },
  PlayStation: { label: "PlayStation", url: "https://www.playstation.com/en-us/support/store/redeem-ps-store-voucher-code/" },
  Xbox: { label: "Xbox", url: "https://www.xbox.com/en-US/redeem" },
  Nintendo: { label: "Nintendo", url: "https://ec.nintendo.com/redeem" },
  "Microsoft Store": { label: "Microsoft Store", url: "https://account.microsoft.com/billing/redeem" },
  GOG: { label: "GOG", url: "https://www.gog.com/redeem" },
  "Epic Games": { label: "Epic Games", url: "https://store.epicgames.com/en-US/redeem" },
  Blizzard: { label: "Battle.net", url: "https://eu.account.battle.net/login/en/password" },
  "EA Games": { label: "EA", url: "https://www.ea.com/redeem" },
  Rockstar: { label: "Rockstar", url: "https://support.rockstargames.com/articles/3WgLWoaEHwgWV70L3UJLhS" },
};

const issueTypes = [
  "Invalid or already used code",
  "Wrong product received",
  "Code not working",
  "Missing code",
  "Other",
];

const OrderConfirmation = () => {
  useNoIndex();
  const { paypalOrderId } = useParams<{ paypalOrderId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Guest checkout has been removed from the site. All order views require
  // an authenticated session; the previous access-token flow is disabled.
  const isGuestView = false;
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [releaseDates, setReleaseDates] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<Set<string>>(new Set());
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketOrderId, setTicketOrderId] = useState<string>("");
  const [ticketIssueType, setTicketIssueType] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketEmail, setTicketEmail] = useState("");
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [sellerMap, setSellerMap] = useState<Record<string, string>>({});
  const [ticketScreenshot, setTicketScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState("");
  const [reviewSellerId, setReviewSellerId] = useState("");
  const [reviewGameTitle, setReviewGameTitle] = useState("");
  const [reviewedOrders, setReviewedOrders] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(Date.now());
  const [proofLoggedOrders, setProofLoggedOrders] = useState<Set<string>>(new Set());
  const [clientIp, setClientIp] = useState<string | null>(null);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [termsAcceptedForReveal, setTermsAcceptedForReveal] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const conversionFired = useRef(false);

  // NOTE: Guests now go through the SAME PostPurchaseVerifyGate as registered users
  // (SMS OTP + email verification reminder) before the code is revealed. This guarantees
  // that a payer cannot simply paste the order URL on another device to grab the code.

  // Whether any of these orders carries (or will carry, after deferred Kinguin
  // purchase) an actual digital code that requires gating.
  const isRefunded = (o: OrderItem) => o.status === "refunded" || o.status === "partially_refunded";
  const hasRevealableCode = orders.some(
    (o) => (!!o.code_delivered || !!o.game_code || !!o.pending_kinguin) && !o.is_held && o.status !== "held" && o.status !== "rejected" && !isRefunded(o),
  );
  const needsIdentityVerification = orders.some(
    (o) => (!!o.code_delivered || !!o.game_code || !!o.pending_kinguin) && !o.is_held && o.status !== "held" && o.status !== "rejected" && !isRefunded(o) && !o.codes_viewed,
  );

  // Fetch client IP for display
  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then(r => r.json())
      .then(d => setClientIp(d.ip))
      .catch(() => {});
  }, []);

  // Countdown timer — update every second
  useEffect(() => {
    const hasCooling = orders.some(o => o.held_until && !o.is_held && new Date(o.held_until).getTime() > Date.now());
    if (!hasCooling) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [orders]);

  useEffect(() => {
    if (authLoading) return;
    if (!paypalOrderId) { navigate("/"); return; }

    // Guest checkout removed — an authenticated session is required.
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(`/order/${paypalOrderId}`)}`, { replace: true });
      return;
    }

    setTicketEmail(user.email || "");

    supabase
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("paypal_order_id", paypalOrderId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (error || !data || data.length === 0) { navigate("/"); return; }
        // Fetch actual codes for already-viewed orders (RPC allows this without
        // a fresh OTP because the buyer already passed the gate once).
        let merged: any[] = data as any[];
        if ((data as any[]).some((o: any) => o.codes_viewed)) {
          const { data: codeRows } = await supabase.rpc(
            "reveal_order_codes" as any,
            { _paypal_order_id: paypalOrderId },
          );
          if (Array.isArray(codeRows)) {
            const codeMap = new Map<string, string>();
            (codeRows as any[]).forEach((r: any) => codeMap.set(r.id, r.game_code));
            merged = merged.map((o: any) => ({
              ...o,
              game_code: codeMap.get(o.id) ?? null,
            }));
          }
        }
        setOrders(merged as any);
        setLoading(false);

        // Fire Google Ads / Reddit purchase conversion once, only for completed/successful
        // orders, and only if the visitor accepted cookies — this includes a server-side
        // call that shares IP address and user-agent with Reddit, so it must not fire
        // for a declined/undecided visitor just because gtag/rdt happen to be undefined.
        if (!conversionFired.current && merged.length > 0 && !merged.some((o: any) => o.status === "held" || o.status === "rejected") && hasTrackingConsent()) {
          conversionFired.current = true;
          const totalValue = merged.reduce((sum: number, o: any) => sum + (Number(o.price) || 0) * (Number(o.quantity) || 1), 0);
          const gtag = (window as any).gtag;
          if (typeof gtag === "function") {
            gtag("event", "conversion", {
              send_to: "AW-18337647515/9rqfCLaD0tMcEJuXiahE",
              value: Number(totalValue.toFixed(2)),
              currency: "ILS",
              transaction_id: paypalOrderId || "",
            });
          }

          const rdt = (window as any).rdt;
          if (typeof rdt === "function") {
            rdt("track", "Purchase", {
              value: Number(totalValue.toFixed(2)),
              currency: "ILS",
              transactionId: paypalOrderId || "",
              conversionId: paypalOrderId || "",
              itemCount: merged.reduce((sum: number, o: any) => sum + (Number(o.quantity) || 1), 0),
              products: merged.map((o: any) => ({
                id: String(o.id),
                name: o.game_title || undefined,
                category: o.platform || undefined,
              })),
            });
          }

          // Server-side mirror via Reddit Conversions API — same conversionId as the
          // client pixel event above, so Reddit can dedupe them into one conversion.
          supabase.functions.invoke("reddit-capi-purchase", {
            body: {
              conversionId: paypalOrderId || "",
              value: Number(totalValue.toFixed(2)),
              currency: "ILS",
              itemCount: merged.reduce((sum: number, o: any) => sum + (Number(o.quantity) || 1), 0),
              products: merged.map((o: any) => ({ id: String(o.id), name: o.game_title || undefined, category: o.platform || undefined })),
              email: user?.email || merged[0]?.guest_email || undefined,
              ipAddress: merged[0]?.ip_address || undefined,
              userAgent: merged[0]?.user_agent || undefined,
            },
          }).catch(() => {
            // Best-effort only — never surface this to the customer.
          });
        }

        // Auto-reveal codes that were already viewed
        const alreadyViewed = new Set<string>();
        merged.forEach((order: any) => {
          if (order.codes_viewed && order.game_code) {
            order.game_code.split('\n').filter((c: string) => c.trim()).forEach((_: string, cIdx: number) => {
              alreadyViewed.add(`${order.id}-${cIdx}`);
            });
          }
        });
        if (alreadyViewed.size > 0) setRevealedCodes(alreadyViewed);

        // Fetch release dates for orders without codes (pre-orders)
        const preOrderTitles = merged.filter((o: any) => !o.code_delivered).map((o: any) => o.game_title);
        if (preOrderTitles.length > 0) {
          const { data: apData } = await supabase
            .from("allowed_products")
            .select("title, release_date")
            .in("title", preOrderTitles)
            .not("release_date", "is", null);
          if (apData) {
            const rdMap: Record<string, string> = {};
            apData.forEach((ap: any) => {
              if (ap.release_date && new Date(ap.release_date) > new Date()) {
                rdMap[ap.title] = ap.release_date;
              }
            });
            setReleaseDates(rdMap);
          }
        }

        // Fetch seller IDs for each order using database function
        const orderIds = merged.map((o: any) => o.id);
        const sellerPromises = orderIds.map(async (orderId) => {
          const { data: result } = await supabase.rpc("get_seller_for_order", { _order_id: orderId });
          return { orderId, sellerId: result as string | null };
        });
        Promise.all(sellerPromises).then((results) => {
          const map: Record<string, string> = {};
          results.forEach(r => { if (r.sellerId) map[r.orderId] = r.sellerId; });
          setSellerMap(map);
        });

        // Fetch which orders already have reviews
        supabase
          .from("reviews" as any)
          .select("order_id")
          .in("order_id", orderIds)
          .then(({ data: reviewData }) => {
            if (reviewData) {
              setReviewedOrders(new Set((reviewData as any[]).map((r: any) => r.order_id)));
            }
          });
      });
  }, [user, authLoading, paypalOrderId, navigate]);

  const copyCode = (code: string, orderId: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(orderId);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const logCodeViewed = (orderId: string) => {
    if (proofLoggedOrders.has(orderId)) return;
    setProofLoggedOrders(prev => new Set(prev).add(orderId));
    supabase.functions.invoke("log-delivery-proof", {
      body: { order_id: orderId, terms_accepted: true },
    }).catch(err => console.error("Delivery proof log failed:", err));
  };

  const unlockAllCodes = (sourceOrders?: any[]) => {
    const list = sourceOrders ?? orders;
    const unlocked = new Set<string>();
    list.forEach((order) => {
      if (!order.game_code || order.is_held || order.status === "held" || order.status === "rejected") return;
      order.game_code.split('\n').filter((c: string) => c.trim()).forEach((_: string, cIdx: number) => {
        unlocked.add(`${order.id}-${cIdx}`);
      });
      logCodeViewed(order.id);
    });
    if (unlocked.size > 0) {
      setRevealedCodes(prev => new Set([...prev, ...unlocked]));
      setOrders(prev => prev.map(order => unlocked.has(`${order.id}-0`) ? { ...order, codes_viewed: true } : order));
      fireConfetti();
    }
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setTicketScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const submitTicket = async () => {
    if (!ticketIssueType || !ticketMessage.trim() || !ticketEmail.trim() || !ticketOrderId) {
      toast.error("Please fill in all fields");
      return;
    }
    if (!ticketScreenshot) {
      toast.error("Please upload a screenshot showing the issue");
      return;
    }
    const sellerId = sellerMap[ticketOrderId];
    if (!sellerId) {
      toast.error("Could not find seller for this order");
      return;
    }
    setTicketSubmitting(true);

    // Upload screenshot
    const fileExt = ticketScreenshot.name.split(".").pop();
    const filePath = `${user!.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("ticket-screenshots")
      .upload(filePath, ticketScreenshot);

    if (uploadError) {
      toast.error("Failed to upload screenshot");
      setTicketSubmitting(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("ticket-screenshots")
      .getPublicUrl(filePath);

    const { error } = await supabase.from("support_tickets" as any).insert({
      order_id: ticketOrderId,
      buyer_id: user!.id,
      seller_id: sellerId,
      issue_type: ticketIssueType,
      message: ticketMessage.trim(),
      buyer_email: ticketEmail.trim(),
      screenshot_url: urlData.publicUrl,
    } as any);
    setTicketSubmitting(false);
    if (error) {
      toast.error("Failed to submit ticket");
      return;
    }
    toast.success("Support ticket submitted successfully!");
    setTicketOpen(false);
    setTicketIssueType("");
    setTicketMessage("");
    setTicketScreenshot(null);
    setScreenshotPreview(null);
  };

  const totalAmount = orders.reduce((sum, o) => sum + o.price, 0);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AgeversLoader />
      </div>
    );
  }

  // Not signed in — send to auth (guest checkout is fully disabled).
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-32 pb-16 container mx-auto px-4 max-w-md text-center">
          <div className="glass rounded-xl p-8 space-y-4">
            <ShieldCheck className="h-12 w-12 text-primary mx-auto" />
            <h1 className="font-display text-xl font-bold tracking-wider text-foreground">Sign in to view your order</h1>
            <p className="text-sm text-muted-foreground">
              For your security, please sign in with the email address you used at checkout to view your game code.
            </p>
            <Button onClick={() => navigate(`/auth?redirect=${encodeURIComponent(`/order/${paypalOrderId}`)}`)} className="w-full">
              Sign in
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-32 pb-16 container mx-auto px-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 font-display text-sm tracking-wider transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          BACK TO STORE
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          {/* Success header */}
          <div className="text-center mb-4">
            <div className="h-12 w-12 rounded-full gradient-primary mx-auto mb-2 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="font-display text-xl md:text-2xl font-black tracking-wider text-foreground mb-1">
              ORDER CONFIRMED
            </h1>
            <p className="text-muted-foreground text-xs">
              Order ID: <span className="text-foreground font-mono">{paypalOrderId}</span>
            </p>
          </div>

          {/* Next achievement nudge */}
          <div className="mb-4">
            <NextAchievementBanner onClick={() => navigate("/account", { state: { section: "achievements" } })} />
          </div>

          {/* Identity verification gate — ALL users (including guests) must verify
              SMS OTP + email before the code is revealed. */}
          {needsIdentityVerification && !identityVerified && (
            <div className="mb-6">
              {/* Mascot greeting with speech bubble */}
              <div className="flex items-end justify-center gap-3 mb-3 sm:gap-4">
                <motion.img
                  src={mascot}
                  alt="Agevers mascot waving"
                  className="h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    rotate: [0, -8, 8, -8, 0],
                  }}
                  transition={{
                    opacity: { duration: 0.5 },
                    x: { duration: 0.5 },
                    rotate: {
                      duration: 1.6,
                      repeat: Infinity,
                      repeatDelay: 1.5,
                      ease: "easeInOut",
                    },
                  }}
                  style={{ transformOrigin: "bottom center" }}
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="relative max-w-xs glass border border-primary/40 rounded-2xl rounded-bl-sm px-3 py-2 mb-1"
                  style={{
                    boxShadow: "0 0 24px hsl(var(--primary) / 0.2)",
                  }}
                >
                  <p className="text-xs sm:text-sm font-display font-semibold text-foreground leading-snug">
                    Your code is safe with me!{" "}
                    <span className="text-primary">
                      Tap below to get your SMS code.
                    </span>
                  </p>
                  {/* Tail */}
                  <span
                    className="absolute -left-2 bottom-3 w-3 h-3 rotate-45 border-l border-b border-primary/40"
                    style={{
                      background: "hsl(var(--background) / 0.6)",
                      backdropFilter: "blur(8px)",
                    }}
                  />
                </motion.div>
              </div>

              <PostPurchaseVerifyGate
                orderId={paypalOrderId!}
                onVerified={async () => {
                  setIdentityVerified(true);
                  // Auto-reveal: once SMS is verified, immediately trigger
                  // deferred Kinguin purchase (if any), fetch codes via the
                  // secure OTP-gated RPC, and unlock them.
                  setRevealing(true);
                  try {
                    const needsPurchase = orders.some(
                      (o: any) => !!o.pending_kinguin,
                    );
                    let latest = orders;
                    if (needsPurchase) {
                      const { error: revealError } =
                        await supabase.functions.invoke("reveal-and-fulfill", {
                          body: { paypal_order_id: paypalOrderId },
                        });
                      if (revealError) {
                        toast.error(
                          "We couldn't fetch your code right now. Please refresh in a moment.",
                        );
                        return;
                      }
                      const { data: refreshed } = await supabase
                        .from("orders")
                        .select(ORDER_COLUMNS)
                        .eq("paypal_order_id", paypalOrderId)
                        .eq("user_id", user.id)
                        .order("created_at", { ascending: false });
                      if (refreshed) {
                        latest = refreshed as any;
                      }
                    }
                    // Pull the actual codes now that the OTP has just been used.
                    const { data: codeRows, error: codeErr } = await supabase.rpc(
                      "reveal_order_codes" as any,
                      { _paypal_order_id: paypalOrderId },
                    );
                    if (codeErr) {
                      toast.error("We couldn't retrieve your code. Please refresh.");
                      return;
                    }
                    const codeMap = new Map<string, string>();
                    (codeRows as any[] | null)?.forEach((r: any) =>
                      codeMap.set(r.id, r.game_code),
                    );
                    latest = (latest as any[]).map((o: any) => ({
                      ...o,
                      game_code: codeMap.get(o.id) ?? o.game_code ?? null,
                    }));
                    setOrders(latest as any);
                    unlockAllCodes(latest);
                  } finally {
                    setRevealing(false);
                  }
                }}
              />
            </div>
          )}

          {/* Loading indicator while we fetch the code right after SMS verification */}
          {needsIdentityVerification && identityVerified && revealing && (
            <div className="mb-6 glass rounded-xl p-5 border border-primary/30 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Eye className="h-4 w-4 text-primary animate-pulse" />
                Revealing your code...
              </div>
            </div>
          )}

          {/* Game codes */}
          {(!needsIdentityVerification || (identityVerified && (orders.some(o => o.codes_viewed) || revealedCodes.size > 0))) && (
          <div className="space-y-4 mb-8">
            <h2 className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
              <Key className="h-4 w-4" />
              YOUR GAME CODES
            </h2>

            {orders.map((order, index) => {
              const redeemInfo = activationLinks[order.platform];
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass rounded-xl p-5"
                >
                  <div className="flex items-start gap-4">
                    {order.image_url && (
                      <img
                        src={order.image_url}
                        alt={order.game_title}
                        className="w-16 h-20 object-cover rounded-lg shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-foreground text-sm">
                        {order.game_title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {order.platform} • Qty: {order.quantity}
                      </p>
                      <p className="text-sm font-display font-bold text-primary mt-1">
                        ${order.price.toFixed(2)}
                      </p>

                      {/* Game codes display */}
                      {order.is_held || order.status === "held" ? (
                        <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3">
                          <p className="text-sm text-yellow-500 font-display font-semibold mb-1">
                            🔒 Security Review in Progress
                          </p>
                          <p className="text-xs text-muted-foreground">
                            This order is being reviewed for security purposes. Your code will be available within <strong className="text-foreground">1 hour</strong>. You'll be notified once it's ready.
                          </p>
                        </div>
                      ) : order.status === "rejected" ? (
                        <div className="mt-3 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">
                          <p className="text-sm text-destructive font-display font-semibold mb-1">
                            ❌ Order Rejected
                          </p>
                          <p className="text-xs text-muted-foreground">
                            This order was flagged and rejected during security review. Please contact support for assistance.
                          </p>
                        </div>
                      ) : (() => {
                        const coolingEnd = order.held_until ? new Date(order.held_until).getTime() : 0;
                        // Cooling period exists to enforce SMS verification. If the user has
                        // already verified their identity in this session, skip the wait.
                        const isCooling = !order.is_held && coolingEnd > now && !order.codes_viewed && !identityVerified;
                        const remainingSec = Math.max(0, Math.ceil((coolingEnd - now) / 1000));
                        const mins = Math.floor(remainingSec / 60);
                        const secs = remainingSec % 60;

                        if (isCooling && order.game_code) {
                          return (
                            <div className="mt-3 bg-primary/10 border border-primary/30 rounded-lg px-4 py-3">
                              <p className="text-sm text-primary font-display font-semibold mb-1">
                                🔐 Verifying your purchase...
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Your code will be available in{" "}
                                <strong className="text-foreground font-mono">
                                  {mins}:{secs.toString().padStart(2, "0")}
                                </strong>
                              </p>
                              <p className="text-[10px] text-muted-foreground/70 mt-1">
                                This security measure protects you from unauthorized purchases.
                              </p>
                            </div>
                          );
                        }

                        if (order.game_code) {
                          return (
                            <div className="mt-3 space-y-2">
                              {order.game_code.split('\n').filter((c: string) => c.trim()).map((code: string, cIdx: number, arr: string[]) => {
                                const codeKey = `${order.id}-${cIdx}`;
                                const isRevealed = order.codes_viewed || identityVerified || revealedCodes.has(codeKey);
                                return (
                                  <div key={cIdx}>
                                    {arr.length > 1 && (
                                      <p className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Code #{cIdx + 1}</p>
                                    )}
                                    {isRevealed && (
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="flex-1 bg-primary/10 border border-primary/30 rounded-lg px-4 py-2.5"
                                          style={{
                                            boxShadow:
                                              "0 0 18px 2px hsl(var(--primary) / 0.2), inset 0 0 12px hsl(var(--primary) / 0.06)",
                                          }}
                                        >
                                          <p
                                            className="font-mono text-sm text-primary font-bold tracking-wider select-all break-all"
                                            style={{ textShadow: "0 0 8px hsl(var(--primary) / 0.5)" }}
                                          >
                                            {code.trim()}
                                          </p>
                                        </div>
                                        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-neon-green flex items-center gap-1 shrink-0">
                                          <Eye className="h-3 w-3" /> Viewed
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="shrink-0 h-10 w-10"
                                          onClick={() => copyCode(code.trim(), codeKey)}
                                        >
                                          {copiedId === codeKey ? (
                                            <Check className="h-4 w-4 text-neon-green" />
                                          ) : (
                                            <Copy className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {redeemInfo && (
                                <a href={redeemInfo.url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-display font-semibold text-primary hover:underline">
                                  <ExternalLink className="h-3 w-3" />
                                  Redeem on {redeemInfo.label}
                                </a>
                              )}
                            </div>
                          );
                        }

                        if (releaseDates[order.game_title]) {
                          return (
                            <div className="mt-3 bg-primary/10 border border-primary/30 rounded-lg px-4 py-3">
                              <p className="text-sm text-primary font-display font-semibold mb-1">🎮 Pre-Order Confirmed!</p>
                              <p className="text-xs text-muted-foreground">
                                Your game code will be available on{" "}
                                <span className="text-foreground font-semibold">
                                  {new Date(releaseDates[order.game_title]).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                                </span>. We'll notify you once it's ready.
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="mt-3 bg-accent/10 border border-accent/20 rounded-lg px-4 py-2.5">
                            <p className="text-xs text-accent font-display">⏳ Key is being processed — check back shortly</p>
                          </div>
                        );
                      })()}

                      {/* Leave a Review button */}
                      {order.status === "completed" && sellerMap[order.id] && !reviewedOrders.has(order.id) && (
                        <button
                          onClick={() => {
                            setReviewOrderId(order.id);
                            setReviewSellerId(sellerMap[order.id]);
                            setReviewGameTitle(order.game_title);
                            setReviewOpen(true);
                          }}
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-display font-bold text-neon-gold hover:underline transition-colors"
                        >
                          <Star className="h-3.5 w-3.5" />
                          Leave a Review
                        </button>
                      )}
                      {reviewedOrders.has(order.id) && (
                        <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-display font-bold text-neon-green">
                          <Star className="h-3.5 w-3.5 fill-neon-green" />
                          Reviewed
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          )}

          {/* Order total */}
          <div className="glass rounded-xl p-5 mb-8">
            <div className="flex justify-between items-center">
              <span className="font-display text-sm text-muted-foreground">Total Paid</span>
              <span className="font-display text-xl font-black text-foreground">€{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Having troubles */}
          <div className="text-center mb-8">
            <button
              onClick={() => setTicketOpen(true)}
              className="inline-flex items-center gap-2 text-sm font-display font-bold text-destructive hover:underline transition-colors"
            >
              <AlertCircle className="h-4 w-4" />
              HAVING TROUBLES? CLICK HERE
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => navigate("/account", { state: { tab: "orders" } })}
              variant="outline"
              className="font-display tracking-wider"
            >
              <Package className="h-4 w-4 mr-2" />
              All Orders
            </Button>
            <Button
              onClick={() => navigate("/")}
              className="font-display tracking-wider"
            >
              Continue Shopping
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Support Ticket Dialog */}
      <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">Report an Issue</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Order</Label>
              <Select value={ticketOrderId} onValueChange={setTicketOrderId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select order" />
                </SelectTrigger>
                <SelectContent>
                  {orders.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.game_title} — ${o.price.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Issue Type</Label>
              <Select value={ticketIssueType} onValueChange={setTicketIssueType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  {issueTypes.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Your Email</Label>
              <Input
                className="mt-1"
                type="email"
                value={ticketEmail}
                onChange={e => setTicketEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div>
              <Label className="text-xs font-display tracking-wider uppercase text-muted-foreground">Describe the issue</Label>
              <Textarea
                className="mt-1 min-h-[100px]"
                value={ticketMessage}
                onChange={e => setTicketMessage(e.target.value)}
                placeholder="Please describe your issue in detail..."
                maxLength={1000}
              />
            </div>

            <div>
              <Label className="text-xs font-display tracking-wider uppercase text-muted-foreground">
                Screenshot (required) <span className="text-destructive">*</span>
              </Label>
              <p className="text-[10px] text-muted-foreground mb-2">Upload a screenshot showing the issue with the code</p>
              {screenshotPreview ? (
                <div className="relative inline-block">
                  <img src={screenshotPreview} alt="Screenshot preview" className="max-h-32 rounded-lg border border-border" />
                  <button
                    type="button"
                    onClick={() => { setTicketScreenshot(null); setScreenshotPreview(null); }}
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-display">Click to upload screenshot</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleScreenshotChange} />
                </label>
              )}
            </div>

            <Button
              className="w-full font-display tracking-wider gap-2"
              onClick={submitTicket}
              disabled={ticketSubmitting}
            >
              <Send className="h-4 w-4" />
              {ticketSubmitting ? "Submitting..." : "Submit Ticket"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Form Dialog */}
      <ReviewForm
        orderId={reviewOrderId}
        sellerId={reviewSellerId}
        gameTitle={reviewGameTitle}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        onSuccess={() => {
          setReviewedOrders(prev => new Set(prev).add(reviewOrderId));
        }}
      />

      <Footer />
    </div>
  );
};

export default OrderConfirmation;
