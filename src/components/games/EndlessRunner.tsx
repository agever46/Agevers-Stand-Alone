import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import GamePageLayout from "./GamePageLayout";
import { Button } from "@/components/ui/button";
import { gameSounds } from "@/lib/gameSounds";

interface Props {
  onComplete: (coins: number) => void;
  onClose: () => void;
  onRetry?: (coins: number) => Promise<boolean>;
}

// ─── Types ──────────────────────────────────────────────────

interface Obstacle {
  x: number;
  width: number;
  height: number;
  type: "cactus" | "rock" | "bird";
  y: number; // bottom offset for birds
  passed: boolean;
}

interface Cloud {
  x: number;
  y: number;
  size: number;
  speed: number;
}

// ─── Constants ──────────────────────────────────────────────

const CANVAS_W = 600;
const CANVAS_H = 250;
const GROUND_Y = 200;
const PLAYER_W = 28;
const PLAYER_H = 40;
const GRAVITY = 0.9;
const JUMP_FORCE = -13;
const INITIAL_SPEED = 9;
const MAX_SPEED = 26;

// ─── Main Component ────────────────────────────────────────

const EndlessRunner = ({ onComplete, onRetry }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "playing" | "dead" | "done">("ready");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const gameState = useRef({
    playerY: GROUND_Y - PLAYER_H,
    velY: 0,
    isJumping: false,
    isDucking: false,
    obstacles: [] as Obstacle[],
    clouds: [] as Cloud[],
    speed: INITIAL_SPEED,
    score: 0,
    frame: 0,
    groundOffset: 0,
    legFrame: 0,
  });

  const animRef = useRef<number>(0);
  const lastObstacleRef = useRef(0);

  // ─── Input ──────────────────────────────────────────────

  const handleJump = useCallback(() => {
    const gs = gameState.current;
    if (!gs.isJumping) {
      gs.velY = JUMP_FORCE;
      gs.isJumping = true;
      gameSounds.jump();
    }
  }, []);

  const handleDuck = useCallback((down: boolean) => {
    gameState.current.isDucking = down;
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        handleJump();
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        handleDuck(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowDown") handleDuck(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [phase, handleJump, handleDuck]);

  // ─── Drawing ────────────────────────────────────────────

  const drawPlayer = (ctx: CanvasRenderingContext2D, gs: typeof gameState.current) => {
    const px = 60;
    const py = gs.playerY;
    const ducking = gs.isDucking && !gs.isJumping;
    const h = ducking ? PLAYER_H * 0.6 : PLAYER_H;
    const adjustedY = ducking ? GROUND_Y - h : py;
    const cx = px + PLAYER_W / 2;

    ctx.save();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Head
    const headR = ducking ? 6 : 7;
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.arc(cx, adjustedY + headR, headR, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyTop = adjustedY + headR * 2;
    const bodyBottom = adjustedY + h * 0.65;
    ctx.beginPath();
    ctx.moveTo(cx, bodyTop);
    ctx.lineTo(cx, bodyBottom);
    ctx.stroke();

    // Arms
    const armY = bodyTop + (bodyBottom - bodyTop) * 0.3;
    const armSwing = gs.isJumping ? 0 : Math.sin(gs.legFrame * 0.3) * 10;
    ctx.beginPath();
    ctx.moveTo(cx - 12 - armSwing * 0.5, armY + 14 + Math.abs(armSwing) * 0.3);
    ctx.lineTo(cx, armY);
    ctx.lineTo(cx + 12 + armSwing * 0.5, armY + 14 + Math.abs(armSwing) * 0.3);
    ctx.stroke();

    // Legs
    const legTop = bodyBottom;
    const legLen = h * 0.35;
    if (gs.isJumping) {
      // Tucked legs
      ctx.beginPath();
      ctx.moveTo(cx, legTop);
      ctx.lineTo(cx - 8, legTop + legLen * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, legTop);
      ctx.lineTo(cx + 8, legTop + legLen * 0.6);
      ctx.stroke();
    } else {
      const legSwing = Math.sin(gs.legFrame * 0.3) * 12;
      // Left leg
      ctx.beginPath();
      ctx.moveTo(cx, legTop);
      ctx.lineTo(cx - 6 + legSwing, legTop + legLen);
      ctx.stroke();
      // Right leg
      ctx.beginPath();
      ctx.moveTo(cx, legTop);
      ctx.lineTo(cx + 6 - legSwing, legTop + legLen);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawObstacle = (ctx: CanvasRenderingContext2D, obs: Obstacle) => {
    ctx.save();
    if (obs.type === "cactus") {
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.roundRect(obs.x, GROUND_Y - obs.height, obs.width, obs.height, 3);
      ctx.fill();
      // Spines
      ctx.fillStyle = "#15803d";
      ctx.fillRect(obs.x - 4, GROUND_Y - obs.height * 0.7, 5, 3);
      ctx.fillRect(obs.x + obs.width - 1, GROUND_Y - obs.height * 0.5, 5, 3);
      // Top
      ctx.beginPath();
      ctx.arc(obs.x + obs.width / 2, GROUND_Y - obs.height, obs.width / 2.5, Math.PI, 0);
      ctx.fill();
    } else if (obs.type === "rock") {
      ctx.fillStyle = "#78716c";
      ctx.beginPath();
      ctx.moveTo(obs.x, GROUND_Y);
      ctx.lineTo(obs.x + obs.width * 0.3, GROUND_Y - obs.height);
      ctx.lineTo(obs.x + obs.width * 0.7, GROUND_Y - obs.height * 0.9);
      ctx.lineTo(obs.x + obs.width, GROUND_Y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#a8a29e";
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.width * 0.3, GROUND_Y - obs.height);
      ctx.lineTo(obs.x + obs.width * 0.5, GROUND_Y - obs.height * 0.6);
      ctx.lineTo(obs.x + obs.width * 0.7, GROUND_Y - obs.height * 0.9);
      ctx.closePath();
      ctx.fill();
    } else if (obs.type === "bird") {
      const by = GROUND_Y - obs.y;
      ctx.fillStyle = "#f97316";
      // Body
      ctx.beginPath();
      ctx.ellipse(obs.x + 12, by, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Wings
      const wingFlap = Math.sin(Date.now() * 0.015) * 8;
      ctx.fillStyle = "#ea580c";
      ctx.beginPath();
      ctx.moveTo(obs.x + 6, by);
      ctx.lineTo(obs.x + 12, by - 12 - wingFlap);
      ctx.lineTo(obs.x + 18, by);
      ctx.closePath();
      ctx.fill();
      // Eye
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(obs.x + 18, by - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(obs.x + 19, by - 2, 1.2, 0, Math.PI * 2);
      ctx.fill();
      // Beak
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(obs.x + 24, by - 1);
      ctx.lineTo(obs.x + 30, by + 1);
      ctx.lineTo(obs.x + 24, by + 3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  const drawScene = (ctx: CanvasRenderingContext2D, gs: typeof gameState.current) => {
    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, "#0f172a");
    skyGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, GROUND_Y);

    // Stars
    ctx.fillStyle = "#e2e8f0";
    for (let i = 0; i < 20; i++) {
      const sx = (i * 137 + 23) % CANVAS_W;
      const sy = (i * 89 + 11) % (GROUND_Y - 40);
      const twinkle = 0.3 + Math.sin(gs.frame * 0.02 + i) * 0.3;
      ctx.globalAlpha = twinkle;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Clouds
    gs.clouds.forEach((c) => {
      ctx.fillStyle = "rgba(148, 163, 184, 0.15)";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.size * 2, c.size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x - c.size, c.y + 3, c.size * 1.3, c.size * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Ground
    ctx.fillStyle = "#334155";
    ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);

    // Ground texture (scrolling dashes)
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      const gx = ((i * 40 - gs.groundOffset) % (CANVAS_W + 40)) - 20;
      ctx.beginPath();
      ctx.moveTo(gx, GROUND_Y + 8);
      ctx.lineTo(gx + 15, GROUND_Y + 8);
      ctx.stroke();
    }
    ctx.strokeStyle = "#64748b";
    for (let i = 0; i < 15; i++) {
      const gx = ((i * 80 + 20 - gs.groundOffset * 0.5) % (CANVAS_W + 80)) - 40;
      ctx.beginPath();
      ctx.moveTo(gx, GROUND_Y + 20);
      ctx.lineTo(gx + 25, GROUND_Y + 20);
      ctx.stroke();
    }

    // Ground line
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_W, GROUND_Y);
    ctx.stroke();

    // Obstacles
    gs.obstacles.forEach((obs) => drawObstacle(ctx, obs));

    // Player
    drawPlayer(ctx, gs);

    // Score
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`Score: ${Math.floor(gs.score)}`, CANVAS_W - 16, 28);

    // Speed indicator
    const speedPct = Math.min((gs.speed - INITIAL_SPEED) / (MAX_SPEED - INITIAL_SPEED), 1);
    ctx.fillStyle = "#475569";
    ctx.fillRect(CANVAS_W - 120, 36, 104, 6);
    const barGrad = ctx.createLinearGradient(CANVAS_W - 118, 0, CANVAS_W - 18, 0);
    barGrad.addColorStop(0, "#22c55e");
    barGrad.addColorStop(0.5, "#eab308");
    barGrad.addColorStop(1, "#ef4444");
    ctx.fillStyle = barGrad;
    ctx.fillRect(CANVAS_W - 118, 38, speedPct * 100, 2);
  };

  // ─── Game Loop ──────────────────────────────────────────

  const startGame = useCallback(() => {
    const gs = gameState.current;
    gs.playerY = GROUND_Y - PLAYER_H;
    gs.velY = 0;
    gs.isJumping = false;
    gs.isDucking = false;
    gs.obstacles = [];
    gs.clouds = Array.from({ length: 4 }, (_, i) => ({
      x: i * 160 + Math.random() * 80,
      y: 30 + Math.random() * 60,
      size: 8 + Math.random() * 12,
      speed: 0.3 + Math.random() * 0.5,
    }));
    gs.speed = INITIAL_SPEED;
    gs.score = 0;
    gs.frame = 0;
    gs.groundOffset = 0;
    gs.legFrame = 0;
    lastObstacleRef.current = 0;
    setScore(0);
    setPhase("playing");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      const gs = gameState.current;
      gs.frame++;
      gs.legFrame++;

      // Speed increases faster
      gs.speed = Math.min(INITIAL_SPEED + gs.score * 0.015, MAX_SPEED);
      gs.groundOffset = (gs.groundOffset + gs.speed) % 2000;

      // Physics
      gs.velY += GRAVITY;
      gs.playerY += gs.velY;
      if (gs.playerY >= GROUND_Y - PLAYER_H) {
        gs.playerY = GROUND_Y - PLAYER_H;
        gs.velY = 0;
        gs.isJumping = false;
      }

      // Spawn obstacles
      const minGap = Math.max(30, 80 - gs.speed * 4);
      if (gs.frame - lastObstacleRef.current > minGap + Math.random() * 20) {
        const typeRoll = Math.random();
        let type: Obstacle["type"] = "cactus";
        let height = 30 + Math.random() * 20;
        let width = 14 + Math.random() * 10;
        let obsY = height;

        if (typeRoll > 0.6 && gs.score > 30) {
          type = "bird";
          height = 14;
          width = 30;
          // Fly low enough that the player MUST duck (standing player top ≈ 40px above ground)
          obsY = 28 + Math.random() * 12;
        } else if (typeRoll > 0.5) {
          type = "rock";
          height = 18 + Math.random() * 12;
          width = 20 + Math.random() * 15;
        }

        gs.obstacles.push({
          x: CANVAS_W + 20,
          width,
          height,
          type,
          y: obsY,
          passed: false,
        });
        lastObstacleRef.current = gs.frame;
      }

      // Move obstacles
      gs.obstacles = gs.obstacles.filter((o) => o.x > -50);
      gs.obstacles.forEach((o) => {
        o.x -= gs.speed;
        if (!o.passed && o.x + o.width < 60) {
          o.passed = true;
          gs.score += 1;
          gameSounds.runnerScore();
        }
      });

      // Move clouds
      gs.clouds.forEach((c) => {
        c.x -= c.speed;
        if (c.x < -40) {
          c.x = CANVAS_W + 40;
          c.y = 30 + Math.random() * 60;
        }
      });

      // Score
      gs.score += 0.05;
      setScore(Math.floor(gs.score));

      // Collision
      const px = 60;
      const py = gs.playerY;
      const ducking = gs.isDucking && !gs.isJumping;
      const ph = ducking ? PLAYER_H * 0.6 : PLAYER_H;
      const pw = ducking ? PLAYER_W * 1.3 : PLAYER_W;
      const adjustedPy = ducking ? GROUND_Y - ph : py;

      for (const obs of gs.obstacles) {
        let ox: number, oy: number, ow: number, oh: number;
        if (obs.type === "bird") {
          ox = obs.x;
          oy = GROUND_Y - obs.y - 7;
          ow = 24;
          oh = 14;
        } else {
          ox = obs.x;
          oy = GROUND_Y - obs.height;
          ow = obs.width;
          oh = obs.height;
        }

        // AABB collision with padding
        const pad = 5;
        if (
          px + pw - pad > ox + pad &&
          px + pad < ox + ow - pad &&
          adjustedPy + ph - pad > oy + pad &&
          adjustedPy + pad < oy + oh - pad
        ) {
          // Dead
          gameSounds.crash();
          setPhase("dead");
          const finalScore = Math.floor(gs.score);
          setScore(finalScore);
          setHighScore((prev) => Math.max(prev, finalScore));
          return;
        }
      }

      // Draw
      drawScene(ctx, gs);

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [phase]);

  // Draw initial still frame
  useEffect(() => {
    if (phase !== "ready") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gs = gameState.current;
    gs.playerY = GROUND_Y - PLAYER_H;
    gs.clouds = Array.from({ length: 4 }, (_, i) => ({
      x: i * 160 + 30, y: 30 + Math.random() * 60, size: 10 + Math.random() * 10, speed: 0.3,
    }));
    gs.obstacles = [];
    gs.score = 0;
    gs.frame = 0;
    gs.groundOffset = 0;
    drawScene(ctx, gs);
  }, [phase]);

  const coinsEarned = Math.max(0, Math.floor(score / 20));

  // ─── Render ─────────────────────────────────────────────

  return (
    <GamePageLayout title="Alien Runner" emoji="👽" gradientFrom="from-blue-500" gradientTo="to-indigo-600">
      <div className="flex flex-col items-center">
        {/* Canvas */}
        <div
          className="w-full rounded-2xl overflow-hidden border border-border/30 mb-4 cursor-pointer"
          onClick={phase === "playing" ? handleJump : undefined}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {phase === "ready" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center w-full">
            <p className="text-muted-foreground mb-2 text-sm">
              Run, jump over obstacles and dodge birds!
            </p>
            <p className="text-xs text-muted-foreground mb-1">⌨️ Space / ↑ = Jump &nbsp; ↓ = Duck</p>
            <p className="text-xs text-muted-foreground mb-6">📱 Tap the screen to jump</p>
            <Button variant="hero" size="lg" onClick={startGame} className="w-full">
              🏃 Start Running!
            </Button>
          </motion.div>
        )}

        {phase === "playing" && (
          <div className="flex items-center gap-4 w-full justify-between">
            <div className="glass rounded-lg px-3 py-1.5">
              <span className="font-display text-sm font-bold text-foreground">Score: {score}</span>
            </div>
            <p className="text-xs text-muted-foreground animate-pulse">SPACE to jump! ↓ to duck!</p>
            <div className="glass rounded-lg px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Speed: </span>
              <span className={`font-display text-sm font-bold ${gameState.current.speed > 8 ? 'text-destructive' : 'text-foreground'}`}>
                {gameState.current.speed.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {phase === "dead" && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 10 }}
            className="text-center w-full mt-2"
          >
            <div className="text-5xl mb-3">💥</div>
            <p className="font-display text-2xl font-bold gradient-text mb-1">Game Over!</p>
            <p className="text-muted-foreground mb-1">Score: <span className="font-bold text-foreground">{score}</span></p>
            {highScore > 0 && (
              <p className="text-xs text-muted-foreground mb-1">🏆 Best: {highScore}</p>
            )}
            <p className="font-display text-lg text-[hsl(var(--neon-gold))] mb-4">
              {coinsEarned > 0 ? `${coinsEarned} coins earned!` : "No coins this time"}
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="lg" onClick={async () => {
                if (onRetry) {
                  const ok = await onRetry(coinsEarned);
                  if (ok) startGame();
                } else {
                  startGame();
                }
              }} className="flex-1">
                🔄 Try Again
              </Button>
              <Button variant="hero" size="lg" onClick={() => {
                setPhase("done");
                onComplete(coinsEarned);
              }} className="flex-1">
                {coinsEarned > 0 ? "Collect Coins" : "Continue"}
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </GamePageLayout>
  );
};

export default EndlessRunner;
