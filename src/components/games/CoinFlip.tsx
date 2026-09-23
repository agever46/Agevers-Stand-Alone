import { useState } from "react";
import { motion } from "framer-motion";
import GamePageLayout from "./GamePageLayout";
import { Button } from "@/components/ui/button";
import { gameSounds } from "@/lib/gameSounds";

interface Props {
  onComplete: (coins: number) => void;
  onClose: () => void;
}

const CoinFlip = ({ onComplete, onClose }: Props) => {
  const [choice, setChoice] = useState<"heads" | "tails" | null>(null);
  const [result, setResult] = useState<"heads" | "tails" | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [round, setRound] = useState(1);
  const [totalCoins, setTotalCoins] = useState(0);
  const [roundResult, setRoundResult] = useState<"won" | "lost" | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [streak, setStreak] = useState(0);

  const ROUND_REWARDS = [3, 7, 15, 25, 40];

  const flip = (pick: "heads" | "tails") => {
    if (flipping) return;
    setChoice(pick);
    setFlipping(true);
    setRoundResult(null);
    gameSounds.coinFlip();

    const res = Math.random() > 0.5 ? "heads" : "tails";

    setTimeout(() => {
      setResult(res);
      setFlipping(false);
      const won = pick === res;
      setRoundResult(won ? "won" : "lost");

      if (won) {
        gameSounds.win();
        const reward = ROUND_REWARDS[Math.min(round - 1, ROUND_REWARDS.length - 1)];
        setTotalCoins((c) => c + reward);
        setStreak((s) => s + 1);
      } else {
        gameSounds.lose();
        setTotalCoins(0);
        setStreak(0);
        setGameOver(true);
      }
    }, 2000);
  };

  const continueGame = () => {
    setRound((r) => r + 1);
    setChoice(null);
    setResult(null);
    setRoundResult(null);
  };

  const cashOut = () => {
    onComplete(totalCoins);
  };

  const currentReward = ROUND_REWARDS[Math.min(round - 1, ROUND_REWARDS.length - 1)];

  return (
    <GamePageLayout title="Coin Flip" emoji="🪙" gradientFrom="from-yellow-500" gradientTo="to-amber-600">
      <div className="flex flex-col items-center">
        {/* Round info */}
        <div className="flex items-center gap-3 mb-2">
          <div className="glass rounded-lg px-3 py-1.5">
            <span className="text-xs text-muted-foreground">Round </span>
            <span className="font-display text-sm font-bold text-foreground">{round}</span>
          </div>
          {streak >= 2 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="glass rounded-lg px-3 py-1.5 border border-[hsl(var(--neon-gold))]/50"
            >
              <span className="font-display text-sm font-bold text-[hsl(var(--neon-gold))]">🔥 x{streak} streak!</span>
            </motion.div>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-1">
          Win: <span className="text-[hsl(var(--neon-gold))] font-bold">+{currentReward}🪙</span> • Lose: <span className="text-destructive font-bold">lose all</span>
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Banked: <span className="text-foreground font-bold">{totalCoins}🪙</span>
        </p>

        {/* Coin */}
        <div className="relative mb-8" style={{ perspective: "600px" }}>
          <motion.div
            animate={flipping ? { opacity: [0.3, 0.8, 0.3] } : { opacity: 0.2 }}
            transition={{ duration: 0.5, repeat: flipping ? Infinity : 0 }}
            className="absolute -inset-4 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 blur-xl"
          />
          <motion.div
            animate={flipping ? { rotateY: [0, 1800], rotateX: [0, 360] } : {}}
            transition={{ duration: 2, ease: "easeOut" }}
            className="relative w-36 h-36 rounded-full bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 flex items-center justify-center shadow-2xl border-4 border-amber-200/50"
          >
            <div className="absolute inset-2 rounded-full border-2 border-amber-200/30" />
            <span className="text-4xl font-display font-black text-amber-900 drop-shadow-lg">
              {result ? (result === "heads" ? "👑" : "🌙") : "?"}
            </span>
          </motion.div>
        </div>

        {!roundResult && !flipping && !gameOver && (
          <div className="flex gap-4 w-full">
            <Button variant="hero" size="lg" onClick={() => flip("heads")} className="flex-1">
              👑 Heads
            </Button>
            <Button variant="neon" size="lg" onClick={() => flip("tails")} className="flex-1">
              🌙 Tails
            </Button>
          </div>
        )}

        {flipping && (
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="text-muted-foreground font-display text-lg"
          >
            Flipping...
          </motion.p>
        )}

        {roundResult === "won" && !gameOver && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 10 }}
            className="text-center w-full"
          >
            <p className="text-sm text-muted-foreground mb-1">
              You picked <strong className="text-foreground">{choice}</strong> — it was <strong className="text-foreground">{result}</strong>
            </p>
            <div className="text-4xl mb-2">✅</div>
            <p className="font-display text-xl font-bold text-[hsl(var(--neon-green))] mb-1">Correct!</p>
            <p className="text-sm text-muted-foreground mb-5">
              Total banked: <strong className="text-[hsl(var(--neon-gold))]">{totalCoins}🪙</strong>
            </p>
            <div className="flex gap-3 w-full">
              <Button variant="hero" size="lg" onClick={continueGame} className="flex-1">
                🎲 Double or Nothing
              </Button>
              <Button variant="neon" size="lg" onClick={cashOut} className="flex-1">
                💰 Cash Out
              </Button>
            </div>
          </motion.div>
        )}

        {gameOver && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 10 }}
            className="text-center w-full"
          >
            <p className="text-sm text-muted-foreground mb-1">
              You picked <strong className="text-foreground">{choice}</strong> — it was <strong className="text-foreground">{result}</strong>
            </p>
            <div className="text-5xl mb-3">💥</div>
            <p className="font-display text-2xl font-bold text-destructive mb-1">You Lost Everything!</p>
            <p className="text-sm text-muted-foreground mb-4">Should've cashed out...</p>
            <Button variant="hero" size="lg" onClick={() => onComplete(0)} className="w-full">
              Continue
            </Button>
          </motion.div>
        )}
      </div>
    </GamePageLayout>
  );
};

export default CoinFlip;
