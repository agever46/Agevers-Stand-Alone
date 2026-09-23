import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, ShoppingBag, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Maps product regions to plausible buyer countries */
const REGION_COUNTRIES: Record<string, string[]> = {
  Global: [
    "United States", "United Kingdom", "Germany", "France", "Canada",
    "Netherlands", "Australia", "Spain", "Italy", "Poland",
    "Sweden", "Brazil", "Belgium", "Switzerland", "Norway",
    "Denmark", "Finland", "Austria", "Portugal", "Ireland",
  ],
  Europe: [
    "Germany", "France", "Netherlands", "Spain", "Italy", "Poland",
    "Sweden", "Belgium", "Switzerland", "Norway", "Denmark",
    "Finland", "Austria", "Portugal", "Ireland", "Czech Republic",
    "Romania", "Greece", "Hungary",
  ],
  "North America": ["United States", "Canada", "Mexico"],
  "Latin America": ["Brazil", "Argentina", "Chile", "Colombia", "Mexico", "Peru"],
  "Middle East": ["Saudi Arabia", "UAE", "Israel", "Turkey", "Qatar", "Kuwait", "Jordan"],
  "Southeast Asia": ["Singapore", "Malaysia", "Thailand", "Philippines", "Indonesia", "Vietnam"],
  Oceania: ["Australia", "New Zealand"],
  "EU/NA": [
    "United States", "Canada", "Germany", "France", "Netherlands",
    "Spain", "Italy", "Poland", "Sweden", "United Kingdom",
  ],
  EMEA: [
    "United Kingdom", "Germany", "France", "Spain", "Italy",
    "Saudi Arabia", "UAE", "South Africa", "Nigeria",
  ],
  Africa: ["South Africa", "Nigeria", "Kenya", "Ghana", "Egypt"],
  Asia: ["Japan", "Korea", "India", "Singapore", "Hong Kong", "Taiwan"],
};

/** Deterministic hash → 0..1 (so all visitors see the same value at the same time) */
const hashToUnit = (n: number): number => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 100000) / 100000;
};

const pickDeterministic = <T,>(arr: T[], seed: number): T =>
  arr[Math.floor(hashToUnit(seed) * arr.length) % arr.length];

/** Pick a country that matches the product region — deterministic */
const pickCountryForRegion = (region: string | null | undefined, seed: number): string => {
  if (!region) return pickDeterministic(REGION_COUNTRIES.Global, seed);
  if (REGION_COUNTRIES[region]) return pickDeterministic(REGION_COUNTRIES[region], seed);
  const allCountries = Object.values(REGION_COUNTRIES).flat();
  if (allCountries.includes(region)) return region;
  return pickDeterministic(REGION_COUNTRIES.Global, seed);
};

interface PopupData {
  title: string;
  image_url: string | null;
  location: string;
  slug: string;
}

// Show a new popup every TICK_MS for everyone — synchronized via wall-clock time
const TICK_MS = 45_000; // 45 seconds
const VISIBLE_MS = 6_000;

const RecentPurchasePopup = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const products = useRef<{ title: string; image_url: string | null; region: string | null; slug: string }[]>([]);
  const lastTickShown = useRef<number>(-1);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, 400);
  }, []);

  // Load data once — only from allowed_products (real catalog), ordered for stability
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("allowed_products")
        .select("title, image_url, region, slug")
        .gt("sold_count", 0)
        .order("slug", { ascending: true })
        .limit(100);

      if (!cancelled && data?.length) {
        products.current = data.filter((p) => p.slug && p.title).map((p) => ({
          title: p.title,
          image_url: p.image_url,
          region: p.region,
          slug: p.slug,
        }));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const showForTick = useCallback((tick: number) => {
    if (products.current.length === 0) return;
    if (lastTickShown.current === tick) return;
    lastTickShown.current = tick;

    const product = pickDeterministic(products.current, tick);
    const location = pickCountryForRegion(product.region, tick + 1);

    setPopup({
      title: product.title,
      image_url: product.image_url,
      location,
      slug: product.slug,
    });
    setExiting(false);
    setVisible(true);

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => dismiss(), VISIBLE_MS);
  }, [dismiss]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNext = () => {
      const now = Date.now();
      const nextTickAt = Math.ceil(now / TICK_MS) * TICK_MS;
      const delay = nextTickAt - now;
      timeoutId = setTimeout(() => {
        showForTick(Math.floor(nextTickAt / TICK_MS));
        scheduleNext();
      }, delay);
    };

    // Initial delay: wait at least 8s, then sync to the next global tick
    const initialDelay = setTimeout(scheduleNext, 8_000);

    return () => {
      clearTimeout(initialDelay);
      if (timeoutId) clearTimeout(timeoutId);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [showForTick]);

  if (!visible || !popup) return null;

  const cleanTitle = popup.title?.length > 60
    ? popup.title.substring(0, 60) + "…"
    : popup.title;

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 sm:right-auto z-50 transition-all duration-400 ${
        exiting
          ? "opacity-0 translate-y-4"
          : "opacity-100 translate-y-0 animate-in slide-in-from-bottom-8 duration-500"
      }`}
    >
      <button
        onClick={() => {
          dismiss();
          navigate(`/product/${popup.slug}`);
        }}
        className="w-full sm:w-auto text-left block"
      >
        <div className="bg-background/95 backdrop-blur-md border border-primary/20 rounded-xl shadow-2xl shadow-primary/10 p-4 flex items-center gap-4 sm:max-w-[420px] relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-primary/40 rounded-l-xl" />

          <div
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              dismiss();
            }}
            className="absolute top-2 right-2 text-muted-foreground/60 hover:text-foreground transition-colors p-0.5 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </div>

          {popup.image_url ? (
            <img
              src={popup.image_url}
              alt={popup.title}
              className="w-[56px] h-[56px] rounded-lg object-cover flex-shrink-0 ring-1 ring-primary/10"
            />
          ) : (
            <div className="w-[56px] h-[56px] rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
          )}

          <div className="flex flex-col min-w-0 pr-5 gap-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="text-[11px] text-foreground/70 font-medium uppercase tracking-wide">
                New Purchase
              </span>
            </div>
            <span className="text-[13px] text-foreground leading-snug">
              A buyer from <span className="font-bold">{popup.location}</span> just purchased{" "}
              <span className="font-bold">{cleanTitle}</span>
            </span>
          </div>
        </div>
      </button>
    </div>
  );
};

export default RecentPurchasePopup;
