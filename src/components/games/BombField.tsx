import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Bomb, Timer, Coins, Trophy } from "lucide-react";
import { gameSounds } from "@/lib/gameSounds";

interface Props {
  onComplete: (coinsWon: number) => void;
  onClose: () => void;
}

const GRID_SIZE = 6;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const BOMB_COUNT = 15;
const TIME_LIMIT = 45;
const COIN_PER_SAFE = 1;
const COIN_PER_BOMB = -4;

type CellState = "hidden" | "revealed" | "bomb";

function generateBoard(): boolean[] {
  const board = Array(TOTAL_CELLS).fill(false);
  const indices = Array.from({ length: TOTAL_CELLS }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  for (let i = 0; i < BOMB_COUNT; i++) {
    board[indices[i]] = true;
  }
  return board;
}

function calcBonus(elapsedSeconds: number): number {
  if (elapsedSeconds <= 10) return 50;
  if (elapsedSeconds >= 55) return 10;
  return Math.round(50 - ((elapsedSeconds - 10) / 45) * 40);
}

const BombField = ({ onComplete, onClose }: Props) => {
  const [bombs] = useState(() => generateBoard());
  const [cells, setCells] = useState<CellState[]>(Array(TOTAL_CELLS).fill("hidden"));
  const [coins, setCoins] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [started, setStarted] = useState(false);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const safeCount = TOTAL_CELLS - BOMB_COUNT;
  const revealedSafe = cells.filter((c) => c === "revealed").length;

  const endGame = useCallback((isWin: boolean, currentCoins: number) => {
    setGameOver(true);
    if (timerRef.current) clearInterval(timerRef.current);

    if (isWin) {
      setWon(true);
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const bonus = calcBonus(elapsed);
      const total = currentCoins + bonus;
      setCoins(total);
      gameSounds.win();
      setTimeout(() => onComplete(Math.max(0, total)), 2500);
    } else {
      gameSounds.lose();
      setTimeout(() => onComplete(currentCoins), 2500);
    }
  }, [onComplete]);

  useEffect(() => {
    if (!started || gameOver) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          endGame(false, coins);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started, gameOver, endGame, coins]);

  const handleClick = (idx: number) => {
    if (gameOver || cells[idx] !== "hidden") return;

    if (!started) {
      setStarted(true);
      startTimeRef.current = Date.now();
    }

    const newCells = [...cells];
    if (bombs[idx]) {
      newCells[idx] = "bomb";
      gameSounds.mineExplode();
      const newCoins = coins + COIN_PER_BOMB;
      setCoins(newCoins);
      setCells(newCells);
      if (newCoins <= -10) {
        endGame(false, newCoins);
      }
    } else {
      newCells[idx] = "revealed";
      gameSounds.mineReveal();
      const newCoins = coins + COIN_PER_SAFE;
      setCoins(newCoins);
      setCells(newCells);
      const newRevealed = newCells.filter((c) => c === "revealed").length;
      if (newRevealed >= safeCount) {
        endGame(true, newCoins);
      }
    }
  };

  const revealAll = () => {
    setCells(bombs.map((b, i) => (cells[i] !== "hidden" ? cells[i] : b ? "bomb" : "revealed")));
  };

  useEffect(() => {
    if (gameOver) revealAll();
  }, [gameOver]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6 relative border border-border">
        <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-bold text-center mb-1 text-foreground flex items-center justify-center gap-2">
          <Bomb className="w-5 h-5 text-destructive" /> Bomb Field
        </h2>
        <p className="text-xs text-muted-foreground text-center mb-4">
          Tap squares to find safe spots. Avoid bombs!
        </p>

        {/* Stats bar */}
        <div className="flex justify-between items-center mb-4 text-sm font-medium">
          <span className="flex items-center gap-1 text-yellow-500">
            <Coins className="w-4 h-4" /> {coins}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            {revealedSafe}/{safeCount} safe
          </span>
          <span className={`flex items-center gap-1 ${timeLeft <= 10 ? "text-destructive animate-pulse" : "text-muted-foreground"}`}>
            <Timer className="w-4 h-4" /> {timeLeft}s
          </span>
        </div>

        {/* Grid */}
        <div
          className="grid gap-1.5 mx-auto mb-4"
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, maxWidth: 320 }}
        >
          {cells.map((state, idx) => (
            <button
              key={idx}
              disabled={gameOver || state !== "hidden"}
              onClick={() => handleClick(idx)}
              className={`aspect-square rounded-lg text-lg font-bold transition-all duration-200 border ${
                state === "hidden"
                  ? "bg-secondary border-border hover:bg-accent hover:scale-105 cursor-pointer"
                  : state === "revealed"
                  ? "bg-primary/20 border-primary/40 text-primary scale-95"
                  : "bg-destructive/20 border-destructive/40 text-destructive scale-95"
              }`}
            >
              {state === "revealed" && "✓"}
              {state === "bomb" && "💣"}
            </button>
          ))}
        </div>

        {/* Game over overlay */}
        {gameOver && (
          <div className="text-center space-y-2">
            {won ? (
              <>
                <div className="flex items-center justify-center gap-2 text-primary text-lg font-bold">
                  <Trophy className="w-5 h-5" /> Board Cleared!
                </div>
                <p className="text-sm text-muted-foreground">
                  Speed bonus: +{calcBonus(Math.floor((Date.now() - startTimeRef.current) / 1000))} coins
                </p>
                <p className="text-yellow-500 font-bold text-lg">{coins} coins won! 🎉</p>
              </>
            ) : (
              <>
                <p className="text-destructive font-bold text-lg">Game Over!</p>
                <p className="text-muted-foreground text-sm">You lost {Math.abs(coins)} coins</p>
              </>
            )}
          </div>
        )}

        {!started && !gameOver && (
          <p className="text-center text-xs text-muted-foreground animate-pulse">
            Tap any square to start the timer!
          </p>
        )}
      </div>
    </div>
  );
};

export default BombField;
