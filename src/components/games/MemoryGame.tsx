import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import GamePageLayout from "./GamePageLayout";
import { Button } from "@/components/ui/button";
import { Timer, Zap } from "lucide-react";

const EMOJIS = ["🎮", "🕹️", "🎯", "🏆", "⭐", "💎", "🎲", "🃏", "🎪", "🔥"];

const DIFFICULTIES = [
  { id: "easy", label: "Easy", cols: 4, pairs: 4, time: 60, bonus: 1 },
  { id: "medium", label: "Medium", cols: 4, pairs: 6, time: 45, bonus: 1.5 },
  { id: "hard", label: "Hard", cols: 5, pairs: 8, time: 35, bonus: 2.5 },
];

interface Props {
  onComplete: (coins: number) => void;
  onClose: () => void;
}

const MemoryGame = ({ onComplete, onClose }: Props) => {
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[0] | null>(null);
  const [cards, setCards] = useState<{ id: number; emoji: string; flipped: boolean; matched: boolean }[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [done, setDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const startGame = (diff: typeof DIFFICULTIES[0]) => {
    setDifficulty(diff);
    const picked = [...EMOJIS].sort(() => Math.random() - 0.5).slice(0, diff.pairs);
    const deck = [...picked, ...picked]
      .sort(() => Math.random() - 0.5)
      .map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
    setCards(deck);
    setTimeLeft(diff.time);
    setGameStarted(true);
  };

  useEffect(() => {
    if (!gameStarted || done || timedOut) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setTimedOut(true);
          clearInterval(interval);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStarted, done, timedOut]);

  const handleFlip = (id: number) => {
    if (selected.length >= 2 || cards[id].flipped || cards[id].matched || done || timedOut) return;

    const newCards = [...cards];
    newCards[id].flipped = true;
    setCards(newCards);

    const newSel = [...selected, id];
    setSelected(newSel);

    if (newSel.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = newSel;
      if (newCards[a].emoji === newCards[b].emoji) {
        newCards[a].matched = true;
        newCards[b].matched = true;
        setCards([...newCards]);
        setSelected([]);
        const newCombo = combo + 1;
        setCombo(newCombo);
        setMaxCombo((m) => Math.max(m, newCombo));
        if (newCards.every((c) => c.matched)) setDone(true);
      } else {
        setCombo(0);
        setTimeout(() => {
          newCards[a].flipped = false;
          newCards[b].flipped = false;
          setCards([...newCards]);
          setSelected([]);
        }, 700);
      }
    }
  };

  const calcCoins = () => {
    if (!difficulty) return 0;
    const baseCoins = Math.max(5, 25 - moves);
    const comboBonus = maxCombo >= 3 ? maxCombo * 2 : 0;
    const timeBonus = timeLeft > 0 ? Math.floor(timeLeft / 5) : 0;
    return Math.round((baseCoins + comboBonus + timeBonus) * difficulty.bonus);
  };

  // Difficulty select screen
  if (!difficulty) {
    return (
      <GamePageLayout title="Memory Match" emoji="🧠" gradientFrom="from-purple-500" gradientTo="to-indigo-600">
        <div className="text-center">
          <p className="text-muted-foreground mb-8">Choose your difficulty level</p>
          <div className="flex flex-col gap-4">
            {DIFFICULTIES.map((diff) => (
              <motion.button
                key={diff.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => startGame(diff)}
                className="glass rounded-xl p-5 text-left hover:border-primary/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">{diff.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {diff.pairs} pairs • {diff.time}s timer • {diff.bonus}x multiplier
                    </p>
                  </div>
                  <div className={`text-2xl ${diff.id === 'easy' ? '' : diff.id === 'medium' ? '' : ''}`}>
                    {diff.id === 'easy' ? '😊' : diff.id === 'medium' ? '🔥' : '💀'}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </GamePageLayout>
    );
  }

  const coinsEarned = done ? calcCoins() : 0;

  return (
    <GamePageLayout title="Memory Match" emoji="🧠" gradientFrom="from-purple-500" gradientTo="to-indigo-600">
      {/* Stats bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="glass rounded-lg px-3 py-1.5 flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5 text-destructive" />
            <span className={`font-display text-sm font-bold ${timeLeft <= 10 ? 'text-destructive animate-pulse' : 'text-foreground'}`}>
              {timeLeft}s
            </span>
          </div>
          <div className="glass rounded-lg px-3 py-1.5">
            <span className="text-xs text-muted-foreground">Moves: </span>
            <span className="font-display text-sm font-bold text-foreground">{moves}</span>
          </div>
        </div>
        {combo >= 2 && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass rounded-lg px-3 py-1.5 flex items-center gap-1.5 border-[hsl(var(--neon-gold))]/50 border"
          >
            <Zap className="h-3.5 w-3.5 text-[hsl(var(--neon-gold))]" />
            <span className="font-display text-sm font-bold text-[hsl(var(--neon-gold))]">
              x{combo} Combo!
            </span>
          </motion.div>
        )}
      </div>

      <div className={`grid gap-2.5 mb-5 ${difficulty.cols === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
        {cards.map((card) => (
          <motion.button
            key={card.id}
            onClick={() => handleFlip(card.id)}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            className={`aspect-square rounded-xl text-2xl md:text-3xl flex items-center justify-center font-bold transition-all duration-300 shadow-lg ${
              card.flipped || card.matched
                ? "bg-primary/20 border-2 border-primary/50 shadow-[0_0_15px_hsl(var(--primary)/0.3)]"
                : "bg-secondary hover:bg-secondary/80 border-2 border-border/30 hover:border-primary/30"
            } ${card.matched ? "opacity-50 scale-90" : ""}`}
          >
            <motion.span
              initial={false}
              animate={{ rotateY: card.flipped || card.matched ? 0 : 180 }}
              transition={{ duration: 0.3 }}
            >
              {(card.flipped || card.matched) ? card.emoji : "?"}
            </motion.span>
          </motion.button>
        ))}
      </div>

      {(done || timedOut) && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 10 }}
          className="text-center"
        >
          <div className="text-5xl mb-3">{done ? "🎉" : "⏰"}</div>
          <p className="font-display text-2xl font-bold gradient-text mb-1">
            {done ? "You Won!" : "Time's Up!"}
          </p>
          {done && maxCombo >= 3 && (
            <p className="text-sm text-muted-foreground mb-1">🔥 Best combo: x{maxCombo}</p>
          )}
          <p className="font-display text-lg text-[hsl(var(--neon-gold))] mb-4">
            {done ? `${coinsEarned} coins earned` : "0 coins"}
          </p>
          <Button variant="hero" size="lg" onClick={() => onComplete(done ? coinsEarned : 0)} className="w-full">
            {done ? "Collect Coins" : "Continue"}
          </Button>
        </motion.div>
      )}
    </GamePageLayout>
  );
};

export default MemoryGame;
