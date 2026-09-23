import { useState } from "react";
import { motion } from "framer-motion";
import GamePageLayout from "./GamePageLayout";
import { Button } from "@/components/ui/button";
import { gameSounds } from "@/lib/gameSounds";

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

interface Props {
  onComplete: (coins: number) => void;
  onClose: () => void;
}

const DiceRoll = ({ onComplete, onClose }: Props) => {
  const [dice, setDice] = useState<[number, number]>([0, 0]);
  const [rolling, setRolling] = useState(false);
  const [phase, setPhase] = useState<"initial" | "rolled" | "rerolled" | "done">("initial");
  const [heldDice, setHeldDice] = useState<[boolean, boolean]>([false, false]);
  const [canReroll, setCanReroll] = useState(true);

  const rollDice = () => {
    if (rolling) return;
    setRolling(true);

    let count = 0;
    const interval = setInterval(() => {
      gameSounds.diceRoll();
      setDice([
        heldDice[0] && phase === "rolled" ? dice[0] : Math.floor(Math.random() * 6),
        heldDice[1] && phase === "rolled" ? dice[1] : Math.floor(Math.random() * 6),
      ]);
      count++;
      if (count > 12) {
        clearInterval(interval);
        const d1 = heldDice[0] && phase === "rolled" ? dice[0] : Math.floor(Math.random() * 6);
        const d2 = heldDice[1] && phase === "rolled" ? dice[1] : Math.floor(Math.random() * 6);
        setDice([d1, d2]);
        setRolling(false);
        gameSounds.diceStop();
        if (phase === "initial") {
          setPhase("rolled");
        } else {
          setPhase("done");
        }
      }
    }, 100);
  };

  const toggleHold = (index: number) => {
    if (phase !== "rolled") return;
    setHeldDice((prev) => {
      const next: [boolean, boolean] = [...prev] as [boolean, boolean];
      next[index] = !next[index];
      return next;
    });
  };

  const keepResult = () => {
    setPhase("done");
    gameSounds.click();
  };

  const total = dice[0] + dice[1] + 2;
  let coinsWon = 0;
  if (phase === "done") {
    if (total === 12) coinsWon = 15;
    else if (total >= 10) coinsWon = 7;
    else if (total >= 8) coinsWon = 3;
    else if (total >= 6) coinsWon = 1;
    else coinsWon = 0;
  }

  return (
    <GamePageLayout title="Dice Roll" emoji="🎲" gradientFrom="from-rose-500" gradientTo="to-pink-600">
      <div className="flex flex-col items-center">
        <p className="text-sm text-muted-foreground mb-2">Roll high to win! You get one reroll.</p>

        {/* Reward tiers */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {[
            { label: "12", coins: "15🪙", emoji: "🏆" },
            { label: "10-11", coins: "7🪙", emoji: "🔥" },
            { label: "8-9", coins: "3🪙", emoji: "⭐" },
            { label: "6-7", coins: "1🪙", emoji: "👍" },
          ].map((tier) => (
            <div key={tier.label} className="glass rounded-lg px-3 py-1.5 text-[10px] font-display">
              <span>{tier.emoji} </span>
              <span className="text-muted-foreground">{tier.label}=</span>
              <span className="text-[hsl(var(--neon-gold))]">{tier.coins}</span>
            </div>
          ))}
        </div>

        {/* Dice */}
        <div className="flex gap-8 mb-4">
          {[0, 1].map((i) => (
            <motion.button
              key={i}
              onClick={() => toggleHold(i)}
              animate={rolling ? {
                rotate: heldDice[i] && phase === "rolled" ? 0 : [0, 360, 720],
                y: heldDice[i] && phase === "rolled" ? 0 : [0, -20, 0],
              } : {}}
              transition={{ duration: 0.4, repeat: rolling ? Infinity : 0, delay: i * 0.1 }}
              className={`relative ${phase === "rolled" ? "cursor-pointer" : "cursor-default"}`}
              disabled={phase !== "rolled"}
            >
              {/* Hold indicator */}
              {heldDice[i] && phase === "rolled" && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-7 left-1/2 -translate-x-1/2 glass rounded-full px-2 py-0.5 text-[10px] font-display font-bold text-[hsl(var(--neon-gold))]"
                >
                  HOLD
                </motion.div>
              )}
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 opacity-20 blur-md" />
              <div className={`relative w-24 h-24 rounded-2xl bg-gradient-to-br from-secondary to-muted flex items-center justify-center text-6xl shadow-xl transition-all ${
                heldDice[i] && phase === "rolled"
                  ? "border-2 border-[hsl(var(--neon-gold))]/70 shadow-[0_0_15px_hsl(var(--neon-gold)/0.3)]"
                  : "border-2 border-border/50"
              }`}>
                {phase === "initial" ? "🎲" : DICE_FACES[dice[i]]}
              </div>
            </motion.button>
          ))}
        </div>

        {phase === "rolled" && (
          <p className="text-[10px] text-muted-foreground mb-4">
            Tap a die to hold it, then reroll — or keep your result
          </p>
        )}

        {phase === "initial" && (
          <Button variant="hero" size="lg" onClick={rollDice} disabled={rolling} className="w-48 mt-4">
            {rolling ? "Rolling..." : "🎲 Roll Dice!"}
          </Button>
        )}

        {phase === "rolled" && !rolling && (
          <div className="flex gap-3 w-full mt-2">
            <Button variant="hero" size="lg" onClick={rollDice} className="flex-1">
              🔄 Reroll
            </Button>
            <Button variant="neon" size="lg" onClick={keepResult} className="flex-1">
              ✅ Keep ({total})
            </Button>
          </div>
        )}

        {phase === "done" && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 10 }}
            className="text-center w-full mt-4"
          >
            <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-3">
              <span className="text-sm text-muted-foreground">Total:</span>
              <span className="font-display text-xl font-bold text-foreground">{total}</span>
            </div>
            <div className="text-5xl mb-3">{coinsWon > 0 ? (coinsWon >= 12 ? "🏆" : "🎉") : "😅"}</div>
            <p className="font-display text-2xl font-bold gradient-text mb-1">
              {coinsWon >= 25 ? "PERFECT ROLL!" : coinsWon > 0 ? "You Won!" : "Too Low!"}
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

export default DiceRoll;
