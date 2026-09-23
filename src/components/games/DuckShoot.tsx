import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import GamePageLayout from "./GamePageLayout";
import { Button } from "@/components/ui/button";
import { gameSounds } from "@/lib/gameSounds";

interface Props {
  onComplete: (coins: number) => void;
  onClose: () => void;
}

interface Duck {
  id: number;
  x: number;
  y: number;
  row: number;
  speed: number;
  direction: 1 | -1;
  alive: boolean;
  hitTime?: number;
  type: "normal" | "golden" | "fast";
}

const CANVAS_W = 600;
const CANVAS_H = 400;
const DUCK_W = 52;
const DUCK_H = 44;
const GAME_DURATION = 20;
const ROWS = [80, 150, 220, 290];

const DUCK_COLORS: Record<string, { body: string; wing: string; beak: string; points: number }> = {
  normal: { body: "#e8a820", wing: "#d4941c", beak: "#ff6b35", points: 1 },
  golden: { body: "#ffd700", wing: "#ffb300", beak: "#ff4444", points: 3 },
  fast: { body: "#4fc3f7", wing: "#0288d1", beak: "#ff6b35", points: 2 },
};

function drawDuck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dir: 1 | -1,
  type: Duck["type"],
  frame: number
) {
  const c = DUCK_COLORS[type];
  ctx.save();
  ctx.translate(x + DUCK_W / 2, y + DUCK_H / 2);
  ctx.scale(dir, 1);

  // Body
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.ellipse(0, 4, 20, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.arc(16, -6, 10, 0, Math.PI * 2);
  ctx.fill();

  // Eye
  ctx.fillStyle = "#1a1a2e";
  ctx.beginPath();
  ctx.arc(20, -8, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(21, -9, 1, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = c.beak;
  ctx.beginPath();
  ctx.moveTo(26, -6);
  ctx.lineTo(34, -4);
  ctx.lineTo(26, -2);
  ctx.closePath();
  ctx.fill();

  // Wing (animated)
  const wingY = Math.sin(frame * 0.15) * 3;
  ctx.fillStyle = c.wing;
  ctx.beginPath();
  ctx.ellipse(-2, 2 + wingY, 12, 8, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Tail
  ctx.fillStyle = c.wing;
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-26, -6);
  ctx.lineTo(-24, 4);
  ctx.closePath();
  ctx.fill();

  // Golden sparkle
  if (type === "golden" && frame % 20 < 10) {
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(8, -14, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-6, -10, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawSplash(ctx: CanvasRenderingContext2D, x: number, y: number, age: number) {
  const progress = age / 500;
  if (progress > 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  // Feathers
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + age * 0.005;
    const dist = progress * 30;
    const fx = x + DUCK_W / 2 + Math.cos(angle) * dist;
    const fy = y + DUCK_H / 2 + Math.sin(angle) * dist - progress * 20;
    ctx.fillStyle = i % 2 === 0 ? "#e8a820" : "#fff";
    ctx.beginPath();
    ctx.ellipse(fx, fy, 4, 2, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  // Score text
  ctx.fillStyle = "#ffd700";
  ctx.font = `bold ${14 + progress * 8}px system-ui`;
  ctx.textAlign = "center";
  ctx.fillText("💥", x + DUCK_W / 2, y + DUCK_H / 2 - progress * 25);
  ctx.restore();
}

function drawCrosshair(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.strokeStyle = "#ff4444";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.8;
  // Outer circle
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.stroke();
  // Inner dot
  ctx.fillStyle = "#ff4444";
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
  // Cross lines
  const gap = 8;
  const len = 18;
  ctx.beginPath();
  ctx.moveTo(x - len, y); ctx.lineTo(x - gap, y);
  ctx.moveTo(x + gap, y); ctx.lineTo(x + len, y);
  ctx.moveTo(x, y - len); ctx.lineTo(x, y - gap);
  ctx.moveTo(x, y + gap); ctx.lineTo(x, y + len);
  ctx.stroke();
  ctx.restore();
}

const DuckShoot = ({ onComplete, onClose }: Props) => {
  const [phase, setPhase] = useState<"ready" | "playing" | "done">("ready");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [shotsTotal, setShotsTotal] = useState(0);
  const [hits, setHits] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ducksRef = useRef<Duck[]>([]);
  const frameRef = useRef(0);
  const nextIdRef = useRef(0);
  const mouseRef = useRef({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
  const animRef = useRef(0);

  const spawnDuck = useCallback(() => {
    const row = ROWS[Math.floor(Math.random() * ROWS.length)];
    const dir = Math.random() > 0.5 ? 1 : -1;
    const rand = Math.random();
    const type: Duck["type"] = rand < 0.12 ? "golden" : rand < 0.4 ? "fast" : "normal";
    const elapsed = GAME_DURATION - timeLeft;
    const speedMult = 1 + elapsed * 0.06; // ducks get faster over time
    const baseSpeed = type === "fast" ? 3.5 : type === "golden" ? 1.8 : 2.2;
    const duck: Duck = {
      id: nextIdRef.current++,
      x: dir === 1 ? -DUCK_W : CANVAS_W,
      y: row + (Math.random() - 0.5) * 20,
      row: row,
      speed: (baseSpeed + Math.random() * 1.5) * speedMult,
      direction: dir as 1 | -1,
      alive: true,
      type,
    };
    ducksRef.current.push(duck);
  }, [timeLeft]);

  const startGame = useCallback(() => {
    setPhase("playing");
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setShotsTotal(0);
    setHits(0);
    ducksRef.current = [];
    frameRef.current = 0;
    nextIdRef.current = 0;
    // Spawn initial ducks
    for (let i = 0; i < 4; i++) {
      setTimeout(() => spawnDuck(), i * 300);
    }
  }, [spawnDuck]);

  // Game timer
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setPhase("done");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Spawn ducks periodically
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      const aliveCount = ducksRef.current.filter((d) => d.alive).length;
      if (aliveCount < 8) {
        spawnDuck();
        // Spawn extra duck sometimes for more chaos
        if (Math.random() < 0.3) spawnDuck();
      }
    }, 600);
    return () => clearInterval(interval);
  }, [phase, spawnDuck]);

  // Main game loop
  useEffect(() => {
    if (phase !== "playing" && phase !== "done") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      frameRef.current++;
      const now = Date.now();

      // Clear
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Background - carnival booth
      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      skyGrad.addColorStop(0, "#1a1a3e");
      skyGrad.addColorStop(0.6, "#2d1b4e");
      skyGrad.addColorStop(1, "#1a1a2e");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Stars
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 20; i++) {
        const sx = (i * 137.5 + frameRef.current * 0.05) % CANVAS_W;
        const sy = (i * 73.1) % (CANVAS_H * 0.4);
        ctx.globalAlpha = 0.3 + Math.sin(frameRef.current * 0.03 + i) * 0.2;
        ctx.beginPath();
        ctx.arc(sx, sy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Row backgrounds (lanes) — shelves
      ROWS.forEach((rowY) => {
        ctx.fillStyle = "rgba(139, 90, 43, 0.3)";
        ctx.fillRect(0, rowY + DUCK_H - 4, CANVAS_W, 8);
        // Shelf shadow
        ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        ctx.fillRect(0, rowY + DUCK_H + 4, CANVAS_W, 4);
      });

      // Booth frame
      ctx.strokeStyle = "#8b5a2b";
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, CANVAS_W - 6, CANVAS_H - 6);
      // Decorative lights on top
      for (let i = 0; i < 20; i++) {
        const lx = 15 + i * 30;
        const colors = ["#ff4444", "#ffd700", "#44ff44", "#4444ff", "#ff44ff"];
        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = 0.6 + Math.sin(frameRef.current * 0.1 + i) * 0.3;
        ctx.beginPath();
        ctx.arc(lx, 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Update & draw ducks
      ducksRef.current.forEach((duck) => {
        if (duck.alive) {
          duck.x += duck.speed * duck.direction;
          // Remove if off screen
          if (
            (duck.direction === 1 && duck.x > CANVAS_W + DUCK_W) ||
            (duck.direction === -1 && duck.x < -DUCK_W * 2)
          ) {
            duck.alive = false;
          }
          drawDuck(ctx, duck.x, duck.y, duck.direction, duck.type, frameRef.current);
        } else if (duck.hitTime) {
          const age = now - duck.hitTime;
          if (age < 500) {
            drawSplash(ctx, duck.x, duck.y, age);
          }
        }
      });

      // Clean up old dead ducks
      if (frameRef.current % 120 === 0) {
        ducksRef.current = ducksRef.current.filter(
          (d) => d.alive || (d.hitTime && now - d.hitTime < 600)
        );
      }

      // Draw crosshair
      if (phase === "playing") {
        drawCrosshair(ctx, mouseRef.current.x, mouseRef.current.y);
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [phase]);

  // Mouse tracking
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      mouseRef.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };
    canvas.addEventListener("mousemove", handleMove);
    return () => canvas.removeEventListener("mousemove", handleMove);
  }, [phase]);

  const playShootSound = useCallback(() => {
    gameSounds.shoot();
  }, []);

  const handleShoot = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (phase !== "playing") return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      playShootSound();

      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      setShotsTotal((s) => s + 1);

      // Check hit — iterate in reverse to hit front ducks first
      for (let i = ducksRef.current.length - 1; i >= 0; i--) {
        const duck = ducksRef.current[i];
        if (!duck.alive) continue;
        if (
          mx >= duck.x &&
          mx <= duck.x + DUCK_W &&
          my >= duck.y &&
          my <= duck.y + DUCK_H
        ) {
          duck.alive = false;
          duck.hitTime = Date.now();
          const pts = DUCK_COLORS[duck.type].points;
          setScore((s) => s + pts);
          setHits((h) => h + 1);
          gameSounds.duckHit();
          break;
        }
      }
    },
    [phase]
  );

  const coinsEarned = Math.min(20, Math.floor(score * 0.5));
  const accuracy = shotsTotal > 0 ? Math.round((hits / shotsTotal) * 100) : 0;

  if (phase === "ready") {
    return (
      <GamePageLayout title="Duck Shoot" emoji="🦆" gradientFrom="from-amber-500" gradientTo="to-red-500">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            Shoot the ducks before they escape! Aim and click to fire.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-6 text-center">
            <div className="glass rounded-lg p-3">
              <div className="text-xl mb-1">🦆</div>
              <p className="text-[11px] font-display font-bold text-foreground">Normal</p>
              <p className="text-[10px] text-muted-foreground">1 point</p>
            </div>
            <div className="glass rounded-lg p-3">
              <div className="text-xl mb-1">⚡</div>
              <p className="text-[11px] font-display font-bold text-[hsl(var(--neon-green))]">Fast</p>
              <p className="text-[10px] text-muted-foreground">2 points</p>
            </div>
            <div className="glass rounded-lg p-3">
              <div className="text-xl mb-1">⭐</div>
              <p className="text-[11px] font-display font-bold text-[hsl(var(--neon-gold))]">Golden</p>
              <p className="text-[10px] text-muted-foreground">3 points</p>
            </div>
          </div>
          <Button variant="hero" size="lg" onClick={startGame} className="w-full">
            🎯 Start Shooting!
          </Button>
        </div>
      </GamePageLayout>
    );
  }

  return (
    <GamePageLayout title="Duck Shoot" emoji="🦆" gradientFrom="from-amber-500" gradientTo="to-red-500">
      <div className="flex flex-col items-center">
        {/* Stats */}
        {phase === "playing" && (
          <div className="flex items-center gap-3 mb-3 w-full justify-between">
            <div className="glass rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <span className={`font-display text-sm font-bold ${timeLeft <= 5 ? "text-destructive animate-pulse" : "text-foreground"}`}>
                ⏱ {timeLeft}s
              </span>
            </div>
            <div className="glass rounded-lg px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Score: </span>
              <span className="font-display text-sm font-bold text-[hsl(var(--neon-gold))]">{score}</span>
            </div>
            <div className="glass rounded-lg px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Accuracy: </span>
              <span className="font-display text-sm font-bold text-foreground">{accuracy}%</span>
            </div>
          </div>
        )}

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={handleShoot}
          className="w-full rounded-2xl border-2 border-border/30 mb-4"
          style={{ cursor: phase === "playing" ? "none" : "default", imageRendering: "auto" }}
        />

        {phase === "playing" && (
          <p className="text-xs text-muted-foreground animate-pulse">🎯 Click the ducks to shoot!</p>
        )}

        {/* Result */}
        {phase === "done" && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 10 }}
            className="text-center w-full mt-2"
          >
            <div className="text-5xl mb-3">🎯</div>
            <p className="font-display text-2xl font-bold gradient-text mb-1">
              {score >= 20 ? "SHARPSHOOTER!" : score >= 10 ? "Nice Shooting!" : "Keep Practicing!"}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="glass rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Score</p>
                <p className="font-display text-lg font-bold text-[hsl(var(--neon-gold))]">{score}</p>
              </div>
              <div className="glass rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Hits</p>
                <p className="font-display text-lg font-bold text-foreground">{hits}/{shotsTotal}</p>
              </div>
              <div className="glass rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Accuracy</p>
                <p className="font-display text-lg font-bold text-foreground">{accuracy}%</p>
              </div>
            </div>
            <p className="font-display text-lg text-[hsl(var(--neon-gold))] mb-4">
              {coinsEarned} coins earned!
            </p>
            <Button variant="hero" size="lg" onClick={() => onComplete(coinsEarned)} className="w-full">
              Collect Coins
            </Button>
          </motion.div>
        )}
      </div>
    </GamePageLayout>
  );
};

export default DuckShoot;
