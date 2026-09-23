import { useState, useRef } from "react";
import { motion } from "framer-motion";
import GamePageLayout from "./GamePageLayout";
import { Button } from "@/components/ui/button";

const REWARDS = [0, 1, 2, 3, 5, 8, 10, 15, 0, 0, 2, 3];

interface Props {
  onComplete: (coins: number) => void;
  onClose: () => void;
}

const ScratchCard = ({ onComplete, onClose }: Props) => {
  const [reward] = useState(() => REWARDS[Math.floor(Math.random() * REWARDS.length)]);
  const [revealed, setRevealed] = useState(false);
  const [scratchCount, setScratchCount] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleScratch = () => {
    setScratchCount((c) => {
      const newCount = c + 1;
      if (newCount >= 8) setRevealed(true);
      return newCount;
    });
  };

  const progress = Math.min(100, (scratchCount / 8) * 100);

  return (
    <GamePageLayout title="Scratch Card" emoji="🎫" gradientFrom="from-emerald-500" gradientTo="to-teal-600">
      <div className="flex flex-col items-center">
        <p className="text-sm text-muted-foreground mb-6">Tap the card repeatedly to scratch it!</p>

        {/* Scratch card */}
        <div
          ref={cardRef}
          onClick={handleScratch}
          className="relative w-64 h-64 rounded-2xl overflow-hidden cursor-pointer select-none mb-6 shadow-2xl"
        >
          {/* Prize underneath */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-orange-500/20 border border-[hsl(var(--neon-gold))]/30 rounded-2xl">
            <motion.span
              animate={revealed ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.5 }}
              className="text-6xl mb-3"
            >
              {reward > 0 ? "🪙" : "😅"}
            </motion.span>
            <p className="font-display text-3xl font-bold text-foreground">
              {reward > 0 ? `${reward} Coins` : "Try Again"}
            </p>
          </div>

          {/* Scratch overlay */}
          {!revealed && (
            <motion.div
              animate={{ opacity: Math.max(0, 1 - scratchCount * 0.13) }}
              className="absolute inset-0 bg-gradient-to-br from-secondary via-muted to-secondary flex items-center justify-center rounded-2xl border-2 border-border/50"
            >
              <div className="text-center">
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-5xl block mb-3"
                >
                  ✨
                </motion.span>
                <p className="font-display text-lg font-bold text-foreground">SCRATCH ME!</p>
                <p className="text-xs text-muted-foreground mt-1">{Math.max(0, 8 - scratchCount)} taps left</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Progress bar */}
        {!revealed && (
          <div className="w-64 h-2 bg-secondary rounded-full mb-6 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-[hsl(var(--neon-green))] rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        {revealed && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 10 }}
            className="text-center w-full"
          >
            <Button variant="hero" size="lg" onClick={() => onComplete(reward)} className="w-full">
              {reward > 0 ? "Collect Coins" : "Continue"}
            </Button>
          </motion.div>
        )}
      </div>
    </GamePageLayout>
  );
};

export default ScratchCard;
