import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import GamePageLayout from "./GamePageLayout";
import { Button } from "@/components/ui/button";

interface Props {
  onComplete: (coins: number) => void;
  onClose: () => void;
}

type Card = { suit: string; value: string; numValue: number };

const SUITS = ["♠", "♥", "♦", "♣"];
const VALUES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let i = 0; i < VALUES.length; i++) {
      deck.push({
        suit,
        value: VALUES[i],
        numValue: i === 0 ? 11 : Math.min(i + 1, 10),
      });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
};

const calcHand = (cards: Card[]): number => {
  let total = cards.reduce((s, c) => s + c.numValue, 0);
  let aces = cards.filter((c) => c.value === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
};

const CardDisplay = ({ card, hidden = false, delay = 0 }: { card: Card; hidden?: boolean; delay?: number }) => {
  const isRed = card.suit === "♥" || card.suit === "♦";
  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay }}
      className={`w-16 h-24 md:w-20 md:h-28 rounded-xl flex flex-col items-center justify-center shadow-xl border-2 ${
        hidden
          ? "bg-gradient-to-br from-primary/30 to-accent/30 border-primary/40"
          : "bg-gradient-to-br from-card to-card border-border/50"
      }`}
    >
      {hidden ? (
        <span className="text-2xl">🃏</span>
      ) : (
        <>
          <span className={`font-display text-lg md:text-xl font-black ${isRed ? "text-destructive" : "text-foreground"}`}>
            {card.value}
          </span>
          <span className={`text-lg ${isRed ? "text-destructive" : "text-foreground"}`}>{card.suit}</span>
        </>
      )}
    </motion.div>
  );
};

const Blackjack = ({ onComplete, onClose }: Props) => {
  const [deck, setDeck] = useState<Card[]>(() => createDeck());
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [phase, setPhase] = useState<"bet" | "playing" | "dealer" | "done">("bet");
  const [bet, setBet] = useState(0);
  const [result, setResult] = useState<"win" | "lose" | "push" | "blackjack" | null>(null);
  const [dealerRevealed, setDealerRevealed] = useState(false);

  const deal = (betAmount: number) => {
    const newDeck = [...deck];
    const pCards = [newDeck.pop()!, newDeck.pop()!];
    const dCards = [newDeck.pop()!, newDeck.pop()!];
    setDeck(newDeck);
    setPlayerHand(pCards);
    setDealerHand(dCards);
    setBet(betAmount);

    // Check for natural blackjack
    if (calcHand(pCards) === 21) {
      setDealerRevealed(true);
      setPhase("done");
      if (calcHand(dCards) === 21) {
        setResult("push");
      } else {
        setResult("blackjack");
      }
    } else {
      setPhase("playing");
    }
  };

  const hit = () => {
    const newDeck = [...deck];
    const card = newDeck.pop()!;
    const newHand = [...playerHand, card];
    setDeck(newDeck);
    setPlayerHand(newHand);

    if (calcHand(newHand) > 21) {
      setDealerRevealed(true);
      setPhase("done");
      setResult("lose");
    }
  };

  const stand = () => {
    setDealerRevealed(true);
    setPhase("dealer");

    // Dealer draws
    let newDeck = [...deck];
    let dHand = [...dealerHand];
    while (calcHand(dHand) < 17) {
      dHand.push(newDeck.pop()!);
    }
    setDeck(newDeck);
    setDealerHand(dHand);

    const pTotal = calcHand(playerHand);
    const dTotal = calcHand(dHand);

    setTimeout(() => {
      setPhase("done");
      if (dTotal > 21) setResult("win");
      else if (pTotal > dTotal) setResult("win");
      else if (pTotal < dTotal) setResult("lose");
      else setResult("push");
    }, 800);
  };

  const playerTotal = calcHand(playerHand);
  const dealerTotal = calcHand(dealerHand);

  const getCoins = () => {
    if (result === "blackjack") return Math.round(bet * 2.5);
    if (result === "win") return bet * 2;
    if (result === "push") return bet;
    return 0;
  };

  // Bet selection screen
  if (phase === "bet") {
    return (
      <GamePageLayout title="Blackjack" emoji="🃏" gradientFrom="from-emerald-600" gradientTo="to-green-800">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Get closer to 21 than the dealer without going over!</p>
          <p className="text-xs text-muted-foreground mb-8">
            Win = 2× bet • Blackjack = 2.5× bet • Push = bet back
          </p>
          <p className="font-display text-sm text-muted-foreground mb-4">Choose your bet</p>
          <div className="grid grid-cols-3 gap-3">
            {[5, 10, 15].map((amount) => (
              <motion.button
                key={amount}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => deal(amount)}
                className="glass rounded-xl p-4 hover:border-primary/50 transition-all group text-center"
              >
                <div className="text-2xl mb-1">🪙</div>
                <p className="font-display text-xl font-bold text-[hsl(var(--neon-gold))]">{amount}</p>
                <p className="text-[10px] text-muted-foreground">coins</p>
              </motion.button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-4">Note: coins are deducted from winnings, not your balance</p>
        </div>
      </GamePageLayout>
    );
  }

  return (
    <GamePageLayout title="Blackjack" emoji="🃏" gradientFrom="from-emerald-600" gradientTo="to-green-800">
      <div className="flex flex-col items-center">
        {/* Bet display */}
        <div className="glass rounded-lg px-3 py-1 mb-6">
          <span className="text-xs text-muted-foreground">Bet: </span>
          <span className="font-display text-sm font-bold text-[hsl(var(--neon-gold))]">{bet}🪙</span>
        </div>

        {/* Dealer hand */}
        <div className="mb-6 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Dealer {dealerRevealed ? `(${dealerTotal})` : ""}
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            {dealerHand.map((card, i) => (
              <CardDisplay
                key={i}
                card={card}
                hidden={i === 1 && !dealerRevealed}
                delay={i * 0.15}
              />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-border/30 mb-6" />

        {/* Player hand */}
        <div className="mb-6 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            You ({playerTotal})
            {playerTotal === 21 && playerHand.length === 2 && (
              <span className="text-[hsl(var(--neon-gold))] font-bold ml-1">BLACKJACK!</span>
            )}
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            {playerHand.map((card, i) => (
              <CardDisplay key={i} card={card} delay={i * 0.15} />
            ))}
          </div>
        </div>

        {/* Actions */}
        {phase === "playing" && (
          <div className="flex gap-3 w-full">
            <Button variant="hero" size="lg" onClick={hit} className="flex-1">
              🃏 Hit
            </Button>
            <Button variant="neon" size="lg" onClick={stand} className="flex-1">
              ✋ Stand
            </Button>
          </div>
        )}

        {phase === "dealer" && (
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="text-muted-foreground font-display"
          >
            Dealer drawing...
          </motion.p>
        )}

        {phase === "done" && result && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 10 }}
            className="text-center w-full"
          >
            <div className="text-5xl mb-3">
              {result === "blackjack" ? "🏆" : result === "win" ? "🎉" : result === "push" ? "🤝" : "💥"}
            </div>
            <p className="font-display text-2xl font-bold gradient-text mb-1">
              {result === "blackjack" ? "BLACKJACK!" : result === "win" ? "You Won!" : result === "push" ? "Push!" : "Bust!"}
            </p>
            {getCoins() > 0 && (
              <p className="font-display text-lg text-[hsl(var(--neon-gold))] mb-4">{getCoins()} coins earned</p>
            )}
            <Button variant="hero" size="lg" onClick={() => onComplete(getCoins())} className="w-full mt-2">
              {getCoins() > 0 ? "Collect Coins" : "Continue"}
            </Button>
          </motion.div>
        )}
      </div>
    </GamePageLayout>
  );
};

export default Blackjack;
