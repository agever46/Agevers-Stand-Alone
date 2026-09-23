import { useState } from "react";
import { motion } from "framer-motion";
import GamePageLayout from "./GamePageLayout";
import { Button } from "@/components/ui/button";

const SYMBOLS = ["🎮", "💎", "⭐", "🏆", "🎯", "🍀", "7️⃣"];

interface Props {
  onComplete: (coins: number) => void;
  onClose: () => void;
}

const SlotMachine = ({ onComplete, onClose }: Props) => {
  const [reels, setReels] = useState(["❓", "❓", "❓"]);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState(false);
  const [held, setHeld] = useState([false, false, false]);
  const [spinsLeft, setSpinsLeft] = useState(2);
  const [phase, setPhase] = useState<"ready" | "first" | "hold" | "done">("ready");

  const spin = () => {
    if (spinning) return;
    setSpinning(true);

    let count = 0;
    const interval = setInterval(() => {
      setReels((prev) =>
        prev.map((r, i) =>
          held[i] ? r : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
        )
      );
      count++;
      if (count > 15) {
        clearInterval(interval);
        const r = Math.random();
        let final: string[];

        if (phase === "ready") {
          // First spin — normal odds
          if (r < 0.04) {
            const s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
            final = [s, s, s];
          } else if (r < 0.22) {
            const s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
            final = [...SYMBOLS].sort(() => Math.random() - 0.5).slice(0, 3);
            final[0] = s;
            final[Math.random() < 0.5 ? 1 : 2] = s;
          } else {
            final = [...SYMBOLS].sort(() => Math.random() - 0.5).slice(0, 3);
          }
        } else {
          // Respin — only replace non-held reels
          final = reels.map((r, i) =>
            held[i] ? r : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
          );
        }

        setReels(final);
        setSpinning(false);
        setSpinsLeft((s) => s - 1);

        if (spinsLeft <= 1) {
          setPhase("done");
          setDone(true);
        } else {
          setPhase("hold");
        }
      }
    }, 80);
  };

  const toggleHold = (index: number) => {
    if (phase !== "hold") return;
    setHeld((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const keepResult = () => {
    setPhase("done");
    setDone(true);
  };

  let coinsWon = 0;
  if (done) {
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      coinsWon = reels[0] === "7️⃣" ? 50 : 30;
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      coinsWon = 8;
    }
  }

  return (
    <GamePageLayout title="Slot Machine" emoji="🎰" gradientFrom="from-cyan-500" gradientTo="to-blue-600">
      <div className="flex flex-col items-center">
        <p className="text-sm text-muted-foreground mb-1">Match symbols to win!</p>
        <div className="flex gap-2 mb-2">
          <span className="glass rounded-lg px-3 py-1 text-[10px] font-display">7️⃣×3 = <span className="text-[hsl(var(--neon-gold))]">50🪙</span></span>
          <span className="glass rounded-lg px-3 py-1 text-[10px] font-display">3 match = <span className="text-[hsl(var(--neon-gold))]">30🪙</span></span>
          <span className="glass rounded-lg px-3 py-1 text-[10px] font-display">2 match = <span className="text-[hsl(var(--neon-gold))]">8🪙</span></span>
        </div>

        <div className="glass rounded-lg px-3 py-1 mb-6">
          <span className="text-xs text-muted-foreground">Spins left: </span>
          <span className="font-display text-sm font-bold text-foreground">{spinsLeft}</span>
        </div>

        {/* Slot machine frame */}
        <div className="relative mb-4">
          <div className="absolute -inset-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 opacity-20 blur-lg" />

          <div className="relative glass rounded-2xl p-4 border-2 border-primary/30">
            {/* Win line */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-[hsl(var(--neon-gold))]/30 z-10 pointer-events-none" />

            <div className="flex gap-3">
              {reels.map((symbol, i) => (
                <motion.button
                  key={i}
                  onClick={() => toggleHold(i)}
                  animate={spinning && !held[i] ? {
                    y: [0, -15, 15, -10, 10, 0],
                  } : {}}
                  transition={{ duration: 0.2, repeat: spinning ? Infinity : 0, delay: i * 0.07 }}
                  className={`relative ${phase === "hold" ? "cursor-pointer" : "cursor-default"}`}
                  disabled={phase !== "hold"}
                >
                  {held[i] && phase === "hold" && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -top-6 left-1/2 -translate-x-1/2 glass rounded-full px-2 py-0.5 text-[9px] font-display font-bold text-[hsl(var(--neon-gold))] z-20"
                    >
                      HOLD
                    </motion.div>
                  )}
                  <div className={`w-24 h-28 rounded-xl bg-gradient-to-b from-secondary to-muted flex items-center justify-center text-5xl shadow-inner transition-all ${
                    held[i] && phase === "hold"
                      ? "border-2 border-[hsl(var(--neon-gold))]/70 shadow-[0_0_15px_hsl(var(--neon-gold)/0.3)]"
                      : "border-2 border-primary/20"
                  }`}>
                    {symbol}
                  </div>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {phase === "hold" && (
          <p className="text-[10px] text-muted-foreground mb-4">
            Tap reels to hold, then spin again — or keep result
          </p>
        )}

        {(phase === "ready" || (phase === "hold" && !spinning)) && (
          <div className="flex gap-3 w-full mt-2">
            <Button variant="hero" size="lg" onClick={spin} disabled={spinning} className={phase === "ready" ? "w-full" : "flex-1"}>
              {spinning ? "Spinning..." : phase === "ready" ? "🎰 PULL!" : "🔄 Respin"}
            </Button>
            {phase === "hold" && (
              <Button variant="neon" size="lg" onClick={keepResult} className="flex-1">
                ✅ Keep
              </Button>
            )}
          </div>
        )}

        {done && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 10 }}
            className="text-center w-full mt-4"
          >
            <div className="text-5xl mb-3">{coinsWon >= 30 ? "🎰" : coinsWon > 0 ? "🎉" : "😅"}</div>
            <p className="font-display text-2xl font-bold gradient-text mb-1">
              {coinsWon >= 50 ? "MEGA JACKPOT!" : coinsWon >= 30 ? "JACKPOT!" : coinsWon > 0 ? "You Won!" : "No Match"}
            </p>
            {coinsWon > 0 && (
              <p className="font-display text-lg text-[hsl(var(--neon-gold))] mb-4">{coinsWon} coins earned</p>
            )}
            <Button variant="hero" size="lg" onClick={() => onComplete(coinsWon)} className="w-full mt-2">
              {coinsWon > 0 ? "Collect Coins" : "Continue"}
            </Button>
          </motion.div>
        )}
      </div>
    </GamePageLayout>
  );
};

export default SlotMachine;
