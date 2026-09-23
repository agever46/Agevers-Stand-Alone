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

interface Wall {
  x: number;
  gapY: number;
  gapH: number;
  passed: boolean;
}

interface Star { x: number; y: number; size: number; speed: number; }
interface Cloud { x: number; y: number; scale: number; speed: number; }
interface Mountain { x: number; h: number; w: number; shade: number; }
interface Smoke { x: number; y: number; r: number; life: number; max: number; }

const CANVAS_W = 640;
const CANVAS_H = 380;
const JET_X = 110;
const JET_W = 56;
const JET_H = 24;

// Smooth flight physics — hold to thrust, release to glide down
const GRAVITY = 0.32;       // constant downward pull
const THRUST = -0.55;       // upward acceleration while held
const MAX_VEL_UP = -6.5;
const MAX_VEL_DOWN = 7.0;
const DAMP = 0.985;         // gentle air resistance

const WALL_W = 56;
const INITIAL_SPEED = 3.2;
const MAX_SPEED = 7.5;

const JetFighter = ({ onComplete, onRetry }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "playing" | "dead" | "done">("ready");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  const gameState = useRef({
    jetY: CANVAS_H / 2,
    velY: 0,
    thrusting: false,
    walls: [] as Wall[],
    stars: [] as Star[],
    clouds: [] as Cloud[],
    mountains: [] as Mountain[],
    smoke: [] as Smoke[],
    speed: INITIAL_SPEED,
    score: 0,
    frame: 0,
    groundOffset: 0,
  });

  const animRef = useRef<number>(0);
  const lastWallRef = useRef(0);
  const lastSmokeRef = useRef(0);
  const thrustSoundRef = useRef(0);

  // ─── Input: hold to thrust ──────────────────────────────

  const setThrust = useCallback((on: boolean) => {
    const gs = gameState.current;
    if (on && !gs.thrusting) {
      // start jet engine loop while thrust is held
      gameSounds.jetEngineStart();
    } else if (!on && gs.thrusting) {
      gameSounds.jetEngineStop();
    }
    gs.thrusting = on;
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        if (!e.repeat) setThrust(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        setThrust(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    // Global release fallbacks — on mobile the canvas may capture the pointer
    // and the wrapper's onPointerUp never fires, causing the jet to keep climbing.
    const releaseAll = () => setThrust(false);
    window.addEventListener("pointerup", releaseAll);
    window.addEventListener("pointercancel", releaseAll);
    window.addEventListener("touchend", releaseAll);
    window.addEventListener("touchcancel", releaseAll);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerup", releaseAll);
      window.removeEventListener("pointercancel", releaseAll);
      window.removeEventListener("touchend", releaseAll);
      window.removeEventListener("touchcancel", releaseAll);
      window.removeEventListener("blur", releaseAll);
      gameSounds.jetEngineStop();
    };
  }, [phase, setThrust]);

  // ─── Drawing ─────────────────────────────────────────────

  const drawJet = (ctx: CanvasRenderingContext2D, gs: typeof gameState.current) => {
    const x = JET_X;
    const y = gs.jetY;
    const tilt = Math.max(-0.5, Math.min(0.5, gs.velY * 0.08));

    ctx.save();
    ctx.translate(x + JET_W / 2, y + JET_H / 2);
    ctx.rotate(tilt);

    // ── Afterburner flame (bigger when thrusting) ──
    const baseFlame = 8;
    const burst = gs.thrusting ? 18 + Math.sin(gs.frame * 0.8) * 4 : 6 + Math.sin(gs.frame * 0.6) * 2;
    const flameLen = baseFlame + burst;

    // outer red glow
    const outerGrad = ctx.createRadialGradient(-JET_W / 2 - flameLen * 0.4, 0, 1, -JET_W / 2 - flameLen * 0.4, 0, flameLen * 1.2);
    outerGrad.addColorStop(0, "rgba(251,146,60,0.85)");
    outerGrad.addColorStop(0.5, "rgba(239,68,68,0.4)");
    outerGrad.addColorStop(1, "rgba(239,68,68,0)");
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.ellipse(-JET_W / 2 - flameLen * 0.4, 0, flameLen * 1.2, flameLen * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // inner bright core
    const coreGrad = ctx.createLinearGradient(-JET_W / 2 - flameLen, 0, -JET_W / 2 + 2, 0);
    coreGrad.addColorStop(0, "rgba(255,255,255,0)");
    coreGrad.addColorStop(0.3, "rgba(254,240,138,0.9)");
    coreGrad.addColorStop(0.7, "#fde047");
    coreGrad.addColorStop(1, "#fbbf24");
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.moveTo(-JET_W / 2 + 2, -3.5);
    ctx.lineTo(-JET_W / 2 - flameLen, 0);
    ctx.lineTo(-JET_W / 2 + 2, 3.5);
    ctx.closePath();
    ctx.fill();

    // ── Body (sleek fighter) ──
    const bodyGrad = ctx.createLinearGradient(0, -JET_H / 2, 0, JET_H / 2);
    bodyGrad.addColorStop(0, "#e2e8f0");
    bodyGrad.addColorStop(0.45, "#94a3b8");
    bodyGrad.addColorStop(0.85, "#475569");
    bodyGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-JET_W / 2 + 4, -4);
    ctx.lineTo(JET_W / 2 - 14, -7);
    ctx.quadraticCurveTo(JET_W / 2 - 2, -2, JET_W / 2 + 4, 0);
    ctx.quadraticCurveTo(JET_W / 2 - 2, 2, JET_W / 2 - 14, 7);
    ctx.lineTo(-JET_W / 2 + 4, 4);
    ctx.quadraticCurveTo(-JET_W / 2 - 2, 0, -JET_W / 2 + 4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ── Delta wings ──
    const wingGrad = ctx.createLinearGradient(0, -16, 0, 0);
    wingGrad.addColorStop(0, "#475569");
    wingGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = wingGrad;
    // top wing
    ctx.beginPath();
    ctx.moveTo(-2, -3);
    ctx.lineTo(-18, -16);
    ctx.lineTo(2, -16);
    ctx.lineTo(8, -4);
    ctx.closePath();
    ctx.fill();
    // bottom wing
    const wingGrad2 = ctx.createLinearGradient(0, 0, 0, 16);
    wingGrad2.addColorStop(0, "#1e293b");
    wingGrad2.addColorStop(1, "#0f172a");
    ctx.fillStyle = wingGrad2;
    ctx.beginPath();
    ctx.moveTo(-2, 3);
    ctx.lineTo(-18, 16);
    ctx.lineTo(2, 16);
    ctx.lineTo(8, 4);
    ctx.closePath();
    ctx.fill();

    // Wing accent stripes
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(-12, -14, 8, 2);
    ctx.fillRect(-12, 12, 8, 2);

    // ── Tail fin ──
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(-JET_W / 2 + 6, -4);
    ctx.lineTo(-JET_W / 2 + 4, -14);
    ctx.lineTo(-JET_W / 2 + 16, -4);
    ctx.closePath();
    ctx.fill();

    // ── Cockpit canopy ──
    const cockpitGrad = ctx.createLinearGradient(0, -6, 0, 0);
    cockpitGrad.addColorStop(0, "#7dd3fc");
    cockpitGrad.addColorStop(0.5, "#0ea5e9");
    cockpitGrad.addColorStop(1, "#0c4a6e");
    ctx.fillStyle = cockpitGrad;
    ctx.beginPath();
    ctx.ellipse(8, -2, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // canopy reflection
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(10, -3.5, 3.5, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Nose tip ──
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(JET_W / 2 + 3, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    // Missile pods under wings
    ctx.fillStyle = "#64748b";
    ctx.fillRect(-6, -18, 12, 2);
    ctx.fillRect(-6, 16, 12, 2);

    ctx.restore();
  };

  const drawWall = (ctx: CanvasRenderingContext2D, w: Wall) => {
    const topH = w.gapY - w.gapH / 2;
    const botY = w.gapY + w.gapH / 2;
    const botH = CANVAS_H - botY;

    // Metal tower walls
    const grad = ctx.createLinearGradient(w.x, 0, w.x + WALL_W, 0);
    grad.addColorStop(0, "#1e293b");
    grad.addColorStop(0.3, "#475569");
    grad.addColorStop(0.7, "#334155");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
    ctx.fillRect(w.x, 0, WALL_W, topH);
    ctx.fillRect(w.x, botY, WALL_W, botH);

    // Rivets
    ctx.fillStyle = "rgba(15,23,42,0.6)";
    for (let i = 10; i < topH; i += 24) {
      ctx.beginPath(); ctx.arc(w.x + 8, i, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w.x + WALL_W - 8, i, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = botY + 12; i < CANVAS_H; i += 24) {
      ctx.beginPath(); ctx.arc(w.x + 8, i, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w.x + WALL_W - 8, i, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    // Caps with warning stripes
    const capH = 14;
    ctx.fillStyle = "#facc15";
    ctx.fillRect(w.x - 5, topH - capH, WALL_W + 10, capH);
    ctx.fillRect(w.x - 5, botY, WALL_W + 10, capH);
    // Black hazard stripes
    ctx.fillStyle = "#0f172a";
    for (let i = 0; i < WALL_W + 10; i += 10) {
      ctx.beginPath();
      ctx.moveTo(w.x - 5 + i, topH - capH);
      ctx.lineTo(w.x - 5 + i + 5, topH - capH);
      ctx.lineTo(w.x - 5 + i + 10, topH);
      ctx.lineTo(w.x - 5 + i + 5, topH);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w.x - 5 + i, botY);
      ctx.lineTo(w.x - 5 + i + 5, botY);
      ctx.lineTo(w.x - 5 + i + 10, botY + capH);
      ctx.lineTo(w.x - 5 + i + 5, botY + capH);
      ctx.closePath(); ctx.fill();
    }

    // Warning light
    const blink = Math.sin(Date.now() * 0.008 + w.x) > 0;
    ctx.fillStyle = blink ? "#ef4444" : "#7f1d1d";
    ctx.beginPath();
    ctx.arc(w.x + WALL_W / 2, topH - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w.x + WALL_W / 2, botY + 3, 3, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawScene = (ctx: CanvasRenderingContext2D, gs: typeof gameState.current) => {
    // ── Sky gradient ──
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    sky.addColorStop(0, "#020617");
    sky.addColorStop(0.4, "#0f172a");
    sky.addColorStop(0.8, "#1e3a5f");
    sky.addColorStop(1, "#475569");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Stars (twinkling)
    gs.stars.forEach((s, i) => {
      const tw = 0.4 + Math.sin(gs.frame * 0.04 + i) * 0.4;
      ctx.fillStyle = `rgba(226,232,240,${tw})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── Distant mountains (parallax) ──
    gs.mountains.forEach((m) => {
      const shade = 30 + m.shade * 25;
      ctx.fillStyle = `rgb(${shade},${shade + 8},${shade + 20})`;
      ctx.beginPath();
      ctx.moveTo(m.x, CANVAS_H - 30);
      ctx.lineTo(m.x + m.w / 2, CANVAS_H - 30 - m.h);
      ctx.lineTo(m.x + m.w, CANVAS_H - 30);
      ctx.closePath();
      ctx.fill();
      // snow cap
      ctx.fillStyle = `rgba(226,232,240,${0.3 + m.shade * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(m.x + m.w / 2 - m.h * 0.15, CANVAS_H - 30 - m.h * 0.7);
      ctx.lineTo(m.x + m.w / 2, CANVAS_H - 30 - m.h);
      ctx.lineTo(m.x + m.w / 2 + m.h * 0.15, CANVAS_H - 30 - m.h * 0.7);
      ctx.closePath();
      ctx.fill();
    });

    // ── Clouds ──
    gs.clouds.forEach((c) => {
      const alpha = 0.15 + c.scale * 0.08;
      ctx.fillStyle = `rgba(148,163,184,${alpha})`;
      const cs = c.scale * 14;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, cs * 2, cs, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x - cs, c.y + 4, cs * 1.3, cs * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + cs, c.y + 2, cs * 1.4, cs * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // ── Smoke trail (behind jet) ──
    gs.smoke.forEach((s) => {
      const a = (s.life / s.max) * 0.4;
      ctx.fillStyle = `rgba(203,213,225,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * (1 + (1 - s.life / s.max) * 1.5), 0, Math.PI * 2);
      ctx.fill();
    });

    // Walls
    gs.walls.forEach((w) => drawWall(ctx, w));

    // Ground strip with scrolling lines
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, CANVAS_H - 6, CANVAS_W, 6);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -gs.groundOffset;
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H - 3);
    ctx.lineTo(CANVAS_W, CANVAS_H - 3);
    ctx.stroke();
    ctx.setLineDash([]);

    // Jet
    drawJet(ctx, gs);

    // ── HUD ──
    // Score panel
    ctx.fillStyle = "rgba(15,23,42,0.7)";
    ctx.fillRect(CANVAS_W - 160, 12, 148, 50);
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 1;
    ctx.strokeRect(CANVAS_W - 160, 12, 148, 50);

    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "left";
    ctx.fillText("SCORE", CANVAS_W - 152, 26);
    ctx.fillStyle = "#e0f2fe";
    ctx.font = "bold 22px monospace";
    ctx.fillText(`${Math.floor(gs.score)}`, CANVAS_W - 152, 50);

    // Speed bar
    const speedPct = Math.min((gs.speed - INITIAL_SPEED) / (MAX_SPEED - INITIAL_SPEED), 1);
    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 9px monospace";
    ctx.fillText("MACH", CANVAS_W - 80, 26);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(CANVAS_W - 80, 30, 60, 6);
    const barGrad = ctx.createLinearGradient(CANVAS_W - 80, 0, CANVAS_W - 20, 0);
    barGrad.addColorStop(0, "#22c55e");
    barGrad.addColorStop(0.5, "#eab308");
    barGrad.addColorStop(1, "#ef4444");
    ctx.fillStyle = barGrad;
    ctx.fillRect(CANVAS_W - 80, 30, speedPct * 60, 6);

    // Thrust indicator
    ctx.fillStyle = gs.thrusting ? "#22c55e" : "#475569";
    ctx.font = "bold 9px monospace";
    ctx.fillText("THRUST", CANVAS_W - 80, 50);
    ctx.fillStyle = gs.thrusting ? "#bbf7d0" : "#334155";
    ctx.fillRect(CANVAS_W - 80, 53, 60, 4);
  };

  // ─── Game Loop ───────────────────────────────────────────

  const initWorld = useCallback(() => {
    const gs = gameState.current;
    gs.jetY = CANVAS_H / 2;
    gs.velY = 0;
    gs.thrusting = false;
    gs.walls = [];
    gs.smoke = [];
    gs.stars = Array.from({ length: 50 }, () => ({
      x: Math.random() * CANVAS_W,
      y: Math.random() * (CANVAS_H - 80),
      size: 0.4 + Math.random() * 1.6,
      speed: 0.2 + Math.random() * 0.8,
    }));
    gs.clouds = Array.from({ length: 5 }, () => ({
      x: Math.random() * CANVAS_W,
      y: 30 + Math.random() * 140,
      scale: 0.6 + Math.random() * 1.0,
      speed: 0.3 + Math.random() * 0.7,
    }));
    gs.mountains = Array.from({ length: 6 }, (_, i) => ({
      x: i * 140 - 50,
      h: 50 + Math.random() * 80,
      w: 140 + Math.random() * 80,
      shade: Math.random(),
    }));
    gs.speed = INITIAL_SPEED;
    gs.score = 0;
    gs.frame = 0;
    gs.groundOffset = 0;
    lastWallRef.current = 0;
    lastSmokeRef.current = 0;
  }, []);

  const startGame = useCallback(() => {
    initWorld();
    setScore(0);
    setPhase("playing");
  }, [initWorld]);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      const gs = gameState.current;
      gs.frame++;

      gs.speed = Math.min(INITIAL_SPEED + gs.score * 0.012, MAX_SPEED);
      gs.groundOffset = (gs.groundOffset + gs.speed) % 200;

      // ── Smooth physics ──
      const accel = gs.thrusting ? THRUST : 0;
      gs.velY += GRAVITY + accel;
      gs.velY *= DAMP;
      gs.velY = Math.max(MAX_VEL_UP, Math.min(MAX_VEL_DOWN, gs.velY));
      gs.jetY += gs.velY;

      // Parallax: stars (slowest), mountains (slow), clouds (medium)
      gs.stars.forEach((s) => {
        s.x -= s.speed * (gs.speed / INITIAL_SPEED) * 0.3;
        if (s.x < -2) { s.x = CANVAS_W + 2; s.y = Math.random() * (CANVAS_H - 80); }
      });
      gs.mountains.forEach((m) => {
        m.x -= gs.speed * 0.4;
        if (m.x + m.w < 0) {
          m.x = CANVAS_W + Math.random() * 60;
          m.h = 50 + Math.random() * 80;
          m.w = 140 + Math.random() * 80;
          m.shade = Math.random();
        }
      });
      gs.clouds.forEach((c) => {
        c.x -= c.speed * (gs.speed / INITIAL_SPEED) * 0.6;
        if (c.x + c.scale * 30 < -20) {
          c.x = CANVAS_W + 40;
          c.y = 30 + Math.random() * 140;
          c.scale = 0.6 + Math.random() * 1.0;
        }
      });

      // ── Smoke trail emission ──
      if (gs.frame - lastSmokeRef.current >= 2) {
        gs.smoke.push({
          x: JET_X - 4 + (Math.random() - 0.5) * 3,
          y: gs.jetY + JET_H / 2 + (Math.random() - 0.5) * 4,
          r: 2 + Math.random() * 2,
          life: 30,
          max: 30,
        });
        lastSmokeRef.current = gs.frame;
      }
      gs.smoke = gs.smoke.filter((s) => s.life > 0);
      gs.smoke.forEach((s) => {
        s.x -= gs.speed * 0.8;
        s.y += (Math.random() - 0.5) * 0.5;
        s.life--;
      });

      // ── Spawn walls ──
      const gap = Math.max(130, 190 - gs.score * 0.2);
      const spacingFrames = Math.max(55, 95 - Math.floor(gs.score / 5));
      if (gs.frame - lastWallRef.current > spacingFrames) {
        const margin = 50;
        const gapY = margin + gap / 2 + Math.random() * (CANVAS_H - gap - margin * 2 - 6);
        gs.walls.push({ x: CANVAS_W + 20, gapY, gapH: gap, passed: false });
        lastWallRef.current = gs.frame;
      }

      gs.walls = gs.walls.filter((w) => w.x > -WALL_W - 10);
      gs.walls.forEach((w) => {
        w.x -= gs.speed;
        if (!w.passed && w.x + WALL_W < JET_X) {
          w.passed = true;
          gs.score += 5;
          gameSounds.runnerScore();
        }
      });

      // passive distance score
      gs.score += 0.03;
      setScore(Math.floor(gs.score));

      // ── Collision ──
      const jx = JET_X;
      const jy = gs.jetY;
      const pad = 5;

      if (jy < -2 || jy + JET_H > CANVAS_H - 4) {
        gameSounds.crash();
        setPhase("dead");
        const finalScore = Math.floor(gs.score);
        setScore(finalScore);
        setHighScore((prev) => Math.max(prev, finalScore));
        return;
      }

      for (const w of gs.walls) {
        if (jx + JET_W - pad > w.x + pad && jx + pad < w.x + WALL_W - pad) {
          const topH = w.gapY - w.gapH / 2;
          const botY = w.gapY + w.gapH / 2;
          if (jy + pad < topH || jy + JET_H - pad > botY) {
            gameSounds.crash();
            setPhase("dead");
            const finalScore = Math.floor(gs.score);
            setScore(finalScore);
            setHighScore((prev) => Math.max(prev, finalScore));
            return;
          }
        }
      }

      drawScene(ctx, gs);
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [phase]);

  // Initial still frame
  useEffect(() => {
    if (phase !== "ready") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    initWorld();
    drawScene(ctx, gameState.current);
  }, [phase, initWorld]);

  const coinsEarned = Math.max(0, Math.floor(score / 10));

  return (
    <GamePageLayout title="Jet Fighter" emoji="✈️" gradientFrom="from-sky-500" gradientTo="to-slate-700">
      <div className="flex flex-col items-center">
        <div
          className="w-full rounded-2xl overflow-hidden border border-border/30 mb-4 select-none touch-none"
          onPointerDown={(e) => {
            if (phase !== "playing") return;
            e.preventDefault();
            // Release any implicit pointer capture so pointerup always reaches us.
            try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch {}
            setThrust(true);
          }}
          onPointerUp={() => phase === "playing" && setThrust(false)}
          onPointerLeave={() => phase === "playing" && setThrust(false)}
          onPointerCancel={() => phase === "playing" && setThrust(false)}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="w-full block"
            style={{ touchAction: "none" }}
          />
        </div>

        {phase === "ready" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center w-full">
            <p className="text-muted-foreground mb-2 text-sm">
              Hold to thrust upward, release to descend. Fly through the gaps!
            </p>
            <p className="text-xs text-muted-foreground mb-1">⌨️ Hold Space / ↑ / W to climb</p>
            <p className="text-xs text-muted-foreground mb-6">📱 Press & hold the screen to climb</p>
            <Button variant="hero" size="lg" onClick={startGame} className="w-full">
              ✈️ Take Off!
            </Button>
          </motion.div>
        )}

        {phase === "playing" && (
          <div className="flex items-center gap-4 w-full justify-between">
            <div className="glass rounded-lg px-3 py-1.5">
              <span className="font-display text-sm font-bold text-foreground">Score: {score}</span>
            </div>
            <p className="text-xs text-muted-foreground animate-pulse">HOLD to climb — release to dive!</p>
            <div className="glass rounded-lg px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Mach: </span>
              <span className={`font-display text-sm font-bold ${gameState.current.speed > 5.5 ? 'text-destructive' : 'text-foreground'}`}>
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
            <p className="font-display text-2xl font-bold gradient-text mb-1">Crashed!</p>
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

export default JetFighter;