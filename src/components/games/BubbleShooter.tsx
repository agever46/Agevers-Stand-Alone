import { useEffect, useRef, useState, useCallback } from "react";
import GamePageLayout from "./GamePageLayout";
import { Button } from "@/components/ui/button";
import { gameSounds } from "@/lib/gameSounds";

interface Props {
  onComplete: (coins: number) => void;
  onClose: () => void;
}

const COLS = 7;
const ROWS = 8;
const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"];
const GAME_TIME = 90;

type Cell = { color: string; id: number };
let nextId = 1;

function randColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function makeBoard(): Cell[][] {
  // Generate board with no initial matches
  const b: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c++) {
      let color: string;
      do {
        color = randColor();
      } while (
        (c >= 2 && row[c - 1].color === color && row[c - 2].color === color) ||
        (r >= 2 && b[r - 1][c].color === color && b[r - 2][c].color === color)
      );
      row.push({ color, id: nextId++ });
    }
    b.push(row);
  }
  return b;
}

function findMatches(board: Cell[][]): Set<string> {
  const matched = new Set<string>();
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    let runStart = 0;
    for (let c = 1; c <= COLS; c++) {
      if (c === COLS || board[r][c].color !== board[r][runStart].color) {
        if (c - runStart >= 3) {
          for (let k = runStart; k < c; k++) matched.add(`${r},${k}`);
        }
        runStart = c;
      }
    }
  }
  // Vertical
  for (let c = 0; c < COLS; c++) {
    let runStart = 0;
    for (let r = 1; r <= ROWS; r++) {
      if (r === ROWS || board[r][c].color !== board[runStart][c].color) {
        if (r - runStart >= 3) {
          for (let k = runStart; k < r; k++) matched.add(`${k},${c}`);
        }
        runStart = r;
      }
    }
  }
  return matched;
}

const BubbleShooter = ({ onComplete, onClose }: Props) => {
  const [board, setBoard] = useState<Cell[][]>(() => makeBoard());
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [gameOver, setGameOver] = useState(false);
  const gameOverRef = useRef(false);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ r: number; c: number; x: number; y: number } | null>(null);

  const endGame = useCallback(() => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    setGameOver(true);
    gameSounds.win();
    const coins = Math.max(1, Math.floor(scoreRef.current / 9));
    setTimeout(() => onComplete(coins), 2000);
  }, [onComplete]);

  useEffect(() => {
    if (gameOver) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { endGame(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [gameOver, endGame]);

  // Cascade resolver: pop matches, gravity, refill, repeat
  const resolveCascades = useCallback(async (initial: Cell[][]) => {
    let current = initial.map((row) => row.map((c) => ({ ...c })));
    let cascadeLevel = 0;
    while (true) {
      const matches = findMatches(current);
      if (matches.size === 0) break;
      cascadeLevel++;
      gameSounds.bubblePop();
      // Mark as null
      matches.forEach((k) => {
        const [r, c] = k.split(",").map(Number);
        (current[r] as any)[c] = null;
      });
      scoreRef.current += matches.size * cascadeLevel;
      setScore(scoreRef.current);
      setBoard(current.map((row) => row.map((c) => c || { color: "transparent", id: -1 })));
      await new Promise((res) => setTimeout(res, 220));
      // Gravity
      for (let c = 0; c < COLS; c++) {
        const stack: Cell[] = [];
        for (let r = ROWS - 1; r >= 0; r--) {
          if (current[r][c]) stack.push(current[r][c]);
        }
        for (let r = ROWS - 1; r >= 0; r--) {
          current[r][c] = stack.shift() || { color: randColor(), id: nextId++ };
        }
      }
      setBoard(current.map((row) => row.map((c) => ({ ...c }))));
      await new Promise((res) => setTimeout(res, 200));
    }
    return current;
  }, []);

  const trySwap = useCallback(async (a: { r: number; c: number }, b: { r: number; c: number }) => {
    if (busyRef.current || gameOverRef.current) return;
    const dr = Math.abs(a.r - b.r);
    const dc = Math.abs(a.c - b.c);
    if (dr + dc !== 1) return;
    busyRef.current = true;
    setBusy(true);
    setSelected(null);

    const next = board.map((row) => row.map((cell) => ({ ...cell })));
    [next[a.r][a.c], next[b.r][b.c]] = [next[b.r][b.c], next[a.r][a.c]];
    setBoard(next);
    gameSounds.bubbleSwap();
    await new Promise((res) => setTimeout(res, 180));

    const matches = findMatches(next);
    if (matches.size === 0) {
      // swap back
      gameSounds.bubbleInvalid();
      [next[a.r][a.c], next[b.r][b.c]] = [next[b.r][b.c], next[a.r][a.c]];
      setBoard(next.map((row) => row.map((cell) => ({ ...cell }))));
      await new Promise((res) => setTimeout(res, 180));
    } else {
      await resolveCascades(next);
    }
    busyRef.current = false;
    setBusy(false);
  }, [board, resolveCascades]);

  const handleCellClick = (r: number, c: number) => {
    if (busy || gameOver) return;
    if (!selected) {
      setSelected({ r, c });
      gameSounds.click();
      return;
    }
    if (selected.r === r && selected.c === c) {
      setSelected(null);
      return;
    }
    trySwap(selected, { r, c });
  };

  const handlePointerDown = (e: React.PointerEvent, r: number, c: number) => {
    if (busy || gameOver) return;
    dragStart.current = { r, c, x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < 12 && absY < 12) {
      // treat as tap
      handleCellClick(start.r, start.c);
      return;
    }
    let target = { r: start.r, c: start.c };
    if (absX > absY) {
      target.c += dx > 0 ? 1 : -1;
    } else {
      target.r += dy > 0 ? 1 : -1;
    }
    if (target.r < 0 || target.r >= ROWS || target.c < 0 || target.c >= COLS) return;
    trySwap({ r: start.r, c: start.c }, target);
  };

  return (
    <GamePageLayout title="Bubble Match" emoji="🫧" gradientFrom="from-pink-500" gradientTo="to-purple-600">
      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full justify-between text-sm font-bold text-foreground">
          <span>⭐ {score}</span>
          <span className={timeLeft <= 10 ? "text-destructive animate-pulse" : ""}>⏱ {timeLeft}s</span>
        </div>
        <div
          ref={containerRef}
          className="grid gap-1 p-3 rounded-2xl bg-gradient-to-b from-indigo-950/60 to-slate-950/60 border border-border/40 select-none touch-none"
          style={{
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            width: "100%",
            maxWidth: 360,
          }}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => { dragStart.current = null; }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isSelected = selected?.r === r && selected?.c === c;
              return (
                <div
                  key={`${r}-${c}-${cell.id}`}
                  onPointerDown={(e) => handlePointerDown(e, r, c)}
                  className={`aspect-square rounded-full flex items-center justify-center cursor-pointer transition-transform duration-150 ${
                    isSelected ? "scale-110 ring-2 ring-white" : "hover:scale-105"
                  }`}
                  style={{
                    background:
                      cell.color === "transparent"
                        ? "transparent"
                        : `radial-gradient(circle at 30% 30%, #ffffff, ${cell.color} 35%, ${shade(cell.color, -40)})`,
                    boxShadow:
                      cell.color === "transparent"
                        ? "none"
                        : `inset 0 -3px 6px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.4)`,
                  }}
                >
                  {cell.color !== "transparent" && (
                    <span
                      className="block w-1/3 h-1/4 rounded-full opacity-60"
                      style={{ background: "rgba(255,255,255,0.7)", transform: "translate(-25%, -25%)" }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-[320px]">
          Drag a bubble onto an adjacent one (or tap two in a row) to swap. Make rows or columns of 3+ same color to pop them!
        </p>
        {gameOver && (
          <div className="text-center">
            <p className="font-display text-xl font-bold text-primary">⏱ Time's Up!</p>
            <p className="text-sm text-muted-foreground">Score: {score}</p>
            <Button onClick={onClose} variant="outline" className="mt-2">Back</Button>
          </div>
        )}
      </div>
    </GamePageLayout>
  );
};

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export default BubbleShooter;