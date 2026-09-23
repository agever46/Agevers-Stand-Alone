import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, X, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "agevers_giveaway_popup_seen";
const SHOW_DELAY_MS = 8000; // wait 8s before showing
const COOLDOWN_DAYS = 3;

interface ActiveGiveaway { id: string; title: string }

const GiveawayPopup = () => {
  const [g, setG] = useState<ActiveGiveaway | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Cooldown check
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen) {
        const seenAt = parseInt(seen, 10);
        if (Date.now() - seenAt < COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return;
      }
    } catch {}

    let cancelled = false;
    let timer: number | undefined;

    (supabase as any).rpc("get_public_active_giveaway").then(({ data }: any) => {
      if (cancelled) return;
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
      if (!row) return;
      setG(row as ActiveGiveaway);
      timer = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    });

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && g && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.9 }}
          className="fixed bottom-4 right-4 z-[90] w-[calc(100vw-2rem)] max-w-md sm:max-w-lg"
        >
          <div className="glass rounded-2xl border border-primary/30 p-6 md:p-7 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/30 blur-3xl pointer-events-none" />
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-start gap-4 relative">
              <div className="h-16 w-16 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                <Gift className="h-8 w-8" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1.5">
                  Free giveaway
                </div>
                <h3 className="font-display font-bold text-foreground text-xl md:text-2xl mb-2 leading-tight">
                  Win a free game key 🎁
                </h3>
                <p className="text-sm md:text-base text-muted-foreground mb-4 line-clamp-2">{g.title}</p>
                <Link
                  to="/giveaway"
                  onClick={dismiss}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  Enter for free <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GiveawayPopup;