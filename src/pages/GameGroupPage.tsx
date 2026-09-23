import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ShoppingCart, Zap, Check, Pencil, Wand2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCart } from "@/hooks/useCart";
import { useCurrency } from "@/hooks/useCurrency";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getProductTypeLabel } from "@/lib/gameItemClassifier";
import { standardizeImageUrl } from "@/lib/imageTransform";

const EDITION_KEYWORDS = [
  "Digital Deluxe", "Super Deluxe", "Game of the Year",
  "Definitive", "Deluxe", "Ultimate", "Gold", "Premium", "Collector",
  "Limited", "Legacy", "Complete", "GOTY", "Legendary", "Champion",
  "Enhanced", "Anniversary", "Standard",
];

const detectEdition = (title: string): string => {
  if (!title) return "Standard";
  for (const kw of EDITION_KEYWORDS) {
    const re = new RegExp(`\\b${kw.replace(/ /g, "\\s+")}\\b`, "i");
    if (re.test(title)) return `${kw} Edition`;
  }
  return "Standard Edition";
};

// Denomination on gift cards / wallet top-ups (e.g. "Steam Wallet Card 2
// USD", "PSN Card $50") — variant products that differ only by amount get
// an Amount selector alongside Platform/Edition/Region.
const CURRENCY_CODES = "USD|EUR|GBP|CAD|AUD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RON|TRY|BRL|ARS|MXN|CLP|COP|PEN|JPY|KRW|CNY|INR|ZAR|SAR|AED|ILS|NZD|SGD|HKD|THB|MYR|PHP|IDR|VND|TWD|BGN|UAH|UYU|CRC|MVR";
const AMOUNT_RE = new RegExp(
  `\\b(\\d+(?:[.,]\\d+)?)\\s*(${CURRENCY_CODES})\\b|\\b(${CURRENCY_CODES})\\s*(\\d+(?:[.,]\\d+)?)\\b|([$€£])\\s*(\\d+(?:[.,]\\d+)?)`,
  "i",
);

const detectAmount = (title: string): string | null => {
  if (!title) return null;
  const m = title.match(AMOUNT_RE);
  if (!m) return null;
  if (m[1] && m[2]) return `${m[1]} ${m[2]}`;
  if (m[3] && m[4]) return `${m[4]} ${m[3]}`;
  if (m[5] && m[6]) return `${m[5]}${m[6]}`;
  return null;
};

interface GroupItem {
  id: string;
  item_type: string;
  display_order: number;
  product: {
    id: string;
    title: string;
    original_title: string | null;
    platform: string;
    store: string | null;
    platform_details: string | null;
    product_type: string | null;
    region: string;
    image_url: string | null;
    slug: string;
    badges: string[] | null;
    sold_count: number;
    wishlist_count: number;
    release_date: string | null;
    description: string | null;
    video_url: string | null;
    screenshots: string[] | null;
  };
  offer?: {
    id: string;
    sell_price: number;
    kinguin_stock: number | null;
    is_active: boolean;
  } | null;
}

interface Group {
  id: string;
  slug: string;
  title: string;
  image_url: string | null;
  base_product_id: string | null;
}

const GameGroupPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [items, setItems] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selType, setSelType] = useState<string>("");
  const [selPlatform, setSelPlatform] = useState<string>("");
  const [selRegion, setSelRegion] = useState<string>("");
  const [selEdition, setSelEdition] = useState<string>("");
  const [selAmount, setSelAmount] = useState<string>("");
  const [isHoveringCover, setIsHoveringCover] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [paraphrasing, setParaphrasing] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    // user_roles has no direct SELECT grant (by design), so this goes
    // through check_my_role() instead of a table query.
    supabase.rpc("check_my_role" as any, { _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!slug) return;
      setLoading(true);
      setNotFound(false);

      const { data: groupData, error: groupErr } = await supabase
        .from("game_groups" as any)
        .select("id, slug, title, image_url, base_product_id")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (cancelled) return;
      if (groupErr || !groupData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const g = groupData as any as Group;
      setGroup(g);

      const { data: itemRows } = await supabase
        .from("game_group_items" as any)
        .select(`
          id,
          item_type,
          display_order,
          allowed_products!inner (
            id, title, original_title, platform, store, platform_details, product_type, region, image_url, slug, badges, sold_count, wishlist_count, release_date, description, video_url, screenshots
          )
        `)
        .eq("group_id", g.id)
        .order("display_order", { ascending: true });

      const productIds = (itemRows || []).map((r: any) => r.allowed_products.id);

      const { data: offers } = productIds.length
        ? await supabase.rpc("get_public_kinguin_by_ids" as any, { _ids: productIds })
        : { data: [] as any[] };

      const offerMap = new Map<string, any>();
      (offers || []).forEach((o: any) => offerMap.set(o.allowed_product_id, o));

      const built: GroupItem[] = (itemRows || []).map((r: any) => ({
        id: r.id,
        item_type: r.item_type,
        display_order: r.display_order,
        product: r.allowed_products,
        offer: offerMap.get(r.allowed_products.id) || null,
      }));

      if (cancelled) return;
      setItems(built);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Only consider base / edition items for the variant selector (DLC/skins/currency hidden)
  const baseItems = useMemo(
    () => items.filter((i) => i.item_type === "base" || i.item_type === "edition"),
    [items],
  );

  // Decorate each item with detected edition/amount labels
  const decorated = useMemo(
    () =>
      baseItems.map((i) => ({
        ...i,
        edition: detectEdition(i.product.title),
        amount: detectAmount(i.product.title),
      })),
    [baseItems],
  );

  // 1) Platforms
  const platforms = useMemo(
    () => Array.from(new Set(decorated.map((i) => i.product.platform).filter(Boolean))),
    [decorated],
  );
  const showPlatformSelect = platforms.length > 1;

  // 2) Editions available for the selected platform
  const editionsForPlatform = useMemo(
    () =>
      Array.from(
        new Set(
          decorated
            .filter((i) => i.product.platform === selPlatform)
            .map((i) => i.edition),
        ),
      ),
    [decorated, selPlatform],
  );
  const showEditionSelect = editionsForPlatform.length > 1;

  // 3) Regions for the selected platform + edition
  const regionsForCombo = useMemo(
    () =>
      Array.from(
        new Set(
          decorated
            .filter(
              (i) =>
                i.product.platform === selPlatform &&
                (showEditionSelect ? i.edition === selEdition : true),
            )
            .map((i) => i.product.region)
            .filter(Boolean),
        ),
      ),
    [decorated, selPlatform, selEdition, showEditionSelect],
  );
  const showRegionSelect = regionsForCombo.length > 1;

  // 4) Amounts (denomination) for the selected platform + edition + region
  const amountsForCombo = useMemo(
    () =>
      Array.from(
        new Set(
          decorated
            .filter(
              (i) =>
                i.product.platform === selPlatform &&
                (showEditionSelect ? i.edition === selEdition : true) &&
                (showRegionSelect ? i.product.region === selRegion : true),
            )
            .map((i) => i.amount)
            .filter(Boolean) as string[],
        ),
      ),
    [decorated, selPlatform, selEdition, selRegion, showEditionSelect, showRegionSelect],
  );
  const showAmountSelect = amountsForCombo.length > 1;

  // Defaults
  useEffect(() => {
    if (!decorated.length) return;
    if (!platforms.includes(selPlatform)) setSelPlatform(platforms[0] || "");
  }, [decorated, platforms, selPlatform]);

  useEffect(() => {
    if (!selPlatform) return;
    if (!editionsForPlatform.includes(selEdition)) {
      const preferred = editionsForPlatform.find((e) => /standard/i.test(e)) || editionsForPlatform[0];
      setSelEdition(preferred || "");
    }
  }, [selPlatform, editionsForPlatform, selEdition]);

  useEffect(() => {
    if (!selPlatform) return;
    if (!regionsForCombo.includes(selRegion)) {
      setSelRegion(regionsForCombo[0] || "");
    }
  }, [selPlatform, selEdition, regionsForCombo, selRegion]);

  useEffect(() => {
    if (!selPlatform) return;
    if (!amountsForCombo.includes(selAmount)) {
      setSelAmount(amountsForCombo[0] || "");
    }
  }, [selPlatform, selEdition, selRegion, amountsForCombo, selAmount]);

  const selectedItem = useMemo(
    () =>
      decorated.find(
        (i) =>
          i.product.platform === selPlatform &&
          (showEditionSelect ? i.edition === selEdition : true) &&
          (showRegionSelect ? i.product.region === selRegion : true) &&
          (showAmountSelect ? i.amount === selAmount : true),
      ) || null,
    [decorated, selPlatform, selEdition, selRegion, selAmount, showEditionSelect, showRegionSelect, showAmountSelect],
  );

  // Primary product for hero (description/image) — prefer group.base_product_id, then first base item, then first item
  const primary = useMemo(() => {
    if (!items.length) return null;
    if (group?.base_product_id) {
      const m = items.find((i) => i.product.id === group.base_product_id);
      if (m) return m;
    }
    return items.find((i) => i.item_type === "base") || items[0];
  }, [items, group]);

  const heroImage =
    selectedItem?.product.image_url ||
    primary?.product.image_url ||
    group?.image_url ||
    null;
  // Kept separate from `heroImage` — the gallery filter below matches against
  // the raw stored screenshot URLs, so the comparison needs the untransformed value.
  const optimizedHeroImage = standardizeImageUrl(heroImage, { width: 1000, height: 1000, fit: "contain" }) ?? heroImage;
  const cleanedDescription = (primary?.product.description || "")
    .replace(/^\s*AliExpress Product ID:\s*[^\n\r]+\s*$/gim, "")
    .trim();
  const heroBadges = primary?.product.badges || [];
  const heroVideoUrl = selectedItem?.product.video_url || primary?.product.video_url || null;
  const galleryImages = useMemo(() => {
    const screenshots = selectedItem?.product.screenshots || primary?.product.screenshots || [];
    return screenshots.filter((s) => s && s !== heroImage);
  }, [selectedItem, primary, heroImage]);

  const inStock =
    selectedItem?.offer?.is_active && (selectedItem.offer.kinguin_stock ?? 0) > 0;
  const price = selectedItem?.offer?.sell_price ?? 0;

  const handleAddToCart = () => {
    if (!selectedItem || !selectedItem.offer || !inStock) return false;
    const added = addItem({
      offerId: selectedItem.product.id,
      title: selectedItem.product.title,
      platform: selectedItem.product.platform,
      price: selectedItem.offer.sell_price,
      sellerName: "Agever's",
      image_url: selectedItem.product.image_url,
      maxStock: selectedItem.offer.kinguin_stock ?? undefined,
    });
    // addItem() itself shows the "Added to cart" toast on success.
    return added;
  };

  const handleBuyNow = () => {
    if (!selectedItem || !inStock) return;
    if (!handleAddToCart()) return;
    navigate("/checkout");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-[calc(var(--new-account-banner-height,0px)+5rem)] md:pt-[calc(var(--new-account-banner-height,0px)+8rem)] pb-6 md:pb-10">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {loading && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="aspect-video w-full rounded-xl bg-muted animate-pulse" />
            <div className="space-y-4">
              <div className="h-10 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-24 w-full rounded bg-muted animate-pulse" />
              <div className="h-12 w-full rounded bg-muted animate-pulse" />
            </div>
          </div>
        )}

        {!loading && notFound && (
          <div className="text-center py-20">
            <h1 className="font-display text-2xl gradient-text mb-2">Group not found</h1>
            <p className="text-muted-foreground">The game group you're looking for doesn't exist or is inactive.</p>
          </div>
        )}

        {!loading && group && !notFound && (
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left: title + image + description */}
            <div className="lg:col-span-3 space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl md:text-4xl font-bold gradient-text">
                    {group.title}
                  </h1>
                  {isAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0"
                        title="Edit group"
                        onClick={() => {
                          setEditTitle(group.title);
                          setEditImageUrl(group.image_url || "");
                          setEditDescription(primary?.product.description || "");
                          setEditOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary shrink-0"
                        title="Paraphrase description"
                        disabled={paraphrasing || !primary?.product.id}
                        onClick={async () => {
                          if (!primary?.product.id) return;
                          setParaphrasing(true);
                          try {
                            const { data: sessionData } = await supabase.auth.getSession();
                            const token = sessionData?.session?.access_token;
                            const res = await fetch(
                              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-descriptions`,
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  action: "paraphrase_one",
                                  product_id: primary.product.id,
                                }),
                              }
                            );
                            const result = await res.json();
                            if (result.error) throw new Error(result.error);
                            toast.success("Paraphrase complete");
                            // Refresh description in state
                            const { data: refreshed } = await supabase
                              .from("allowed_products")
                              .select("description")
                              .eq("id", primary.product.id)
                              .maybeSingle();
                            if (refreshed?.description) {
                              setItems((prev) =>
                                prev.map((it) =>
                                  it.product.id === primary.product.id
                                    ? { ...it, product: { ...it.product, description: refreshed.description } }
                                    : it,
                                ),
                              );
                            }
                          } catch (err: any) {
                            toast.error(err.message || "Paraphrase failed");
                          } finally {
                            setParaphrasing(false);
                          }
                        }}
                      >
                        <Wand2 className={`h-4 w-4 ${paraphrasing ? "animate-spin" : ""}`} />
                      </Button>
                    </>
                  )}
                </div>
                {heroBadges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {heroBadges.slice(0, 6).map((b) => (
                      <Badge key={b} variant="secondary" className="text-[10px]">{b}</Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative w-full rounded-xl overflow-hidden bg-[hsl(var(--background))]">
                {heroImage ? (
                  <>
                    {/* Blurred backdrop so the entire artwork is visible without cropping */}
                    <img
                      src={optimizedHeroImage}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-40"
                    />
                    <div
                      className="relative"
                      onMouseEnter={() => setIsHoveringCover(true)}
                      onMouseLeave={() => setIsHoveringCover(false)}
                    >
                      {isHoveringCover && heroVideoUrl && (() => {
                        const videoId = heroVideoUrl.includes("youtube.com/watch")
                          ? new URL(heroVideoUrl).searchParams.get("v")
                          : null;
                        return videoId ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1`}
                            className="absolute inset-0 w-full h-full z-10"
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                          />
                        ) : null;
                      })()}
                      <img
                        src={optimizedHeroImage}
                        alt={group.title}
                        className="w-full h-auto object-contain"
                      />
                      {heroVideoUrl && !isHoveringCover && (
                        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm text-[11px] text-muted-foreground">
                          <div className="w-0 h-0 border-l-[6px] border-l-primary border-y-[4px] border-y-transparent" />
                          Hover to play
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="w-full aspect-[801/700] bg-muted" />
                )}
              </div>

              {galleryImages.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {galleryImages.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxIndex(i)}
                      className="relative flex-shrink-0 w-[180px] rounded-lg overflow-hidden bg-secondary border border-border/50 hover:border-primary/50 transition-all group cursor-pointer"
                    >
                      <img src={standardizeImageUrl(url, { width: 360, height: 200, fit: "cover" }) ?? url} alt="" className="w-full h-auto object-cover aspect-video" />
                    </button>
                  ))}
                </div>
              )}

              {cleanedDescription && (
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground tracking-wider uppercase mb-4">
                    Description
                  </h2>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                    {cleanedDescription}
                  </p>
                </div>
              )}
            </div>

            {/* Right: variant selector */}
            <div className="lg:col-span-2">
              <div className="lg:sticky lg:top-24 rounded-xl border border-border/60 bg-card/60 backdrop-blur p-5 space-y-4">
                {selectedItem && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap pb-1">
                    {(() => {
                      const p = selectedItem.product;
                      const isInGameItems = p.platform === "In-Game Items" || p.store === "In-Game Items";
                      const PC_STORES = [
                        "Steam", "Epic Games", "GOG", "Battle.net", "EA App", "Origin",
                        "Ubisoft Connect", "Uplay", "MS Store (PC)", "Microsoft Store",
                        "Rockstar", "Bethesda", "Official Website",
                      ];
                      const matchPcStore = (val: string): string | null => {
                        const v = val.toLowerCase();
                        for (const s of PC_STORES) if (v.includes(s.toLowerCase())) return s;
                        return null;
                      };
                      const matchConsole = (val: string): string | null => {
                        const v = val.toLowerCase();
                        if (v.includes("xbox")) return "Xbox";
                        if (v.includes("playstation") || /\bps[345]\b/.test(v) || v.includes("psn")) return "PlayStation";
                        if (v.includes("nintendo") || v.includes("switch")) return "Nintendo";
                        return null;
                      };
                      const inferFromTitle = (title: string) => {
                        const t = title || "";
                        return { pc: matchPcStore(t), console: matchConsole(t) };
                      };
                      let displayPlatform = p.platform;
                      let displaySubPlatform: string | null = p.store || null;
                      if (isInGameItems) {
                        const pd = (p.platform_details || "").trim();
                        const pdLower = pd.toLowerCase();
                        const usePd = pd && pdLower !== "other";
                        const pcStore = usePd ? matchPcStore(pd) : null;
                        const consoleP = usePd ? matchConsole(pd) : null;
                        if (pcStore) {
                          displayPlatform = "PC";
                          displaySubPlatform = pcStore;
                        } else if (consoleP) {
                          displayPlatform = consoleP;
                          displaySubPlatform = "In-Game Items";
                        } else {
                          const inferred = inferFromTitle(p.title);
                          if (inferred.pc) {
                            displayPlatform = "PC";
                            displaySubPlatform = inferred.pc;
                          } else if (inferred.console) {
                            displayPlatform = inferred.console;
                            displaySubPlatform = "In-Game Items";
                          }
                        }
                      }
                      const typeLabel = getProductTypeLabel({
                        title: p.title,
                        originalTitle: p.original_title,
                        description: p.description,
                        store: p.store,
                        productType: p.product_type,
                      });
                      return (
                        <>
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Platform</span>
                            <span className="text-primary font-medium">{displayPlatform}</span>
                          </div>
                          {displaySubPlatform && displaySubPlatform !== displayPlatform && (
                            <>
                              <span className="text-muted-foreground/40">•</span>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Sub-Platform</span>
                                <span className="text-primary font-medium">{displaySubPlatform}</span>
                              </div>
                            </>
                          )}
                          {typeLabel && (
                            <>
                              <span className="text-muted-foreground/40">•</span>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Type</span>
                                <span className="text-primary font-medium">{typeLabel}</span>
                              </div>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {selectedItem?.product.release_date && new Date(selectedItem.product.release_date) > new Date() && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-orange-500/20 to-orange-600/10 border border-orange-500/50 shadow-[0_0_20px_-5px_rgba(249,115,22,0.4)]">
                    <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-orange-500 text-white shrink-0">
                      PRE-ORDER
                    </span>
                    <span className="text-sm font-semibold text-orange-200">
                      Release date is {new Date(selectedItem.product.release_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </span>
                  </div>
                )}

                {showPlatformSelect && (
                  <div>
                    <label className="text-xs font-display tracking-wider text-muted-foreground uppercase mb-1.5 block">
                      Platform
                    </label>
                    <Select value={selPlatform} onValueChange={setSelPlatform} disabled={!platforms.length}>
                      <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                      <SelectContent>
                        {platforms.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showEditionSelect && (
                  <div>
                    <label className="text-xs font-display tracking-wider text-muted-foreground uppercase mb-1.5 block">
                      Edition
                    </label>
                    <Select value={selEdition} onValueChange={setSelEdition}>
                      <SelectTrigger><SelectValue placeholder="Select edition" /></SelectTrigger>
                      <SelectContent>
                        {editionsForPlatform.map((e) => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showRegionSelect && (
                  <div>
                    <label className="text-xs font-display tracking-wider text-muted-foreground uppercase mb-1.5 block">
                      Region
                    </label>
                    <Select value={selRegion} onValueChange={setSelRegion} disabled={!regionsForCombo.length}>
                      <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                      <SelectContent>
                        {regionsForCombo.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {showAmountSelect && (
                  <div>
                    <label className="text-xs font-display tracking-wider text-muted-foreground uppercase mb-1.5 block">
                      Amount
                    </label>
                    <Select value={selAmount} onValueChange={setSelAmount}>
                      <SelectTrigger><SelectValue placeholder="Select amount" /></SelectTrigger>
                      <SelectContent>
                        {amountsForCombo.map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="pt-3 border-t border-border/60">
                  {selectedItem ? (
                    <>
                      <div className="flex items-baseline justify-between mb-3">
                        <span className="text-xs text-muted-foreground font-display tracking-wider uppercase">Price</span>
                        <span className="text-2xl md:text-3xl font-bold gradient-text">
                          {price > 0 ? formatPrice(price) : "—"}
                        </span>
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs mb-3 ${inStock ? "text-green-500" : "text-destructive"}`}>
                        <Check className="w-3.5 h-3.5" />
                        {inStock ? `In stock${selectedItem.offer?.kinguin_stock ? ` (${selectedItem.offer.kinguin_stock})` : ""}` : "Out of stock"}
                      </div>
                      <div className="space-y-2">
                        <Button
                          onClick={handleBuyNow}
                          disabled={!inStock}
                          className="w-full gradient-primary font-display tracking-wider"
                          size="lg"
                        >
                          <Zap className="w-4 h-4 mr-2" /> Buy Now
                        </Button>
                        <Button
                          onClick={handleAddToCart}
                          disabled={!inStock}
                          variant="outline"
                          className="w-full font-display tracking-wider"
                          size="lg"
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No variant matches this combination.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && items.length === 0 && group && !notFound && (
          <p className="text-muted-foreground text-center py-12">No items in this group yet.</p>
        )}
      </div>
      <Footer />

      {/* Lightbox Modal */}
      {lightboxIndex !== null && galleryImages[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="h-6 w-6" />
          </button>
          {lightboxIndex > 0 && (
            <button
              className="absolute left-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}
          {lightboxIndex < galleryImages.length - 1 && (
            <button
              className="absolute right-4 z-10 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}
          <img
            src={standardizeImageUrl(galleryImages[lightboxIndex], { width: 1600, height: 1200, fit: "contain", quality: 90 }) ?? galleryImages[lightboxIndex]}
            alt=""
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 text-white/70 text-sm">
            {lightboxIndex + 1} / {galleryImages.length}
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Game Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="gg-title">Title</Label>
              <Input id="gg-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="gg-image">Image URL</Label>
              <Input id="gg-image" value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} />
              {editImageUrl && (
                <img src={editImageUrl} alt="" className="mt-2 h-32 rounded object-contain bg-muted" />
              )}
            </div>
            <div>
              <Label htmlFor="gg-desc">Description (applies to primary product)</Label>
              <Textarea
                id="gg-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              disabled={saving}
              onClick={async () => {
                if (!group) return;
                setSaving(true);
                try {
                  const { error: gErr } = await supabase
                    .from("game_groups" as any)
                    .update({ title: editTitle, image_url: editImageUrl || null })
                    .eq("id", group.id);
                  if (gErr) throw gErr;

                  if (primary?.product.id) {
                    const { error: pErr } = await supabase
                      .from("allowed_products")
                      .update({ description: editDescription })
                      .eq("id", primary.product.id);
                    if (pErr) throw pErr;
                  }

                  setGroup({ ...group, title: editTitle, image_url: editImageUrl || null });
                  if (primary?.product.id) {
                    setItems((prev) =>
                      prev.map((it) =>
                        it.product.id === primary.product.id
                          ? { ...it, product: { ...it.product, description: editDescription } }
                          : it,
                      ),
                    );
                  }
                  toast.success("Saved");
                  setEditOpen(false);
                } catch (err: any) {
                  toast.error(err.message || "Save failed");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GameGroupPage;