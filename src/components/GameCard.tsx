import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Heart, Monitor, Gamepad2, Smartphone, Gift, Tv, ShoppingBag, Clock, Joystick, Swords, Flame, Bell } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { detectUserCountry, isRegionCompatible } from "@/lib/regionCheck";
import RegionWarningDialog from "@/components/RegionWarningDialog";
import { useWishlist } from "@/hooks/useWishlist";
import { useCart } from "@/hooks/useCart";
import { useNewAccountLimit } from "@/hooks/useNewAccountLimit";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { standardizeImageUrl } from "@/lib/imageTransform";


const getPlatformIcon = (platform: string) => {
  const p = platform.toLowerCase();
  if (p.includes("xbox")) return { icon: Gamepad2, color: "text-green-500" };
  if (p.includes("playstation") || p.includes("ps")) return { icon: Gamepad2, color: "text-blue-500" };
  if (p.includes("nintendo") || p.includes("switch")) return { icon: Joystick, color: "text-red-500" };
  if (p.includes("steam")) return { icon: Monitor, color: "text-sky-400" };
  if (p.includes("epic")) return { icon: Monitor, color: "text-slate-300" };
  if (p.includes("gog")) return { icon: Monitor, color: "text-purple-400" };
  if (p.includes("blizzard")) return { icon: Monitor, color: "text-blue-400" };
  if (p.includes("ea")) return { icon: Monitor, color: "text-orange-400" };
  if (p.includes("rockstar")) return { icon: Monitor, color: "text-yellow-400" };
  if (p.includes("mobile")) return { icon: Smartphone, color: "text-emerald-400" };
  if (p.includes("gift")) return { icon: Gift, color: "text-pink-400" };
  if (p.includes("media") || p.includes("streaming")) return { icon: Tv, color: "text-violet-400" };
  if (p.includes("software") || p.includes("ai")) return { icon: ShoppingBag, color: "text-cyan-400" };
  if (p.includes("in-game") || p.includes("item")) return { icon: Swords, color: "text-amber-400" };
  if (p.includes("pre-order")) return { icon: Clock, color: "text-orange-400" };
  if (p.includes("pc") || p.includes("windows")) return { icon: Monitor, color: "text-blue-300" };
  return { icon: Monitor, color: "text-muted-foreground" };
};

interface GameCardProps {
  id?: string;
  title: string;
  platform: string;
  price: number;
  originalPrice?: number;
  image: string;
  badge?: string;
  badges?: string[];
  sellerCount?: number;
  stock?: number;
  isKinguin?: boolean;
  region?: string;
  slug?: string;
  soldCount?: number;
  wishlistCount?: number;
  releaseDate?: string | null;
  onAddToCart?: (e: React.MouseEvent) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  itemType?: string;
  /** Authoritative classification from allowed_products.product_type */
  productType?: string | null;
  /** Original supplier title (used to detect Deluxe/Ultimate when badges are cleaned) */
  originalTitle?: string | null;
}

// Order matters: multi-word variants must be matched before single-word ones
// (e.g. "Digital Deluxe" before "Deluxe", "Game of the Year" before "GOTY").
const EDITION_KEYWORDS = [
  "Digital Deluxe", "Super Deluxe", "Game of the Year",
  "Definitive", "Deluxe", "Ultimate", "Gold", "Premium", "Collector",
  "Limited", "Legacy", "Complete", "GOTY", "Legendary", "Champion",
  "Enhanced", "Anniversary", "Standard",
];

const GameCard = ({ id, title, platform, price, originalPrice, image, badge, badges: dbBadges, sellerCount, stock, isKinguin, region, slug, soldCount, wishlistCount, releaseDate, onAddToCart, selectable, selected, onSelect, itemType, productType, originalTitle }: GameCardProps) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const { isInWishlist, toggle: toggleWishlist } = useWishlist();
  const { canAddItem } = useCart();
  const { limitEur } = useNewAccountLimit();
  const { user } = useAuth();
  const inWishlist = id ? isInWishlist(id) : false;
  const discount = originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0;
  const [showRegionWarning, setShowRegionWarning] = useState(false);
  const [pendingBuyNow, setPendingBuyNow] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(user?.email || "");
  const [notifySubmitting, setNotifySubmitting] = useState(false);
  const [notifySubmitted, setNotifySubmitted] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [lockedTipOpen, setLockedTipOpen] = useState(false);
  const lockedTipTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const isOutOfStock = stock === 0;

  // Grid thumbnails never render larger than the card, so ask Cloudflare for
  // a card-sized, format=auto (WebP/AVIF) image instead of shipping whatever
  // size the source happened to store.
  const optimizedImage = standardizeImageUrl(image, { width: 500, height: 440, fit: "contain" }) ?? image;

  const displayTitle = title;

  useEffect(() => {
    const el = titleRef.current;
    if (el) setIsTruncated(el.scrollHeight > el.clientHeight);
  }, [displayTitle]);

  const userCountry = detectUserCountry();
  const regionMismatch = region && userCountry && !isRegionCompatible(region, userCountry);

  // Calculate days until release for pre-order items
  const daysUntilRelease = (() => {
    if (!releaseDate) return null;
    const now = new Date();
    const release = new Date(releaseDate);
    if (release <= now) return null;
    return Math.ceil((release.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  })();
  // A tracked release date in the past is definitive proof the game has
  // shipped — overrides a stale "pre-order" left over in the title/badges/
  // product_type from before release (title text doesn't get cleaned up
  // once a product goes live).
  const hasDefinitivelyReleased = !!releaseDate && new Date(releaseDate) <= new Date();

  const hasBadge = (name: string) => dbBadges?.some(b => b.toLowerCase() === name.toLowerCase());
  // Source for keyword detection: prefer original supplier title (richer), fall back to display title
  const titleSource = (originalTitle && originalTitle.trim() ? originalTitle : title);
  const pt = (productType || "").toLowerCase();

  const isDLCRaw = itemType === "dlc" || pt === "dlc" || (!productType && (dbBadges?.length ? hasBadge("DLC") : /\bDLC\b/i.test(titleSource)));
  const isSkin = itemType === "skin" || pt === "skin";
  const isCurrency = itemType === "currency" || pt === "currency";
  const isSeasonPass = pt === "season pass" || (!productType && (hasBadge("Season Pass") || /\bseason\s+pass\b/i.test(titleSource)));
  const isExpansion = pt === "expansion" || (!productType && (hasBadge("Expansion") || (/\bexpansion\b/i.test(titleSource) && !isSeasonPass)));
  const isBundle = pt === "bundle" || (!productType && (hasBadge("Bundle") || /\bbundle\b/i.test(titleSource)));
  // GAME + BONUS must be detected FIRST — products with "+ Pre-Order Bonus" in
  // the title are full base games bundled with bonus content, NOT add-on bonuses.
  const isGameBonus =
    pt === "game + bonus" ||
    hasBadge("GAME + BONUS") ||
    /\+\s*(pre[\s-]?order\s+)?bonus\b/i.test(titleSource) ||
    /\+\s*(pre[\s-]?order\s+)?bonus\b/i.test(title);
  const isPreOrderBonus =
    !isGameBonus &&
    (pt === "pre order bonus" ||
      pt === "pre-order bonus" ||
      hasBadge("PRE-ORDER BONUS") ||
      /\bpre[\s-]?order\s+bonus\b/i.test(titleSource));
  const isPreOrder =
    !isGameBonus &&
    !isPreOrderBonus &&
    !hasDefinitivelyReleased &&
    (pt === "pre-order" ||
      pt === "pre order" ||
      hasBadge("PRE-ORDER") ||
      /\bpre[\s-]?order\b/i.test(titleSource));
  const isSubscription = pt === "subscription" || hasBadge("Subscription");
  const isTopUp = pt === "top up" || hasBadge("Top Up");
  // Edition Upgrades — for existing owners, not plain DLC
  const isUpgrade =
    pt === "upgrade" ||
    hasBadge("Upgrade") ||
    /\b(edition\s+upgrade|upgrade\s+(pack|edition|dlc))\b/i.test(titleSource);
  // Suppress the DLC badge when the product is actually an Edition Upgrade
  const isDLC = isDLCRaw && !isUpgrade;

  const edition = (() => {
    const isEdition = itemType === "edition" || pt === "edition";
    // Find a specific edition keyword from the original title (e.g. "Deluxe", "Ultimate")
    const findKeyword = () => {
      for (const kw of EDITION_KEYWORDS) {
        if (titleSource.toLowerCase().includes(kw.toLowerCase())) return kw;
      }
      return null;
    };
    if (isEdition) {
      const kw = findKeyword();
      return kw ? `${kw} Edition` : "Edition";
    }
    // Fallback for legacy products without product_type set
    if (!productType) {
      if (dbBadges?.length) {
        const editionBadge = dbBadges.find(b => EDITION_KEYWORDS.some(kw => kw.toLowerCase() === b.toLowerCase()));
        if (editionBadge) return editionBadge;
      }
      return findKeyword();
    }
    return null;
  })();

  const handleClick = () => {
    if (selectable && id && onSelect) {
      onSelect(id);
      return;
    }
    if (slug?.startsWith("__game__/")) {
      navigate(`/game/${slug.replace("__game__/", "")}`);
      return;
    }
    if (slug) navigate(`/product/${slug}`);
    else if (id) navigate(`/product/${id}`);
  };

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className={`glass rounded-lg overflow-hidden group cursor-pointer relative flex flex-col ${selected ? "ring-2 ring-primary" : ""}`}
      onClick={handleClick}
    >
      {selectable && (
        <div className="absolute top-2 left-2 z-20">
          <input
            type="checkbox"
            checked={selected || false}
            onChange={() => id && onSelect?.(id)}
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5 accent-primary rounded cursor-pointer"
          />
        </div>
      )}
      <div className="relative aspect-[801/700] overflow-hidden bg-[hsl(var(--background))]">
        {/* Blurred backdrop fills empty space so every card stays the same height */}
        <img
          src={optimizedImage}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40"
        />
        {/* Foreground image - contained so the entire artwork is visible without cropping */}
        <img
          src={optimizedImage}
          alt={title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-contain object-center transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/5 bg-gradient-to-t from-background/60 to-transparent pointer-events-none" />

        {/* Out of Stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] flex items-center justify-center z-[15] pointer-events-none">
            <span className="font-display text-xs font-black tracking-widest uppercase px-3 py-1.5 rounded bg-destructive/90 text-destructive-foreground shadow-lg">
              Out of Stock
            </span>
          </div>
        )}

        {/* Badges column - stacked vertically in top-left */}
        <div className="absolute top-0 left-0 flex flex-col items-start gap-0.5 z-10">
          {edition && !isDLC && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-br bg-neon-gold text-background shadow-[0_0_8px_hsl(var(--neon-gold)/0.6)]">
              ★ {edition}
            </span>
          )}
          {badge && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-r gradient-primary text-primary-foreground">
              {badge}
            </span>
          )}
          {isDLC && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-r bg-purple-600 text-white shadow-[0_0_8px_rgba(147,51,234,0.6)]">
              DLC
            </span>
          )}
          {isSkin && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-r bg-pink-500 text-white shadow-[0_0_8px_rgba(236,72,153,0.6)]">
              SKIN
            </span>
          )}
          {isCurrency && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-r bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.6)]">
              CURRENCY
            </span>
          )}
          {isSeasonPass && !isDLC && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-r bg-indigo-600 text-white shadow-[0_0_8px_rgba(79,70,229,0.6)]">
              SEASON PASS
            </span>
          )}
          {isExpansion && !isDLC && !isSeasonPass && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-r bg-cyan-600 text-white shadow-[0_0_8px_rgba(8,145,178,0.6)]">
              EXPANSION
            </span>
          )}
          {isBundle && !isDLC && !isSeasonPass && !isExpansion && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-r bg-orange-500 text-white shadow-[0_0_8px_rgba(249,115,22,0.6)]">
              BUNDLE
            </span>
          )}
          {isUpgrade && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-r bg-teal-500 text-white shadow-[0_0_8px_rgba(20,184,166,0.6)]">
              UPGRADE
            </span>
          )}
          {isPreOrderBonus && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-r bg-rose-500 text-white shadow-[0_0_8px_rgba(244,63,94,0.6)]">
              PRE-ORDER BONUS
            </span>
          )}
          {isGameBonus && !isPreOrderBonus && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-r bg-fuchsia-600 text-white shadow-[0_0_8px_rgba(192,38,211,0.6)]">
              GAME + BONUS
            </span>
          )}
          {isPreOrder && !(typeof badge === "string" && badge.toUpperCase().includes("PRE-ORDER")) && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-r bg-orange-500 text-white shadow-[0_0_8px_rgba(249,115,22,0.6)]">
              PRE-ORDER
            </span>
          )}
          {isSubscription && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-r bg-sky-500 text-white shadow-[0_0_8px_rgba(14,165,233,0.6)]">
              SUBSCRIPTION
            </span>
          )}
          {isTopUp && (
            <span className="font-display text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-r bg-amber-500 text-white shadow-[0_0_8px_rgba(245,158,11,0.6)]">
              TOP UP
            </span>
          )}
          {discount > 0 && (
            <span className="font-display text-xs font-bold bg-neon-green/20 text-neon-green border border-neon-green/30 px-2 py-0.5 rounded-r mt-0.5">
              -{discount}%
            </span>
          )}
        </div>

        {daysUntilRelease !== null && (
          <div className="absolute bottom-2 left-2 right-2 z-10">
            <span className="flex items-center gap-1 font-display text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded bg-amber-500/90 text-background w-fit">
              <Clock className="h-3 w-3" />
              {daysUntilRelease === 1 ? "Releases tomorrow" : `${daysUntilRelease} days left`}
            </span>
          </div>
        )}

        {/* Wishlist heart - bottom-right */}
        {id && (
          <button
            type="button"
            aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
            onClick={async (e) => {
              e.stopPropagation();
              const result = await toggleWishlist({
                allowedProductId: id,
                title,
                platform,
                image_url: image,
                price,
              });
              if (result.needsAuth) {
                toast("Please log in to save favorites");
                navigate("/auth");
                return;
              }
              toast(result.added ? "❤️ Added to favorites" : "Removed from favorites");
            }}
            className="absolute bottom-2 right-2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background transition-colors group/heart"
          >
            <Heart
              className={`h-4 w-4 transition-all ${inWishlist ? "fill-primary text-primary" : "text-muted-foreground group-hover/heart:text-primary"}`}
            />
          </button>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        {(() => {
          const { icon: PlatformIcon, color } = getPlatformIcon(platform);
          return (
            <p className="text-xs font-display tracking-widest uppercase text-primary mb-1.5 flex items-center gap-1.5 font-bold">
              <PlatformIcon className={`h-4 w-4 ${color}`} />
              {platform}
            </p>
          );
        })()}
        <div className="relative group/title">
          <h3
            ref={titleRef}
            className="font-display text-sm font-semibold text-foreground mb-3 min-h-[2.5rem] line-clamp-2"
          >
            {displayTitle}
          </h3>
          {isTruncated && (
            <div className="absolute bottom-full left-0 right-0 z-30 hidden group-hover/title:block pointer-events-none mb-1">
              <div className="bg-popover border border-border rounded-md shadow-lg p-2">
                <span className="font-display text-sm font-semibold text-foreground">
                  {displayTitle}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="mt-auto">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-display text-lg font-bold text-primary">
              {sellerCount && sellerCount > 1 ? "From " : ""}{formatPrice(price)}
            </span>
            {originalPrice && (
              <span className="text-xs text-muted-foreground line-through">{formatPrice(originalPrice)}</span>
            )}
          </div>
          {sellerCount && sellerCount > 1 ? (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-display font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                {sellerCount} sellers
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 ml-auto">
              {isOutOfStock ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="font-display text-xs tracking-wider uppercase h-8 px-3 w-full border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNotifyEmail(user?.email || "");
                    setNotifySubmitted(false);
                    setNotifyOpen(true);
                  }}
                >
                  <Bell className="h-3.5 w-3.5 mr-1.5" />
                  Notify Me
                </Button>
              ) : !canAddItem(price) ? (
                <Tooltip open={lockedTipOpen} onOpenChange={setLockedTipOpen}>
                  <TooltipTrigger asChild>
                    <div
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLockedTipOpen(true);
                        clearTimeout(lockedTipTimerRef.current);
                        lockedTipTimerRef.current = setTimeout(() => setLockedTipOpen(false), 3000);
                      }}
                    >
                      <Button
                        size="sm"
                        disabled
                        className="font-display text-xs tracking-wider uppercase h-8 px-3 w-full opacity-50 cursor-not-allowed"
                      >
                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                        Locked
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-center">
                    New accounts are limited to €{limitEur} total in cart for the first 24 hours.
                  </TooltipContent>
                </Tooltip>
              ) : (
              <>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  if (regionMismatch) {
                    setPendingBuyNow(false);
                    setShowRegionWarning(true);
                  } else {
                    if (onAddToCart) onAddToCart(e);
                  }
                }}
              >
                <ShoppingCart className="h-5 w-5" />
              </Button>
              <Button
                size="sm"
                className="font-display text-xs tracking-wider uppercase h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={(e) => {
                  e.stopPropagation();
                  if (regionMismatch) {
                    setPendingBuyNow(true);
                    setShowRegionWarning(true);
                  } else {
                    const allowed = canAddItem(price);
                    if (onAddToCart) onAddToCart(e);
                    if (allowed) navigate("/checkout");
                  }
                }}
              >
                Buy Now
              </Button>
              </>
              )}
            </div>
          </div>
        </div>
      </div>

      {regionMismatch && (
        <RegionWarningDialog
          open={showRegionWarning}
          onOpenChange={setShowRegionWarning}
          productRegion={region!}
          userCountry={userCountry!}
          onConfirm={() => {
            setShowRegionWarning(false);
            // Create a synthetic-like event for onAddToCart (it only uses stopPropagation)
            const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
            const allowed = canAddItem(price);
            if (onAddToCart) onAddToCart(fakeEvent);
            if (pendingBuyNow && allowed) navigate("/checkout");
          }}
        />
      )}

      {/* Notify Me dialog */}
      <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider uppercase flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notify Me
            </DialogTitle>
            <DialogDescription>
              Get an email the moment <span className="text-foreground font-semibold">{title}</span> is back in stock.
            </DialogDescription>
          </DialogHeader>
          {notifySubmitted ? (
            <div className="text-sm text-foreground py-2">
              ✓ You're on the list. We'll email you when it's available.
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                type="email"
                placeholder="your@email.com"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <Button
                className="w-full font-display tracking-wider uppercase"
                disabled={notifySubmitting || !notifyEmail || !id}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!id) return;
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!emailRegex.test(notifyEmail)) {
                    toast.error("Please enter a valid email");
                    return;
                  }
                  setNotifySubmitting(true);
                  const { error } = await (supabase as any)
                    .from("stock_notifications")
                    .insert({ email: notifyEmail, allowed_product_id: id });
                  setNotifySubmitting(false);
                  if (error && error.code !== "23505") {
                    toast.error(error.message || "Failed to subscribe");
                    return;
                  }
                  setNotifySubmitted(true);
                  toast.success(error?.code === "23505" ? "You're already subscribed" : "We'll notify you when it's back!");
                }}
              >
                {notifySubmitting ? "Subscribing..." : "Notify Me"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default GameCard;
