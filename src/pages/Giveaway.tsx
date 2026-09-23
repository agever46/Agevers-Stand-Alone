import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Gift, Trophy, Ticket as TicketIcon, Sparkles, ShoppingBag, Lock, Clock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import AgeversLoader from "@/components/AgeversLoader";

interface Giveaway {
  id: string;
  title: string;
  description: string | null;
  allowed_product_id: string | null;
  prize_image_url: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  winner_email: string | null;
  winner_announced_at: string | null;
}

interface Product {
  id: string;
  title: string;
  image_url: string | null;
  slug: string;
}

const useCountdown = (target: string | null) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  return useMemo(() => {
    if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
    const diff = new Date(target).getTime() - now;
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
    return {
      days: Math.floor(diff / 86_400_000),
      hours: Math.floor((diff / 3_600_000) % 24),
      minutes: Math.floor((diff / 60_000) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      ended: false,
    };
  }, [target, now]);
};

const Giveaway = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Free Game Code Giveaway — Win Every 4 Days | Agever's";
    const meta = document.querySelector('meta[name="description"]');
    const prevDesc = meta?.getAttribute("content") || "";
    if (meta) meta.setAttribute("content", "Join Agever's free giveaway and win premium game keys every 4 days. Enter for free, earn bonus entries with every purchase.");
    let canon = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const prevCanon = canon?.getAttribute("href") || "";
    if (!canon) { canon = document.createElement("link"); canon.rel = "canonical"; document.head.appendChild(canon); }
    canon.setAttribute("href", "https://agevers.com/giveaway");

    // SEO: keywords, robots, geo, hreflang, Open Graph, Twitter, JSON-LD
    const upsertMeta = (selector: string, attrs: Record<string, string>) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      const created = !el;
      if (!el) { el = document.createElement("meta"); document.head.appendChild(el); }
      Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
      return { el, created };
    };
    const created: HTMLElement[] = [];
    const track = (r: { el: HTMLElement; created: boolean }) => { if (r.created) created.push(r.el); };

    track(upsertMeta('meta[name="keywords"]', { name: "keywords", content: "free game keys, giveaway, win game codes, free steam keys, free xbox codes, free playstation codes, gaming giveaway, agevers giveaway" }));
    track(upsertMeta('meta[name="robots"]', { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" }));
    track(upsertMeta('meta[name="geo.region"]', { name: "geo.region", content: "EU" }));
    track(upsertMeta('meta[name="geo.placename"]', { name: "geo.placename", content: "Worldwide" }));
    track(upsertMeta('meta[name="ICBM"]', { name: "ICBM", content: "0, 0" }));

    track(upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" }));
    track(upsertMeta('meta[property="og:title"]', { property: "og:title", content: "Free Game Code Giveaway — Win Every 4 Days" }));
    track(upsertMeta('meta[property="og:description"]', { property: "og:description", content: "Enter Agever's free giveaway and win premium game keys every 4 days. Bonus entries on every purchase." }));
    track(upsertMeta('meta[property="og:url"]', { property: "og:url", content: "https://agevers.com/giveaway" }));
    track(upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "Agever's" }));
    track(upsertMeta('meta[property="og:locale"]', { property: "og:locale", content: "en_US" }));
    track(upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" }));
    track(upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: "Free Game Code Giveaway — Win Every 4 Days" }));
    track(upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: "Enter Agever's free giveaway and win premium game keys every 4 days." }));

    // hreflang (x-default + en)
    const addLink = (rel: string, href: string, extra: Record<string, string> = {}) => {
      const link = document.createElement("link");
      link.rel = rel; link.href = href;
      Object.entries(extra).forEach(([k, v]) => link.setAttribute(k, v));
      document.head.appendChild(link);
      created.push(link);
    };
    addLink("alternate", "https://agevers.com/giveaway", { hreflang: "x-default" });
    addLink("alternate", "https://agevers.com/giveaway", { hreflang: "en" });

    // JSON-LD
    const jsonLd = document.createElement("script");
    jsonLd.type = "application/ld+json";
    jsonLd.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Event",
      name: "Agever's Free Game Code Giveaway",
      description: "Win premium game keys every 4 days. Free entry, bonus entries with every purchase.",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      url: "https://agevers.com/giveaway",
      location: { "@type": "VirtualLocation", url: "https://agevers.com/giveaway" },
      organizer: { "@type": "Organization", name: "Agever's", url: "https://agevers.com" },
      offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", availability: "https://schema.org/InStock", url: "https://agevers.com/giveaway" },
    });
    document.head.appendChild(jsonLd);
    created.push(jsonLd);

    return () => {
      document.title = prevTitle;
      if (meta && prevDesc) meta.setAttribute("content", prevDesc);
      if (canon && prevCanon) canon.setAttribute("href", prevCanon);
      created.forEach((el) => el.parentNode?.removeChild(el));
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [giveaway, setGiveaway] = useState<Giveaway | null>(null);
  const [prizeProduct, setPrizeProduct] = useState<Product | null>(null);
  const [pastWinners, setPastWinners] = useState<Giveaway[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [joining, setJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [bonusFromOrders, setBonusFromOrders] = useState(0);

  const countdown = useCountdown(giveaway?.ends_at || null);

  const fetchAll = async () => {
    setLoading(true);
    // Active giveaway (public-safe RPC, no PII)
    const { data: gRows } = await (supabase as any).rpc("get_public_active_giveaway");
    const activeGiveaway = (Array.isArray(gRows) && gRows.length > 0 ? gRows[0] : null) as Giveaway | null;
    setGiveaway(activeGiveaway);

    if (activeGiveaway?.allowed_product_id) {
      const { data: p } = await supabase
        .from("allowed_products")
        .select("id, title, image_url, slug")
        .eq("id", activeGiveaway.allowed_product_id)
        .maybeSingle();
      setPrizeProduct(p as Product | null);
    } else {
      setPrizeProduct(null);
    }

    if (activeGiveaway) {
      const boost = (activeGiveaway as any).fake_entries_boost || 0;
      const { data: stats } = await (supabase as any).rpc("get_giveaway_entry_stats", { _giveaway_id: activeGiveaway.id });
      const row = Array.isArray(stats) && stats.length > 0 ? stats[0] : null;
      setTotalParticipants((Number(row?.participant_count) || 0) + boost);
      setTotalEntries((Number(row?.total_entries) || 0) + boost);

      if (user) {
        const { data: myEntry } = await supabase
          .from("giveaway_entries" as any)
          .select("entry_count, bonus_from_orders")
          .eq("giveaway_id", activeGiveaway.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (myEntry) {
          setHasJoined(true);
          setEntryCount((myEntry as any).entry_count || 0);
          setBonusFromOrders((myEntry as any).bonus_from_orders || 0);
        } else {
          setHasJoined(false);
          setEntryCount(0);
          setBonusFromOrders(0);
        }
      }
    }

    // Past winners (public-safe RPC: only masked winner display)
    const { data: past } = await (supabase as any).rpc("get_public_past_winners", { _limit: 5 });
    setPastWinners((past as unknown as Giveaway[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [user?.id]);

  const handleJoin = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!giveaway) return;
    setJoining(true);
    const { error } = await (supabase as any).from("giveaway_entries").insert({
      giveaway_id: giveaway.id,
      user_id: user.id,
      user_email: user.email,
      entry_count: 1,
      bonus_from_orders: 0,
    });
    if (error) {
      if (error.code === "23505") toast.info("You're already in this giveaway!");
      else toast.error(error.message);
    } else {
      toast.success("🎉 You're in! Buy something to earn extra entries.");
      fetchAll();
      // Telegram alert is sent automatically by the DB trigger
      // (tg_telegram_giveaway_entry) — no need to invoke from the client.
    }
    setJoining(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden border-b border-border/40">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background pointer-events-none" />
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/30 blur-3xl pointer-events-none" />
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="container mx-auto px-4 py-20 md:py-32 lg:py-40 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center max-w-5xl mx-auto flex flex-col items-center"
            >
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-bold uppercase tracking-wider mb-8">
                <Sparkles className="h-4 w-4" />
                New giveaway every 4 days
              </div>
              <h1 className="font-display text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-black text-foreground leading-[1.05] mb-6 tracking-tight">
                Win a Free Game Key
                <span className="block text-primary mt-3 md:mt-4">Every 4 Days</span>
              </h1>
              <p className="text-muted-foreground text-lg md:text-2xl max-w-2xl">
                Free to enter. The more you shop, the higher your chances.
              </p>
            </motion.div>
          </div>
        </section>

        {loading ? (
          <div className="flex justify-center py-24"><AgeversLoader /></div>
        ) : (
          <>
            {/* ACTIVE GIVEAWAY */}
            <section className="container mx-auto px-4 py-12 md:py-16">
              {!giveaway ? (
                <div className="max-w-2xl mx-auto text-center glass rounded-2xl p-12">
                  <Gift className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h2 className="font-display text-2xl font-bold mb-2">No Active Giveaway Right Now</h2>
                  <p className="text-muted-foreground">A new giveaway is coming soon. Check back in a few days!</p>
                </div>
              ) : (
                <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                  {/* Prize card */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="glass rounded-2xl overflow-hidden border border-primary/20"
                  >
                    <div className="aspect-square md:aspect-[4/3] bg-secondary/40 relative overflow-hidden flex items-center justify-center p-6 md:p-8">
                      {(giveaway.prize_image_url || prizeProduct?.image_url) ? (
                        <img
                          src={giveaway.prize_image_url || prizeProduct?.image_url || ""}
                          alt={giveaway.title}
                          className="max-w-[75%] max-h-[75%] object-contain drop-shadow-2xl"
                          loading="eager"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Gift className="h-24 w-24 text-primary/40" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase">
                        <Trophy className="h-3 w-3" /> Prize
                      </div>
                    </div>
                    <div className="p-6 md:p-8 text-center flex flex-col items-center">
                      {prizeProduct && (
                        <Link
                          to={`/product/${prizeProduct.slug || prizeProduct.id}`}
                          className="text-base md:text-lg text-primary hover:underline inline-flex items-center gap-1 font-semibold mb-4"
                        >
                          View product → {prizeProduct.title}
                        </Link>
                      )}
                      <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-black mb-3 leading-tight">{giveaway.title}</h2>
                      {giveaway.description && (
                        <p className="text-muted-foreground text-base md:text-lg max-w-xl">{giveaway.description}</p>
                      )}
                    </div>
                  </motion.div>

                  {/* Entry card */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="glass rounded-2xl p-6 md:p-8 flex flex-col"
                  >
                    {/* Countdown */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider font-bold mb-3">
                        <Clock className="h-3.5 w-3.5" /> Drawing in
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { v: countdown.days, l: "Days" },
                          { v: countdown.hours, l: "Hrs" },
                          { v: countdown.minutes, l: "Min" },
                          { v: countdown.seconds, l: "Sec" },
                        ].map((c) => (
                          <div key={c.l} className="bg-secondary/60 rounded-lg p-3 text-center">
                            <div className="font-display text-2xl md:text-3xl font-black text-primary tabular-nums">
                              {String(c.v).padStart(2, "0")}
                            </div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{c.l}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-secondary/40 rounded-lg p-3 text-center">
                        <div className="font-display text-xl font-bold text-foreground">{totalParticipants.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Participants</div>
                      </div>
                      <div className="bg-secondary/40 rounded-lg p-3 text-center">
                        <div className="font-display text-xl font-bold text-foreground">{totalEntries.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Total Entries</div>
                      </div>
                    </div>

                    {/* CTA */}
                    {!user ? (
                      <Button
                        onClick={() => navigate("/auth")}
                        size="lg"
                        className="w-full gap-2 mb-3"
                      >
                        <Lock className="h-4 w-4" /> Sign in to Enter Free
                      </Button>
                    ) : hasJoined ? (
                      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center mb-3">
                        <div className="text-primary font-bold mb-1 flex items-center justify-center gap-2">
                          <TicketIcon className="h-5 w-5" /> You're in with {entryCount} {entryCount === 1 ? "entry" : "entries"}
                        </div>
                        {bonusFromOrders > 0 && (
                          <div className="text-xs text-muted-foreground">
                            +{bonusFromOrders} bonus from your orders 🛍️
                          </div>
                        )}
                      </div>
                    ) : (
                      <Button
                        onClick={handleJoin}
                        disabled={joining || countdown.ended}
                        size="lg"
                        className="w-full gap-2 mb-3"
                      >
                        <Gift className="h-4 w-4" />
                        {joining ? "Entering…" : "Enter for Free"}
                      </Button>
                    )}

                    {/* Bonus tip */}
                    <div className="mt-auto pt-4 border-t border-border/30">
                      <div className="flex items-start gap-2 text-sm md:text-base text-muted-foreground">
                        <ShoppingBag className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span>
                          <span className="text-foreground font-bold">Heads up:</span> any completed purchase
                          during an active giveaway <span className="text-primary font-bold">automatically enters you</span> (or adds
                          a <span className="text-primary font-bold">+1 bonus entry</span> if you've already joined). No opt-in needed.
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </section>

            {/* HOW IT WORKS */}
            <section id="how-to-earn-entries" className="border-t border-border/30 bg-secondary/20 py-12 scroll-mt-24">
              <div className="container mx-auto px-4">
                <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-4">How to Earn Entries</h2>
                <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-10">
                  There are two ways to collect entries. Every entry increases your chance to win.
                  <span className="block mt-2 text-primary font-semibold">
                    Every purchase counts — even the cheapest products on the site give you bonus entries!
                  </span>
                </p>
                <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  {[
                    { i: Gift, t: "1. Enter Free", d: "Join any active giveaway with one click. No purchase required. You automatically get 1 free entry just for signing up." },
                    { i: ShoppingBag, t: "2. Purchase = +1 Entry", d: "Every completed order during an active giveaway adds +1 bonus entry to your ticket. Buy more, increase your odds." },
                    { i: Trophy, t: "3. Winner Drawn", d: "When the timer hits zero, one entry is randomly selected. The winner is emailed instantly and announced on the site." },
                  ].map((s) => (
                    <div key={s.t} className="glass rounded-xl p-6 text-center">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                        <s.i className="h-6 w-6" />
                      </div>
                      <h3 className="font-display text-lg font-bold mb-2">{s.t}</h3>
                      <p className="text-sm text-muted-foreground">{s.d}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* PAST WINNERS */}
            {pastWinners.length > 0 && (
              <section className="container mx-auto px-4 py-12">
                <h2 className="font-display text-2xl md:text-3xl font-bold text-center mb-8">Recent Winners</h2>
                <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {pastWinners.map((w) => {
                    const hero = (w as any).prize_image_url as string | null;
                    const winnerLabel = (w as any).winner_display || (w.winner_email ? `${w.winner_email.split("@")[0].slice(0, 3)}***@${w.winner_email.split("@")[1]}` : "—");
                    return (
                      <div
                        key={w.id}
                        className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/20 via-primary/10 to-background shadow-xl shadow-primary/20 min-h-[180px] flex"
                      >
                        {hero && (
                          <>
                            <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: `url(${hero})` }} />
                            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/75 to-background/40" />
                          </>
                        )}
                        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/30 blur-3xl pointer-events-none" />
                        <div className="relative flex items-center gap-4 p-4 md:p-5 w-full">
                          {hero ? (
                            <img
                              src={hero}
                              alt={w.title}
                              className="h-24 w-20 md:h-28 md:w-24 object-cover rounded-xl shadow-lg shadow-primary/40 border-2 border-primary/40 shrink-0"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-24 w-20 md:h-28 md:w-24 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
                              <Trophy className="h-10 w-10" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-bold text-primary uppercase tracking-[0.18em]">
                              <Trophy className="h-3.5 w-3.5" /> Winner
                            </div>
                            <div className="font-display text-base md:text-lg font-black text-foreground leading-tight line-clamp-2">
                              {w.title}
                            </div>
                            <div className="text-xs md:text-sm text-muted-foreground truncate">
                              <span className="text-primary font-semibold">{winnerLabel}</span>
                              {w.winner_announced_at && ` · ${new Date(w.winner_announced_at).toLocaleDateString()}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Giveaway;