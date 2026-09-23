import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Eye, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface CupidCodeRevealProps {
  code: string;
  codeKey: string;
  isRevealed: boolean;
  copiedId: string | null;
  clientIp?: string;
  onReveal: () => void;
  onCopy: (code: string, codeKey: string) => void;
}

const glitchVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: [0, 1, 0.6, 1, 0.85, 1],
    y: 0,
    transition: { duration: 0.8, times: [0, 0.15, 0.3, 0.5, 0.7, 1] },
  },
};

const CupidCodeReveal = ({
  code,
  codeKey,
  isRevealed: alreadyRevealed,
  copiedId,
  clientIp,
  onReveal,
  onCopy,
}: CupidCodeRevealProps) => {
  const [revealed, setRevealed] = useState(alreadyRevealed);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleClick = useCallback(() => {
    if (!termsAccepted) return;
    setRevealed(true);
    onReveal();
  }, [onReveal, termsAccepted]);

  /* ── Already revealed ── */
  if (alreadyRevealed || revealed) {
    return (
      <div className="relative">
        {!alreadyRevealed && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            style={{
              background:
                "radial-gradient(ellipse at center, hsl(var(--primary) / 0.25) 0%, transparent 70%)",
            }}
          />
        )}
        <motion.div
          variants={glitchVariants}
          initial={alreadyRevealed ? "visible" : "hidden"}
          animate="visible"
          className="flex items-center gap-2"
        >
          <div
            className="flex-1 bg-primary/10 border border-primary/30 rounded-lg px-4 py-2.5"
            style={{
              boxShadow:
                "0 0 18px 2px hsl(var(--primary) / 0.2), inset 0 0 12px hsl(var(--primary) / 0.06)",
            }}
          >
            <p
              className="font-mono text-sm text-primary font-bold tracking-wider select-all"
              style={{ textShadow: "0 0 8px hsl(var(--primary) / 0.5)" }}
            >
              {code}
            </p>
          </div>
          <span className="text-[10px] font-display font-bold uppercase tracking-wider text-neon-green flex items-center gap-1 shrink-0">
            <Eye className="h-3 w-3" /> Viewed
          </span>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 h-10 w-10"
            onClick={() => onCopy(code, codeKey)}
          >
            {copiedId === codeKey ? (
              <Check className="h-4 w-4 text-neon-green" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </motion.div>
      </div>
    );
  }

  /* ── Neon floating banner with consent ── */
  return (
    <div className="flex flex-col items-center py-6 gap-4">
      {/* IP notice — deterrent for fraudsters */}
      {clientIp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-[11px] text-muted-foreground/70 bg-muted/30 border border-border/40 rounded-lg px-3 py-1.5"
        >
          <ShieldAlert className="h-3.5 w-3.5 text-primary/60 shrink-0" />
          <span>
            Your session is recorded — IP: <span className="font-mono text-foreground/80">{clientIp}</span>
          </span>
        </motion.div>
      )}

      {/* Consent checkbox */}
      <label className="flex items-start gap-2.5 max-w-sm cursor-pointer select-none">
        <Checkbox
          checked={termsAccepted}
          onCheckedChange={(v) => setTermsAccepted(v === true)}
          className="mt-0.5 border-primary/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
        <span className="text-xs text-muted-foreground leading-relaxed">
          I understand that this digital product is{" "}
          <strong className="text-foreground">non-refundable</strong> once revealed.
        </span>
      </label>

      <AnimatePresence>
        <motion.button
          initial={{ opacity: 0, y: 18, scale: 0.9 }}
          animate={{
            opacity: termsAccepted ? 1 : 0.4,
            y: termsAccepted ? [0, -6, 0] : 0,
            scale: termsAccepted ? 1 : 0.95,
          }}
          transition={{
            opacity: { duration: 0.5 },
            scale: { duration: 0.5 },
            y: termsAccepted ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 },
          }}
          onClick={handleClick}
          disabled={!termsAccepted}
          className={`
            group relative px-8 py-3.5 rounded-xl
            border-2 border-primary/50
            bg-gradient-to-br from-[hsl(var(--primary)/0.18)] via-[hsl(var(--primary)/0.08)] to-transparent
            backdrop-blur-md
            transition-all duration-300
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60
            ${termsAccepted ? "cursor-pointer hover:border-primary/80" : "cursor-not-allowed opacity-40"}
          `}
          style={{
            boxShadow: termsAccepted
              ? "0 0 24px 4px hsl(var(--primary) / 0.2), 0 0 60px 8px hsl(var(--accent) / 0.12), inset 0 1px 0 hsl(var(--foreground) / 0.08)"
              : "none",
          }}
        >
          {termsAccepted && (
            <span
              className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                boxShadow:
                  "0 0 32px 6px hsl(var(--primary) / 0.35), 0 0 80px 12px hsl(var(--accent) / 0.18)",
              }}
            />
          )}

          <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary/70 rounded-tl-lg" />
          <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary/70 rounded-tr-lg" />
          <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary/70 rounded-bl-lg" />
          <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary/70 rounded-br-lg" />

          <motion.span
            animate={termsAccepted ? { scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="block font-display font-bold text-sm tracking-widest uppercase text-primary"
            style={{ textShadow: termsAccepted ? "0 0 12px hsl(var(--primary) / 0.6)" : "none" }}
          >
            CLICK HERE TO VIEW YOUR CODE
          </motion.span>
        </motion.button>
      </AnimatePresence>
    </div>
  );
};

export default CupidCodeReveal;
