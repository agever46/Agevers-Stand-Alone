import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import GamePageLayout from "./GamePageLayout";
import { Button } from "@/components/ui/button";
import { Flag, Bomb } from "lucide-react";
import { gameSounds } from "@/lib/gameSounds";

const DIFFICULTIES = [
  { id: "easy", label: "Easy", rows: 6, cols: 6, mines: 5, bonus: 1 },
  { id: "medium", label: "Medium", rows: 8, cols: 8, mines: 12, bonus: 2 },
  { id: "hard", label: "Hard", rows: 8, cols: 10, mines: 18, bonus: 3.5 },
];

type Cell = {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  adjacent: number;
};

interface Props {
  onComplete: (coins: number) => void;
  onClose: () => void;
}

const createBoard = (rows: number, cols: number, mines: number, firstR: number, firstC: number): Cell[][] => {
  const board: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    }))
  );

  // Place mines (not on first click or adjacent)
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (board[r][c].mine) continue;
    if (Math.abs(r - firstR) <= 1 && Math.abs(c - firstC) <= 1) continue;
    board[r][c].mine = true;
    placed++;
  }

  // Calculate adjacents
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) count++;
        }
      }
      board[r][c].adjacent = count;
    }
  }

  return board;
};

const ADJACENT_COLORS = [
  "",
  "text-blue-400",
  "text-green-400",
  "text-red-400",
  "text-purple-400",
  "text-orange-400",
  "text-cyan-400",
  "text-pink-400",
  "text-foreground",
];

const Minesweeper = ({ onComplete, onClose }: Props) => {
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[0] | null>(null);
  const [board, setBoard] = useState<Cell[][] | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [firstClick, setFirstClick] = useState(true);
  const [flagMode, setFlagMode] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);

  const reveal = useCallback((b: Cell[][], r: number, c: number, diff: typeof DIFFICULTIES[0]): number => {
    if (r < 0 || r >= diff.rows || c < 0 || c >= diff.cols) return 0;
    if (b[r][c].revealed || b[r][c].flagged) return 0;

    b[r][c].revealed = true;
    let count = 1;

    if (b[r][c].adjacent === 0 && !b[r][c].mine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          count += reveal(b, r + dr, c + dc, diff);
        }
      }
    }

    return count;
  }, []);

  const handleClick = (r: number, c: number) => {
    if (gameOver || won || !difficulty) return;

    let currentBoard = board;

    if (firstClick) {
      currentBoard = createBoard(difficulty.rows, difficulty.cols, difficulty.mines, r, c);
      setFirstClick(false);
    }

    if (!currentBoard) return;

    const newBoard = currentBoard.map((row) => row.map((cell) => ({ ...cell })));

    if (flagMode) {
      if (newBoard[r][c].revealed) return;
      newBoard[r][c].flagged = !newBoard[r][c].flagged;
      gameSounds.mineFlag();
      setBoard(newBoard);
      return;
    }

    if (newBoard[r][c].flagged || newBoard[r][c].revealed) return;

    if (newBoard[r][c].mine) {
      gameSounds.mineExplode();
      // Reveal all mines
      newBoard.forEach((row) => row.forEach((cell) => {
        if (cell.mine) cell.revealed = true;
      }));
      setBoard(newBoard);
      setGameOver(true);
      return;
    }
    gameSounds.mineReveal();

    const newRevealed = reveal(newBoard, r, c, difficulty);
    const totalRevealed = revealedCount + newRevealed;
    setRevealedCount(totalRevealed);
    setBoard(newBoard);

    // Check win
    const totalSafe = difficulty.rows * difficulty.cols - difficulty.mines;
    if (totalRevealed >= totalSafe) {
      setWon(true);
      gameSounds.win();
    }
  };

  const getCoins = () => {
    if (!won || !difficulty) return 0;
    return Math.round(10 * difficulty.bonus);
  };

  // Difficulty select
  if (!difficulty) {
    return (
      <GamePageLayout title="Minesweeper" emoji="💣" gradientFrom="from-slate-600" gradientTo="to-zinc-800">
        <div className="text-center">
          <p className="text-muted-foreground mb-8">Clear the board without hitting mines!</p>
          <div className="flex flex-col gap-4">
            {DIFFICULTIES.map((diff) => (
              <motion.button
                key={diff.id}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setDifficulty(diff);
                  // Don't create board yet — wait for first click
                  setBoard(
                    Array.from({ length: diff.rows }, () =>
                      Array.from({ length: diff.cols }, () => ({
                        mine: false,
                        revealed: false,
                        flagged: false,
                        adjacent: 0,
                      }))
                    )
                  );
                }}
                className="glass rounded-xl p-5 text-left hover:border-primary/50 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-foreground">{diff.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {diff.rows}×{diff.cols} • {diff.mines} mines • {diff.bonus}x reward
                    </p>
                  </div>
                  <div className="text-2xl">
                    {diff.id === "easy" ? "😊" : diff.id === "medium" ? "🔥" : "💀"}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </GamePageLayout>
    );
  }

  const flagCount = board ? board.flat().filter((c) => c.flagged).length : 0;

  return (
    <GamePageLayout title="Minesweeper" emoji="💣" gradientFrom="from-slate-600" gradientTo="to-zinc-800">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="glass rounded-lg px-3 py-1.5 flex items-center gap-1.5">
            <Bomb className="h-3.5 w-3.5 text-destructive" />
            <span className="font-display text-sm font-bold text-foreground">
              {difficulty.mines - flagCount}
            </span>
          </div>
        </div>
        <Button
          variant={flagMode ? "hero" : "outline"}
          size="sm"
          onClick={() => setFlagMode(!flagMode)}
          className="h-8"
        >
          <Flag className="h-3.5 w-3.5 mr-1" />
          {flagMode ? "Flag ON" : "Flag OFF"}
        </Button>
      </div>

      {/* Board */}
      <div className="overflow-x-auto pb-2">
        <div
          className="grid gap-0.5 mx-auto"
          style={{
            gridTemplateColumns: `repeat(${difficulty.cols}, minmax(0, 1fr))`,
            maxWidth: `${difficulty.cols * 36}px`,
          }}
        >
          {board && board.map((row, r) =>
            row.map((cell, c) => (
              <motion.button
                key={`${r}-${c}`}
                onClick={() => handleClick(r, c)}
                whileTap={!cell.revealed && !gameOver ? { scale: 0.85 } : {}}
                className={`aspect-square rounded-sm text-xs md:text-sm font-display font-bold flex items-center justify-center transition-all ${
                  cell.revealed
                    ? cell.mine
                      ? "bg-destructive/30 border border-destructive/50"
                      : "bg-muted/50 border border-border/20"
                    : "bg-secondary hover:bg-secondary/80 border border-border/30 hover:border-primary/30"
                } ${!cell.revealed && flagMode ? "hover:border-[hsl(var(--neon-gold))]/50" : ""}`}
                style={{ width: "100%", minWidth: 0 }}
              >
                {cell.revealed ? (
                  cell.mine ? (
                    "💥"
                  ) : cell.adjacent > 0 ? (
                    <span className={ADJACENT_COLORS[cell.adjacent]}>{cell.adjacent}</span>
                  ) : null
                ) : cell.flagged ? (
                  "🚩"
                ) : null}
              </motion.button>
            ))
          )}
        </div>
      </div>

      {(gameOver || won) && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 10 }}
          className="text-center mt-6"
        >
          <div className="text-5xl mb-3">{won ? "🏆" : "💥"}</div>
          <p className="font-display text-2xl font-bold gradient-text mb-1">
            {won ? "Board Cleared!" : "BOOM!"}
          </p>
          {won && (
            <p className="font-display text-lg text-[hsl(var(--neon-gold))] mb-4">{getCoins()} coins earned</p>
          )}
          <Button variant="hero" size="lg" onClick={() => onComplete(won ? getCoins() : 0)} className="w-full mt-2">
            {won ? "Collect Coins" : "Continue"}
          </Button>
        </motion.div>
      )}
    </GamePageLayout>
  );
};

export default Minesweeper;
