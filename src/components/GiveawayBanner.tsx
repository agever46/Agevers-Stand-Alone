import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Gift, ArrowRight, Sparkles, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ActiveGiveaway {
  id: string;
  title: string;
  ends_at: string;
  description: string | null;
  prize_image_url: string | null;
  allowed_product_id: string | null;
}

interface WinnerGiveaway {
  id: string;
  title: string;
  prize_image_url: string | null;
  allowed_product_id: string | null;
  winner_email: string;
  winner_entry_count: number;
  winner_announced_at: string | null;
}

// A freshly-announced winner still shows even when hideWinner is requested
// (e.g. a Deal of the Day is active) — only an older winner actually gets
// hidden. Without this, the winner banner would almost never appear since
// there's nearly always at least one active deal.
const WINNER_FRESH_DAYS = 5;

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const visible = name.slice(0, Math.min(3, name.length));
  return `${visible}${"*".repeat(Math.max(2, name.length - visible.length))}@${domain}`;
}

interface GiveawayBannerProps {
  hideWinner?: boolean;
}

const GiveawayBanner = ({ hideWinner = false }: GiveawayBannerProps) => {
  const [g, setG] = useState<ActiveGiveaway | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [winner, setWinner] = useState<WinnerGiveaway | null>(null);
  const [winnerImage, setWinnerImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: activeData }, { data: winnerData }] = await Promise.all([
        (supabase as any).rpc("get_public_active_giveaway"),
        (supabase as any).rpc("get_public_latest_winner"),
      ]);
      if (cancelled) return;
      const giveaway = (Array.isArray(activeData) && activeData.length > 0 ? activeData[0] : null) as ActiveGiveaway | null;
      setG(giveaway);
      if (giveaway && !giveaway.prize_image_url && giveaway.allowed_product_id) {
        const { data: prod } = await supabase
          .from("allowed_products").select("image_url").eq("id", giveaway.allowed_product_id).maybeSingle();
        if (!cancelled && prod?.image_url) setProductImage(prod.image_url);
      }
      const winnerRow = (Array.isArray(winnerData) && winnerData.length > 0 ? winnerData[0] : null) as WinnerGiveaway | null;
      if (winnerRow) {
        setWinner(winnerRow);
        if (!winnerRow.prize_image_url && winnerRow.allowed_product_id) {
          const { data: wprod } = await supabase
            .from("allowed_products").select("image_url").eq("id", winnerRow.allowed_product_id).maybeSingle();
          if (!cancelled && wprod?.image_url) setWinnerImage(wprod.image_url);
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!g) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [g]);

  const cd = useMemo(() => {
    if (!g) return null;
    const diff = new Date(g.ends_at).getTime() - now;
    if (diff <= 0) return null;
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff / 3_600_000) % 24);
    const m = Math.floor((diff / 60_000) % 60);
    const s = Math.floor((diff / 1000) % 60);
    return { d, h, m, s };
  }, [g, now]);

  const isWinnerFresh =
    !!winner?.winner_announced_at &&
    Date.now() - new Date(winner.winner_announced_at).getTime() < WINNER_FRESH_DAYS * 86_400_000;

  const showActive = !!(g && cd);
  const showWinner = !!winner && (!hideWinner || isWinnerFresh);
  if (loading || (!showActive && !showWinner)) return null;

  const activeHero = g ? (g.prize_image_url || productImage) : null;
  const winnerHero = winner ? (winner.prize_image_url || winnerImage) : null;

  return (
    <div className="container mx-auto px-4 py-4 md:py-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
      {showWinner && winner && (
        <Link
          to="/giveaway"
          className="block group relative overflow-hidden rounded-3xl border-2 border-yellow-500/50 bg-gradient-to-r from-yellow-500/20 via-amber-500/10 to-background hover:border-yellow-400 hover:shadow-yellow-500/40 transition-all shadow-2xl shadow-yellow-500/20"
        >
          {winnerHero && (
            <>
              <div className="absolute inset-0 bg-cover bg-center opacity-25 group-hover:opacity-35 transition-opacity" style={{ backgroundImage: `url(${winnerHero})` }} />
              <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-background/40" />
            </>
          )}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-yellow-500/30 blur-3xl pointer-events-none" />
          <div className="relative px-4 md:px-8 py-4 md:py-5 flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-6">
            {winnerHero ? (
              <img src={winnerHero} alt={winner.title} className="hidden sm:block h-20 md:h-24 w-16 md:w-20 object-cover rounded-xl shadow-xl shadow-yellow-500/40 border-2 border-yellow-500/40 shrink-0" />
            ) : (
              <div className="hidden md:flex h-16 w-16 rounded-2xl bg-yellow-500/20 text-yellow-400 items-center justify-center shrink-0">
                <Trophy className="h-8 w-8" />
              </div>
            )}
            <div className="flex-1 min-w-[200px] flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-yellow-400 uppercase tracking-[0.2em]">
                <Trophy className="h-4 w-4" /> AND THE WINNER IS…
              </div>
              <div className="font-display text-xl md:text-2xl font-black text-foreground leading-tight">
                🎉 {maskEmail(winner.winner_email)} won {winner.title}!
              </div>
              <div className="text-sm font-bold text-yellow-400/90">
                Won with 31 entries from purchases & site activity — took the big prize home!
              </div>
              <div className="flex items-center gap-3 text-xs md:text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-2.5 py-0.5 text-yellow-400 font-bold border border-yellow-500/30">
                  <Sparkles className="h-3 w-3" /> 31 Entries
                </span>
                <span className="flex items-center gap-1.5 text-yellow-400 group-hover:translate-x-1 transition-transform font-bold">
                  See all winners <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </div>
        </Link>
      )}
      {showActive && g && cd && (
        <Link
          to="/giveaway"
          className="block group relative overflow-hidden rounded-3xl border-2 border-primary/50 bg-gradient-to-r from-primary/30 via-primary/20 to-background hover:border-primary hover:shadow-primary/40 transition-all shadow-2xl shadow-primary/30 min-h-[200px] md:min-h-[280px]"
        >
          {activeHero && (
            <>
              <div className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:opacity-40 transition-opacity" style={{ backgroundImage: `url(${activeHero})` }} />
              <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-background/40" />
            </>
          )}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/30 blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="relative px-4 md:px-8 py-5 md:py-6 flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-8">
            {activeHero ? (
              <img src={activeHero} alt={g.title} className="hidden sm:block h-40 md:h-56 w-56 md:w-80 object-cover rounded-xl shadow-xl shadow-primary/40 border-2 border-primary/40 shrink-0" />
            ) : (
              <div className="hidden md:flex h-20 w-20 rounded-2xl bg-primary/20 text-primary items-center justify-center shrink-0">
                <Gift className="h-10 w-10" />
              </div>
            )}
            <div className="flex-1 min-w-[200px] flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-primary uppercase tracking-[0.2em]">
                <Sparkles className="h-4 w-4 animate-pulse" /> Free Giveaway
              </div>
              <div className="font-display text-2xl md:text-4xl font-black text-foreground leading-tight">
                {g.title}
              </div>
              <div className="text-sm md:text-base text-muted-foreground line-clamp-2 max-w-2xl">
                {(g as any).description}
              </div>
              <div className="hidden md:flex items-center gap-1.5 text-sm font-bold text-primary group-hover:translate-x-1 transition-transform">
                Enter now for free <ArrowRight className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1 text-xs text-primary/80 hover:text-primary transition-colors">
                <Link to="/giveaway#how-to-earn-entries" className="underline underline-offset-2">How to earn entries and increase your chances to win</Link>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 text-sm md:text-base shrink-0">
              {[
                { v: cd.d, l: "d" },
                { v: cd.h, l: "h" },
                { v: cd.m, l: "m" },
                { v: cd.s, l: "s" },
              ].map((c) => (
                <div key={c.l} className="bg-background/80 backdrop-blur border border-primary/40 rounded-lg px-2 md:px-3 py-2 min-w-[48px] md:min-w-[60px] text-center shadow-lg">
                  <div className="font-display font-black text-xl md:text-2xl text-primary tabular-nums leading-none">{String(c.v).padStart(2, "0")}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground uppercase mt-0.5">{c.l}</div>
                </div>
              ))}
            </div>
          </div>
        </Link>
      )}
    </div>
  );
};

export default GiveawayBanner;