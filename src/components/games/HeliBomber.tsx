import { useState, useRef, useCallback, useEffect } from "react";
import GamePageLayout from "./GamePageLayout";
import { Button } from "@/components/ui/button";
import { gameSounds } from "@/lib/gameSounds";

interface Props {
  onComplete: (coins: number) => void;
  onClose: () => void;
  onRetry?: (coins: number) => Promise<boolean>;
}

interface Tank {
  id: number;
  x: number;
  alive: boolean;
  hitTime?: number;
  shootCooldown: number;
  type: "normal" | "fast" | "heavy";
}

interface Bomb {
  x: number;
  y: number;
  vy: number;
  mega?: boolean;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Explosion {
  x: number;
  y: number;
  frame: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface PowerUp {
  x: number;
  y: number;
  vx: number;
  bob: number; // phase for vertical bobbing
  kind: "mega" | "laser";
}

interface Truck {
  id: number;
  x: number;
  alive: boolean;
  hp: number;
  hitTime?: number;
  burstCooldown: number; // frames until next burst
  burstShotsLeft: number; // shots remaining in current burst
  burstShotTimer: number; // frames until next shot in burst
}

const CANVAS_W = 600;
const CANVAS_H = 400;
const HELI_W = 56;
const HELI_H = 32;
const TANK_W = 48;
const TANK_H = 28;
const BOMB_R = 5;
const BULLET_R = 3;
const GROUND_Y = CANVAS_H - 40;
const GAME_DURATION = 30;
const BOMB_COOLDOWN_FRAMES = 120; // 2 seconds at 60fps
const MEGA_BOMB_RADIUS = 90; // AoE radius for upgraded bombs
const POWERUP_W = 26;
const POWERUP_H = 26;
const POWERUP_SPAWN_FRAMES = 360; // every ~6s a power-up flies in
const MEGA_BOMBS_PER_PICKUP = 1;
const TRUCK_W = 72;
const TRUCK_H = 36;
const TRUCK_MAX_HP = 3;
const TRUCK_POINTS = 5;
const LASER_W = 18; // width of vertical laser column
const LASER_DURATION_FRAMES = 180; // 3 seconds of beam time per pickup
const LASER_DAMAGE_INTERVAL = 6; // frames between truck HP ticks while in beam

const NEON_COLORS = {
  cyan: "#00f0ff",
  magenta: "#ff00ff",
  orange: "#ff6600",
  red: "#ff2244",
  yellow: "#ffee00",
  green: "#00ff88",
  pink: "#ff44aa",
};

const PARTICLE_COLORS = [
  "#ff4400",
  "#ff6600",
  "#ff8800",
  "#ffaa00",
  "#ffcc00",
  "#ff2200",
  "#ff0044",
  "#ff00ff",
  "#ff6644",
];

const TANK_TYPES: Record<
  string,
  { color: string; barrelColor: string; glowColor: string; speed: number; shootInterval: number; points: number }
> = {
  normal: {
    color: "#1a4a2a",
    barrelColor: "#0d3018",
    glowColor: NEON_COLORS.green,
    speed: 0.8,
    shootInterval: 120,
    points: 1,
  },
  fast: {
    color: "#1a3a6a",
    barrelColor: "#0d2050",
    glowColor: NEON_COLORS.cyan,
    speed: 1.5,
    shootInterval: 90,
    points: 2,
  },
  heavy: {
    color: "#5a2010",
    barrelColor: "#3a0d05",
    glowColor: NEON_COLORS.orange,
    speed: 0.4,
    shootInterval: 180,
    points: 3,
  },
};

// ── Parallax layers ──
function drawParallaxBackground(ctx: CanvasRenderingContext2D, frame: number, camOffsetX: number = 0) {
  // Sky gradient - deep cyberpunk
  const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  skyGrad.addColorStop(0, "#050510");
  skyGrad.addColorStop(0.3, "#0a0a2e");
  skyGrad.addColorStop(0.6, "#10102a");
  skyGrad.addColorStop(1, "#0d1a30");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars with twinkle
  for (let i = 0; i < 40; i++) {
    const sx = (i * 97 + 13) % CANVAS_W;
    const sy = (i * 43 + 7) % (CANVAS_H * 0.4);
    const twinkle = 0.2 + 0.3 * Math.sin(frame * 0.03 + i * 1.7);
    ctx.fillStyle = `rgba(200,220,255,${twinkle})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.8 + (i % 3) * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Layer 1: Distant city silhouettes (slowest scroll) — parallax factor 0.2
  const layer1Offset = (frame * 0.15 - camOffsetX * 0.2) % CANVAS_W;
  ctx.fillStyle = "#0c0c20";
  for (let i = -1; i < 3; i++) {
    const bx = i * 200 - layer1Offset;
    const heights = [90, 120, 70, 140, 100, 60, 130, 80];
    for (let j = 0; j < heights.length; j++) {
      const h = heights[j];
      const w = 18 + (j % 3) * 6;
      ctx.fillRect(bx + j * 25, GROUND_Y - h, w, h);
      // Tiny neon windows
      ctx.fillStyle = `rgba(0,240,255,${0.15 + 0.1 * Math.sin(frame * 0.02 + j)})`;
      for (let wy = 0; wy < h - 10; wy += 12) {
        for (let wx = 2; wx < w - 4; wx += 6) {
          if ((j + wy + wx) % 3 !== 0) {
            ctx.fillRect(bx + j * 25 + wx, GROUND_Y - h + wy + 4, 3, 4);
          }
        }
      }
      ctx.fillStyle = "#0c0c20";
    }
  }

  // Layer 2: Closer buildings (medium scroll) — parallax factor 0.5
  const layer2Offset = (frame * 0.4 - camOffsetX * 0.5) % CANVAS_W;
  ctx.fillStyle = "#0f0f28";
  for (let i = -1; i < 4; i++) {
    const bx = i * 160 - layer2Offset;
    const heights = [50, 80, 35, 65, 45, 75];
    for (let j = 0; j < heights.length; j++) {
      const h = heights[j];
      const w = 22 + (j % 2) * 8;
      ctx.fillRect(bx + j * 28, GROUND_Y - h, w, h);
      // Neon accent lines
      ctx.strokeStyle = j % 2 === 0 ? "rgba(255,0,255,0.15)" : "rgba(0,240,255,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + j * 28, GROUND_Y - h);
      ctx.lineTo(bx + j * 28 + w, GROUND_Y - h);
      ctx.stroke();
      ctx.fillStyle = "#0f0f28";
    }
  }

  // Layer 3: Moving clouds / smog (fastest) — parallax factor 0.85
  const layer3Offset = (frame * 0.8 - camOffsetX * 0.85) % CANVAS_W;
  ctx.globalAlpha = 0.08;
  for (let i = -1; i < 5; i++) {
    const cx = i * 150 - layer3Offset + 30;
    const cy = 60 + (i % 3) * 40;
    ctx.fillStyle = NEON_COLORS.magenta;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 60, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = NEON_COLORS.cyan;
    ctx.beginPath();
    ctx.ellipse(cx + 40, cy + 8, 40, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ground - neon grid style
  const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_H);
  groundGrad.addColorStop(0, "#0a1a10");
  groundGrad.addColorStop(1, "#050d08");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);

  // Neon ground line
  ctx.strokeStyle = NEON_COLORS.green;
  ctx.lineWidth = 2;
  ctx.shadowColor = NEON_COLORS.green;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(CANVAS_W, GROUND_Y);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Grid lines on ground
  ctx.strokeStyle = "rgba(0,255,136,0.08)";
  ctx.lineWidth = 1;
  const gridOffset = (frame * 1.5 - camOffsetX) % 30;
  for (let i = 0; i < CANVAS_W; i += 30) {
    ctx.beginPath();
    ctx.moveTo(i - gridOffset, GROUND_Y);
    ctx.lineTo(i - gridOffset, CANVAS_H);
    ctx.stroke();
  }
  for (let y = GROUND_Y + 10; y < CANVAS_H; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
    ctx.stroke();
  }
}

// ── Draw helicopter with tilt ──
function drawHeli(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, vy: number) {
  ctx.save();
  ctx.translate(x + HELI_W / 2, y + HELI_H / 2);

  // Tilt based on vertical movement
  const tilt = Math.max(-0.25, Math.min(0.25, vy * 0.06));
  ctx.rotate(tilt);
  ctx.translate(-HELI_W / 2, -HELI_H / 2);

  // Neon glow under heli
  ctx.shadowColor = NEON_COLORS.cyan;
  ctx.shadowBlur = 15;

  // Body
  ctx.fillStyle = "#1a3a2a";
  ctx.beginPath();
  ctx.ellipse(HELI_W / 2, HELI_H / 2 + 2, HELI_W / 2 - 4, HELI_H / 2 - 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body neon outline
  ctx.strokeStyle = NEON_COLORS.cyan;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(HELI_W / 2, HELI_H / 2 + 2, HELI_W / 2 - 4, HELI_H / 2 - 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Cockpit
  ctx.fillStyle = "#00ccff";
  ctx.shadowColor = NEON_COLORS.cyan;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(HELI_W - 12, HELI_H / 2, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Tail
  ctx.fillStyle = "#1a3a2a";
  ctx.fillRect(0, HELI_H / 2 - 3, 14, 6);
  ctx.fillStyle = "#0d2018";
  ctx.fillRect(-2, HELI_H / 2 - 10, 5, 14);

  // Tail neon
  ctx.strokeStyle = NEON_COLORS.magenta;
  ctx.lineWidth = 1;
  ctx.strokeRect(-2, HELI_H / 2 - 10, 5, 14);

  // Main rotor (animated)
  ctx.strokeStyle = NEON_COLORS.cyan;
  ctx.lineWidth = 2;
  ctx.shadowColor = NEON_COLORS.cyan;
  ctx.shadowBlur = 6;
  const rotorPhase = (frame * 0.5) % Math.PI;
  const rotorLen = 30 * Math.cos(rotorPhase);
  ctx.beginPath();
  ctx.moveTo(HELI_W / 2 - rotorLen, -2);
  ctx.lineTo(HELI_W / 2 + rotorLen, -2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Engine glow (exhaust)
  ctx.fillStyle = `rgba(0,240,255,${0.3 + 0.2 * Math.sin(frame * 0.3)})`;
  ctx.beginPath();
  ctx.arc(4, HELI_H / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Skids
  ctx.strokeStyle = NEON_COLORS.green;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, HELI_H);
  ctx.lineTo(HELI_W - 8, HELI_H);
  ctx.stroke();

  ctx.restore();
}

// ── Draw tank with neon styling ──
function drawTank(ctx: CanvasRenderingContext2D, x: number, type: Tank["type"], heliX: number, heliY: number) {
  const t = TANK_TYPES[type];
  const y = GROUND_Y - TANK_H;

  ctx.save();
  ctx.translate(x, y);

  // Glow
  ctx.shadowColor = t.glowColor;
  ctx.shadowBlur = 10;

  // Tracks
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.roundRect(0, TANK_H - 10, TANK_W, 10, 3);
  ctx.fill();

  ctx.strokeStyle = t.glowColor;
  ctx.lineWidth = 0.5;
  for (let i = 4; i < TANK_W; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, TANK_H - 10);
    ctx.lineTo(i, TANK_H);
    ctx.stroke();
  }

  // Hull
  ctx.fillStyle = t.color;
  ctx.beginPath();
  ctx.moveTo(4, TANK_H - 10);
  ctx.lineTo(TANK_W - 4, TANK_H - 10);
  ctx.lineTo(TANK_W - 10, TANK_H - 18);
  ctx.lineTo(10, TANK_H - 18);
  ctx.closePath();
  ctx.fill();

  // Hull neon outline
  ctx.strokeStyle = t.glowColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(4, TANK_H - 10);
  ctx.lineTo(TANK_W - 4, TANK_H - 10);
  ctx.lineTo(TANK_W - 10, TANK_H - 18);
  ctx.lineTo(10, TANK_H - 18);
  ctx.closePath();
  ctx.stroke();

  // Turret
  ctx.fillStyle = t.barrelColor;
  ctx.beginPath();
  ctx.arc(TANK_W / 2, TANK_H - 20, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = t.glowColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Barrel aiming at helicopter
  const turretX = x + TANK_W / 2;
  const turretY = y + TANK_H - 20;
  const angle = Math.atan2(heliY - turretY, heliX - turretX);
  const clampedAngle = Math.max(-Math.PI * 0.9, Math.min(-Math.PI * 0.1, angle));

  ctx.strokeStyle = t.glowColor;
  ctx.lineWidth = 3;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(TANK_W / 2, TANK_H - 20);
  ctx.lineTo(TANK_W / 2 + Math.cos(clampedAngle) * 18, TANK_H - 20 + Math.sin(clampedAngle) * 18);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ── Draw heavy gun truck (stage 2 enemy) ──
function drawTruck(ctx: CanvasRenderingContext2D, x: number, hp: number, heliX: number, heliY: number) {
  const y = GROUND_Y - TRUCK_H;
  ctx.save();
  ctx.translate(x, y);

  ctx.shadowColor = NEON_COLORS.red;
  ctx.shadowBlur = 12;

  // Wheels
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(12, TRUCK_H - 4, 6, 0, Math.PI * 2);
  ctx.arc(TRUCK_W - 12, TRUCK_H - 4, 6, 0, Math.PI * 2);
  ctx.arc(TRUCK_W - 26, TRUCK_H - 4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = NEON_COLORS.red;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Truck bed
  ctx.fillStyle = "#3a1010";
  ctx.fillRect(4, 14, TRUCK_W - 8, TRUCK_H - 20);
  ctx.strokeStyle = NEON_COLORS.red;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(4, 14, TRUCK_W - 8, TRUCK_H - 20);

  // Cab
  ctx.fillStyle = "#4a1a1a";
  ctx.fillRect(TRUCK_W - 24, 4, 20, 18);
  ctx.strokeRect(TRUCK_W - 24, 4, 20, 18);
  // Window
  ctx.fillStyle = "rgba(0,240,255,0.4)";
  ctx.fillRect(TRUCK_W - 21, 7, 14, 8);

  // Mounted minigun (multi-barrel) — aims at heli
  const gunX = 22;
  const gunY = 12;
  const angle = Math.atan2(heliY - (y + gunY), heliX - (x + gunX));
  const clampedAngle = Math.max(-Math.PI * 0.95, Math.min(-Math.PI * 0.05, angle));
  ctx.save();
  ctx.translate(gunX, gunY);
  ctx.rotate(clampedAngle);
  // Gun base
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = NEON_COLORS.red;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Triple barrels
  ctx.strokeStyle = NEON_COLORS.orange;
  ctx.lineWidth = 2;
  ctx.shadowColor = NEON_COLORS.orange;
  ctx.shadowBlur = 6;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(2, i * 3);
    ctx.lineTo(22, i * 3);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();

  // HP pips on top
  for (let i = 0; i < TRUCK_MAX_HP; i++) {
    ctx.fillStyle = i < hp ? NEON_COLORS.green : "rgba(255,255,255,0.15)";
    ctx.shadowColor = NEON_COLORS.green;
    ctx.shadowBlur = i < hp ? 4 : 0;
    ctx.fillRect(8 + i * 8, -4, 6, 3);
  }
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ── Neon explosion ──
function drawExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const progress = frame / 20;
  const radius = 12 + progress * 25;
  const alpha = 1 - progress;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.shadowColor = NEON_COLORS.orange;
  ctx.shadowBlur = 20;

  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, NEON_COLORS.yellow);
  grad.addColorStop(0.3, NEON_COLORS.orange);
  grad.addColorStop(0.6, NEON_COLORS.red);
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Neon ring
  ctx.strokeStyle = NEON_COLORS.magenta;
  ctx.lineWidth = 2;
  ctx.globalAlpha = alpha * 0.6;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ── Draw particles ──
function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── HUD ──
function drawHUD(ctx: CanvasRenderingContext2D, score: number, timeLeft: number, health: number) {
  // HUD background
  ctx.fillStyle = "rgba(5,5,20,0.75)";
  ctx.fillRect(0, 0, CANVAS_W, 32);

  // Bottom border glow
  ctx.strokeStyle = NEON_COLORS.cyan;
  ctx.lineWidth = 1;
  ctx.shadowColor = NEON_COLORS.cyan;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(0, 32);
  ctx.lineTo(CANVAS_W, 32);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Score
  ctx.font = "bold 13px 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.shadowColor = NEON_COLORS.orange;
  ctx.shadowBlur = 8;
  ctx.fillStyle = NEON_COLORS.orange;
  ctx.fillText(`⚡ SCORE: ${score}`, 12, 20);
  ctx.shadowBlur = 0;

  // Health bar
  const hbX = CANVAS_W / 2 - 60;
  const hbW = 120;
  const hbH = 10;
  const hbY = 11;
  ctx.fillStyle = "rgba(255,0,68,0.2)";
  ctx.fillRect(hbX, hbY, hbW, hbH);
  ctx.fillStyle = health > 50 ? NEON_COLORS.green : health > 25 ? NEON_COLORS.orange : NEON_COLORS.red;
  ctx.shadowColor = ctx.fillStyle as string;
  ctx.shadowBlur = 8;
  ctx.fillRect(hbX, hbY, hbW * (health / 100), hbH);
  ctx.strokeStyle = NEON_COLORS.cyan;
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  ctx.strokeRect(hbX, hbY, hbW, hbH);

  // Health label
  ctx.font = "bold 8px 'Courier New', monospace";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText("HULL", CANVAS_W / 2, 19);

  // Timer
  ctx.font = "bold 13px 'Courier New', monospace";
  ctx.textAlign = "right";
  ctx.shadowColor = timeLeft <= 10 ? NEON_COLORS.red : NEON_COLORS.cyan;
  ctx.shadowBlur = 8;
  ctx.fillStyle = timeLeft <= 10 ? NEON_COLORS.red : NEON_COLORS.cyan;
  ctx.fillText(`⏱ ${timeLeft}s`, CANVAS_W - 12, 20);
  ctx.shadowBlur = 0;

  // Controls hint at bottom
  ctx.fillStyle = "rgba(5,5,20,0.6)";
  ctx.fillRect(0, CANVAS_H - 18, CANVAS_W, 18);
  ctx.font = "10px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,240,255,0.5)";
  ctx.fillText("WASD/Arrows = Move  |  Space = Bomb  |  Touch = Move+Bomb", CANVAS_W / 2, CANVAS_H - 5);
}

// Bomb cooldown bar — drawn below the HUD
function drawBombCooldown(
  ctx: CanvasRenderingContext2D,
  cooldown: number,
  megaBombs: number = 0,
  laserFrames: number = 0,
) {
  const ready = cooldown <= 0;
  const progress = ready ? 1 : 1 - cooldown / BOMB_COOLDOWN_FRAMES;
  const barW = 160;
  const barH = 8;
  const x = CANVAS_W / 2 - barW / 2;
  const y = 40;

  // Background
  ctx.fillStyle = "rgba(5,5,20,0.7)";
  ctx.fillRect(x - 4, y - 12, barW + 8, barH + 18);

  // Label
  ctx.font = "bold 9px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = ready ? NEON_COLORS.green : NEON_COLORS.cyan;
  ctx.shadowColor = ctx.fillStyle as string;
  ctx.shadowBlur = 6;
  ctx.fillText(ready ? "💣 BOMB READY" : "💣 RELOADING…", CANVAS_W / 2, y - 2);
  ctx.shadowBlur = 0;

  // Bar background
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x, y, barW, barH);

  // Bar fill
  ctx.fillStyle = ready ? NEON_COLORS.green : NEON_COLORS.magenta;
  ctx.shadowColor = ctx.fillStyle as string;
  ctx.shadowBlur = 8;
  ctx.fillRect(x, y, barW * progress, barH);
  ctx.shadowBlur = 0;

  // Border
  ctx.strokeStyle = NEON_COLORS.cyan;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barW, barH);

  // Mega bomb counter to the right of the bar
  if (megaBombs > 0) {
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = NEON_COLORS.yellow;
    ctx.shadowColor = NEON_COLORS.yellow;
    ctx.shadowBlur = 8;
    ctx.fillText(`★ MEGA x${megaBombs}`, x + barW + 10, y + barH);
    ctx.shadowBlur = 0;
  }

  // Laser indicator (seconds remaining)
  if (laserFrames > 0) {
    const secs = (laserFrames / 60).toFixed(1);
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = NEON_COLORS.cyan;
    ctx.shadowColor = NEON_COLORS.cyan;
    ctx.shadowBlur = 10;
    ctx.fillText(`⚡ LASER ${secs}s`, x - 10, y + barH);
    ctx.shadowBlur = 0;
  }
}

const HeliBomber = ({ onComplete, onRetry }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"ready" | "playing" | "dead" | "done">("ready");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [stage, setStage] = useState(1);
  const [showStageBanner, setShowStageBanner] = useState<null | { stage: number; text: string }>(null);

  const gameState = useRef({
    heliX: CANVAS_W / 2 - HELI_W / 2,
    heliY: 60,
    heliVY: 0,
    heliVX: 0,
    health: 100,
    tanks: [] as Tank[],
    trucks: [] as Truck[],
    bombs: [] as Bomb[],
    bullets: [] as Bullet[],
    explosions: [] as Explosion[],
    particles: [] as Particle[],
    powerUps: [] as PowerUp[],
    keys: new Set<string>(),
    bombCooldown: 0,
    megaBombs: 0,
    powerUpTimer: 0,
    laserFrames: 0, // remaining frames of active laser beam
    laserDamageTick: 0, // counter for periodic truck damage in beam
    score: 0,
    frame: 0,
    nextTankId: 0,
    spawnTimer: 0,
    timeLeft: GAME_DURATION,
    stage: 1,
    clearing: false, // true after timer hits 0 — no new enemies spawn, finish remaining
    lastTimestamp: 0,
    shakeIntensity: 0,
    // Camera follow state
    camX: 0,
    camY: 0,
  });

  const animRef = useRef<number>(0);

  const spawnParticles = useCallback((x: number, y: number, count: number) => {
    const gs = gameState.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      gs.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 25 + Math.random() * 20,
        maxLife: 45,
        size: 2 + Math.random() * 3,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      });
    }
  }, []);

  const spawnTank = useCallback(() => {
    const gs = gameState.current;
    const side = Math.random() > 0.5 ? -TANK_W : CANVAS_W;
    const rand = Math.random();
    // Stage 2 has tougher tank mix
    const type: Tank["type"] =
      gs.stage >= 2
        ? rand < 0.4
          ? "heavy"
          : rand < 0.75
          ? "fast"
          : "normal"
        : rand < 0.15
        ? "heavy"
        : rand < 0.4
        ? "fast"
        : "normal";
    gs.tanks.push({
      id: gs.nextTankId++,
      x: side,
      alive: true,
      shootCooldown: Math.floor(Math.random() * 60) + 30,
      type,
    });
  }, []);

  const spawnTruck = useCallback(() => {
    const gs = gameState.current;
    const side = Math.random() > 0.5 ? -TRUCK_W : CANVAS_W;
    gs.trucks.push({
      id: gs.nextTankId++,
      x: side,
      alive: true,
      hp: TRUCK_MAX_HP,
      burstCooldown: 90 + Math.floor(Math.random() * 60),
      burstShotsLeft: 0,
      burstShotTimer: 0,
    });
  }, []);

  const startGame = useCallback(() => {
    const gs = gameState.current;
    gs.heliX = CANVAS_W / 2 - HELI_W / 2;
    gs.heliY = 60;
    gs.heliVY = 0;
    gs.heliVX = 0;
    gs.health = 100;
    gs.tanks = [];
    gs.trucks = [];
    gs.bombs = [];
    gs.bullets = [];
    gs.explosions = [];
    gs.particles = [];
    gs.powerUps = [];
    gs.bombCooldown = 0;
    gs.megaBombs = 0;
    gs.powerUpTimer = 0;
    gs.laserFrames = 0;
    gs.laserDamageTick = 0;
    gs.score = 0;
    gs.frame = 0;
    gs.nextTankId = 0;
    gs.spawnTimer = 0;
    gs.timeLeft = GAME_DURATION;
    gs.stage = 1;
    gs.clearing = false;
    gs.lastTimestamp = performance.now();
    gs.shakeIntensity = 0;
    gs.camX = 0;
    gs.camY = 0;
    gs.keys.clear();
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setStage(1);
    setShowStageBanner({ stage: 1, text: "STAGE 1 — START!" });
    setTimeout(() => setShowStageBanner(null), 2000);
    setPhase("playing");
  }, []);

  // Key handlers
  useEffect(() => {
    if (phase !== "playing") return;
    const gs = gameState.current;

    const onDown = (e: KeyboardEvent) => {
      gs.keys.add(e.key.toLowerCase());
      if (e.key === " " || e.key === "ArrowDown") e.preventDefault();
      // Discrete bomb drop on Space press (with 2s cooldown)
      if (e.key === " " && !e.repeat && gs.bombCooldown <= 0) {
        gameSounds.bombDrop();
        const isMega = gs.megaBombs > 0;
        if (isMega) gs.megaBombs--;
        gs.bombs.push({
          x: gs.heliX + HELI_W / 2,
          y: gs.heliY + HELI_H,
          vy: 3,
          mega: isMega,
        });
        gs.bombCooldown = BOMB_COOLDOWN_FRAMES;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      gs.keys.delete(e.key.toLowerCase());
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [phase]);

  // Touch controls
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gs = gameState.current;

    let touchId: number | null = null;
    let touchStartX = 0;
    let touchStartY = 0;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      touchId = touch.identifier;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      if (gs.bombCooldown <= 0) {
        gameSounds.bombDrop();
        const isMega = gs.megaBombs > 0;
        if (isMega) gs.megaBombs--;
        gs.bombs.push({
          x: gs.heliX + HELI_W / 2,
          y: gs.heliY + HELI_H,
          vy: 3,
          mega: isMega,
        });
        gs.bombCooldown = BOMB_COOLDOWN_FRAMES;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchId) {
          const rect = canvas.getBoundingClientRect();
          const scaleX = CANVAS_W / rect.width;
          const scaleY = CANVAS_H / rect.height;
          const dx = (touch.clientX - touchStartX) * scaleX;
          const dy = (touch.clientY - touchStartY) * scaleY;
          gs.heliX = Math.max(0, Math.min(CANVAS_W - HELI_W, gs.heliX + dx * 0.3));
          gs.heliY = Math.max(10, Math.min(CANVAS_H - HELI_H - 80, gs.heliY + dy * 0.3));
          touchStartX = touch.clientX;
          touchStartY = touch.clientY;
        }
      }
    };

    const onTouchEnd = () => {
      touchId = null;
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [phase]);

  // Game loop
  useEffect(() => {
    if (phase !== "playing") return;
    const gs = gameState.current;

    const loop = () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;

      gs.frame++;

      // Timer — when it hits 0, stop spawning but keep going until enemies cleared
      if (gs.frame % 60 === 0 && !gs.clearing) {
        gs.timeLeft--;
        setTimeLeft(gs.timeLeft);
        if (gs.timeLeft <= 0) {
          gs.timeLeft = 0;
          gs.clearing = true;
        }
      }

      // ── Physics Engine: Acceleration + Friction ──
      // Helicopter feels heavy — thrust builds up gradually, friction decays momentum
      const THRUST = 0.55; // acceleration per frame when key held
      const FRICTION = 0.82; // velocity multiplier each frame (lower = more drag)
      const MAX_SPEED = 6.5; // terminal velocity cap

      let thrustX = 0,
        thrustY = 0;
      if (gs.keys.has("arrowleft") || gs.keys.has("a")) thrustX -= THRUST;
      if (gs.keys.has("arrowright") || gs.keys.has("d")) thrustX += THRUST;
      if (gs.keys.has("arrowup") || gs.keys.has("w")) thrustY -= THRUST;
      if (gs.keys.has("arrowdown") || gs.keys.has("s")) thrustY += THRUST;

      // Apply thrust then friction
      gs.heliVX = (gs.heliVX + thrustX) * FRICTION;
      gs.heliVY = (gs.heliVY + thrustY) * FRICTION;

      // Clamp to max speed
      const spd = Math.sqrt(gs.heliVX * gs.heliVX + gs.heliVY * gs.heliVY);
      if (spd > MAX_SPEED) {
        gs.heliVX = (gs.heliVX / spd) * MAX_SPEED;
        gs.heliVY = (gs.heliVY / spd) * MAX_SPEED;
      }

      gs.heliX += gs.heliVX;
      gs.heliY += gs.heliVY;

      // Current speed after clamping (used for ghost effect later)
      const currentSpd = Math.sqrt(gs.heliVX * gs.heliVX + gs.heliVY * gs.heliVY);

      // Tick bomb cooldown
      if (gs.bombCooldown > 0) gs.bombCooldown--;

      // Soft boundary: push back from walls instead of hard clamp
      if (gs.heliX < 0) {
        gs.heliX = 0;
        gs.heliVX *= -0.3;
      }
      if (gs.heliX > CANVAS_W - HELI_W) {
        gs.heliX = CANVAS_W - HELI_W;
        gs.heliVX *= -0.3;
      }
      if (gs.heliY < 10) {
        gs.heliY = 10;
        gs.heliVY *= -0.3;
      }
      if (gs.heliY > CANVAS_H - HELI_H - 80) {
        gs.heliY = CANVAS_H - HELI_H - 80;
        gs.heliVY *= -0.3;
      }

      // ── Camera Follow (lerp toward helicopter center) ──
      const WORLD_W = CANVAS_W * 2; // virtual world is 2x canvas wide
      const CAM_LERP = 0.07; // smoothness (lower = more lag/cinematic)
      const targetCamX = gs.heliX + HELI_W / 2 - CANVAS_W / 2;
      const targetCamY = gs.heliY + HELI_H / 2 - CANVAS_H / 2;
      gs.camX += (targetCamX - gs.camX) * CAM_LERP;
      gs.camY += (targetCamY - gs.camY) * CAM_LERP;
      // Clamp camera so it doesn't go beyond world edges
      gs.camX = Math.max(0, Math.min(WORLD_W - CANVAS_W, gs.camX));
      gs.camY = Math.max(0, Math.min(0, gs.camY)); // vertical: keep sky visible

      // ── Spawn enemies (only while timer still running) ──
      if (!gs.clearing) {
        gs.spawnTimer++;
        const stageScale = gs.stage >= 3 ? 0.5 : gs.stage >= 2 ? 0.7 : 1; // stage 3 spawns 2x faster
        const spawnRate = Math.max(35, (120 - gs.frame * 0.02) * stageScale);
        if (gs.spawnTimer >= spawnRate) {
          gs.spawnTimer = 0;
          // Stage 2: 40% truck chance, Stage 3: 60% truck chance
          const truckChance = gs.stage >= 3 ? 0.6 : gs.stage >= 2 ? 0.4 : 0;
          if (truckChance > 0 && Math.random() < truckChance) {
            spawnTruck();
          } else {
            spawnTank();
          }
        }
      }

      // ── Update tanks ──
      const heliCenterX = gs.heliX + HELI_W / 2;
      const heliCenterY = gs.heliY + HELI_H / 2;

      for (const tank of gs.tanks) {
        if (!tank.alive) continue;
        const t = TANK_TYPES[tank.type];

        if (tank.x < CANVAS_W / 2 - TANK_W) tank.x += t.speed;
        else if (tank.x > CANVAS_W / 2 + TANK_W) tank.x -= t.speed;

        tank.shootCooldown--;
        if (tank.shootCooldown <= 0) {
          tank.shootCooldown = t.shootInterval + Math.floor(Math.random() * 40);
          const turretX = tank.x + TANK_W / 2;
          const turretY = GROUND_Y - TANK_H + TANK_H - 20;
          const angle = Math.atan2(heliCenterY - turretY, heliCenterX - turretX);
          const clampedAngle = Math.max(-Math.PI * 0.9, Math.min(-Math.PI * 0.1, angle));
          const bulletSpeed = 4;
          gameSounds.tankShoot();
          gs.bullets.push({
            x: turretX + Math.cos(clampedAngle) * 18,
            y: turretY + Math.sin(clampedAngle) * 18,
            vx: Math.cos(clampedAngle) * bulletSpeed,
            vy: Math.sin(clampedAngle) * bulletSpeed,
          });
        }
      }

      gs.tanks = gs.tanks.filter((t) => t.alive || (t.hitTime && gs.frame - t.hitTime < 20));

      // ── Update trucks (move + fire bursts) ──
      for (const truck of gs.trucks) {
        if (!truck.alive) continue;
        const TRUCK_SPEED = 0.5;
        if (truck.x < CANVAS_W / 2 - TRUCK_W) truck.x += TRUCK_SPEED;
        else if (truck.x > CANVAS_W / 2 + TRUCK_W) truck.x -= TRUCK_SPEED;

        // Burst firing: every burstCooldown frames, fire a 4-shot burst
        if (truck.burstShotsLeft > 0) {
          truck.burstShotTimer--;
          if (truck.burstShotTimer <= 0) {
            const gunX = truck.x + 22;
            const gunY = GROUND_Y - TRUCK_H + 12;
            const angle = Math.atan2(heliCenterY - gunY, heliCenterX - gunX);
            const clampedAngle = Math.max(-Math.PI * 0.95, Math.min(-Math.PI * 0.05, angle));
            // Tiny spread per shot in the burst
            const spread = (Math.random() - 0.5) * 0.18;
            const a = clampedAngle + spread;
            const speed = 5;
            gameSounds.tankShoot();
            gs.bullets.push({
              x: gunX + Math.cos(a) * 22,
              y: gunY + Math.sin(a) * 22,
              vx: Math.cos(a) * speed,
              vy: Math.sin(a) * speed,
            });
            truck.burstShotsLeft--;
            truck.burstShotTimer = 6; // frames between burst shots
          }
        } else {
          truck.burstCooldown--;
          if (truck.burstCooldown <= 0) {
            truck.burstShotsLeft = 4;
            truck.burstShotTimer = 0;
            truck.burstCooldown = 180 + Math.floor(Math.random() * 80);
          }
        }
      }
      gs.trucks = gs.trucks.filter((t) => t.alive || (t.hitTime && gs.frame - t.hitTime < 25));

      // ── Update bombs ──
      for (const bomb of gs.bombs) {
        bomb.vy += 0.15;
        bomb.y += bomb.vy;
      }

      // Bomb-tank collisions (mega bombs have AoE)
      gs.bombs = gs.bombs.filter((bomb) => {
        if (bomb.y > CANVAS_H) return false;
        const tankY = GROUND_Y - TANK_H;
        const truckY = GROUND_Y - TRUCK_H;

        // Direct hit check (or ground hit for mega = also detonates)
        let detonated = false;
        let detonateX = bomb.x;
        let detonateY = bomb.y;
        for (const tank of gs.tanks) {
          if (!tank.alive) continue;
          if (bomb.x > tank.x && bomb.x < tank.x + TANK_W && bomb.y > tankY && bomb.y < tankY + TANK_H) {
            detonated = true;
            detonateX = tank.x + TANK_W / 2;
            detonateY = tankY + TANK_H / 2;
            break;
          }
        }
        if (!detonated) {
          for (const truck of gs.trucks) {
            if (!truck.alive) continue;
            if (bomb.x > truck.x && bomb.x < truck.x + TRUCK_W && bomb.y > truckY && bomb.y < truckY + TRUCK_H) {
              detonated = true;
              detonateX = truck.x + TRUCK_W / 2;
              detonateY = truckY + TRUCK_H / 2;
              break;
            }
          }
        }
        // Mega bombs also detonate on impact with the ground
        if (!detonated && bomb.mega && bomb.y >= GROUND_Y) {
          detonated = true;
          detonateX = bomb.x;
          detonateY = GROUND_Y;
        }
        if (!detonated) return true;

        gameSounds.bombExplode();
        if (bomb.mega) {
          // Big AoE — wipe all tanks within MEGA_BOMB_RADIUS
          for (const tank of gs.tanks) {
            if (!tank.alive) continue;
            const tcx = tank.x + TANK_W / 2;
            const tcy = tankY + TANK_H / 2;
            const dx = tcx - detonateX;
            const dy = tcy - detonateY;
            if (dx * dx + dy * dy <= MEGA_BOMB_RADIUS * MEGA_BOMB_RADIUS) {
              tank.alive = false;
              tank.hitTime = gs.frame;
              gs.score += TANK_TYPES[tank.type].points;
              gs.explosions.push({ x: tcx, y: tcy, frame: 0 });
              spawnParticles(tcx, tcy, 18);
            }
          }
          // Trucks: mega bomb destroys them outright within radius
          for (const truck of gs.trucks) {
            if (!truck.alive) continue;
            const tcx = truck.x + TRUCK_W / 2;
            const tcy = truckY + TRUCK_H / 2;
            const dx = tcx - detonateX;
            const dy = tcy - detonateY;
            if (dx * dx + dy * dy <= MEGA_BOMB_RADIUS * MEGA_BOMB_RADIUS) {
              truck.hp = 0;
              truck.alive = false;
              truck.hitTime = gs.frame;
              gs.score += TRUCK_POINTS;
              gs.explosions.push({ x: tcx, y: tcy, frame: 0 });
              spawnParticles(tcx, tcy, 30);
            }
          }
          // Big central blast — multiple expanding rings + particles
          gs.explosions.push({ x: detonateX, y: detonateY, frame: 0 });
          gs.explosions.push({ x: detonateX, y: detonateY - 10, frame: -5 });
          gs.explosions.push({ x: detonateX, y: detonateY + 5, frame: -10 });
          spawnParticles(detonateX, detonateY, 60);
          setScore(gs.score);
          gs.shakeIntensity = 16;
        } else {
          // Normal bomb — single tank kill already handled above
          for (const tank of gs.tanks) {
            if (!tank.alive) continue;
            if (bomb.x > tank.x && bomb.x < tank.x + TANK_W && bomb.y > tankY && bomb.y < tankY + TANK_H) {
              tank.alive = false;
              tank.hitTime = gs.frame;
              gs.score += TANK_TYPES[tank.type].points;
              setScore(gs.score);
              break;
            }
          }
          // Normal bomb on truck: shave 1 HP, kill at 0
          for (const truck of gs.trucks) {
            if (!truck.alive) continue;
            if (bomb.x > truck.x && bomb.x < truck.x + TRUCK_W && bomb.y > truckY && bomb.y < truckY + TRUCK_H) {
              truck.hp--;
              spawnParticles(truck.x + TRUCK_W / 2, truckY + TRUCK_H / 2, 10);
              if (truck.hp <= 0) {
                truck.alive = false;
                truck.hitTime = gs.frame;
                gs.score += TRUCK_POINTS;
                setScore(gs.score);
              }
              break;
            }
          }
          gs.explosions.push({ x: detonateX, y: detonateY, frame: 0 });
          spawnParticles(detonateX, detonateY, 20);
          gs.shakeIntensity = 8;
        }
        return false;
      });

      // ── Stage clearing logic ──
      if (gs.clearing) {
        const anyAlive =
          gs.tanks.some((t) => t.alive) || gs.trucks.some((t) => t.alive);
        if (!anyAlive) {
          if (gs.stage === 1) {
            // Advance to stage 2
            gs.stage = 2;
            gs.timeLeft = GAME_DURATION;
            gs.clearing = false;
            gs.frame = 0;
            gs.spawnTimer = 0;
            setStage(2);
            setTimeLeft(GAME_DURATION);
            setShowStageBanner({
              stage: 2,
              text: "STAGE 1 CLEARED!  STAGE 2 — Trucks Incoming!",
            });
            setTimeout(() => setShowStageBanner(null), 3000);
          } else if (gs.stage === 2) {
            // Advance to stage 3 — lasers + tougher waves
            gs.stage = 3;
            gs.timeLeft = GAME_DURATION;
            gs.clearing = false;
            gs.frame = 0;
            gs.spawnTimer = 0;
            gs.powerUpTimer = POWERUP_SPAWN_FRAMES - 60; // first laser drops quickly
            setStage(3);
            setTimeLeft(GAME_DURATION);
            setShowStageBanner({
              stage: 3,
              text: "STAGE 2 CLEARED!  STAGE 3 — Lasers Online!",
            });
            setTimeout(() => setShowStageBanner(null), 3000);
          } else {
            // Final stage cleared
            setPhase("done");
            return;
          }
        }
      }

      // ── Laser beam: continuous vertical column from heli down to ground ──
      if (gs.laserFrames > 0) {
        gs.laserFrames--;
        gs.laserDamageTick++;
        const beamCenterX = gs.heliX + HELI_W / 2;
        const beamTop = gs.heliY + HELI_H;
        const halfW = LASER_W / 2;

        // Instant-kill tanks in beam column
        const tankY = GROUND_Y - TANK_H;
        for (const tank of gs.tanks) {
          if (!tank.alive) continue;
          if (
            tank.x + TANK_W > beamCenterX - halfW &&
            tank.x < beamCenterX + halfW &&
            tankY + TANK_H > beamTop
          ) {
            tank.alive = false;
            tank.hitTime = gs.frame;
            gs.score += TANK_TYPES[tank.type].points;
            gs.explosions.push({ x: tank.x + TANK_W / 2, y: tankY + TANK_H / 2, frame: 0 });
            spawnParticles(tank.x + TANK_W / 2, tankY + TANK_H / 2, 14);
            setScore(gs.score);
          }
        }

        // Trucks take damage periodically while in beam
        if (gs.laserDamageTick % LASER_DAMAGE_INTERVAL === 0) {
          const truckY = GROUND_Y - TRUCK_H;
          for (const truck of gs.trucks) {
            if (!truck.alive) continue;
            if (
              truck.x + TRUCK_W > beamCenterX - halfW &&
              truck.x < beamCenterX + halfW &&
              truckY + TRUCK_H > beamTop
            ) {
              truck.hp--;
              spawnParticles(beamCenterX, truckY + TRUCK_H / 2, 6);
              if (truck.hp <= 0) {
                truck.alive = false;
                truck.hitTime = gs.frame;
                gs.score += TRUCK_POINTS;
                gs.explosions.push({ x: truck.x + TRUCK_W / 2, y: truckY + TRUCK_H / 2, frame: 0 });
                setScore(gs.score);
              }
            }
          }
        }

        // Laser also vaporises incoming bullets in its column
        gs.bullets = gs.bullets.filter((b) => {
          if (
            b.x > beamCenterX - halfW &&
            b.x < beamCenterX + halfW &&
            b.y > beamTop
          ) {
            spawnParticles(b.x, b.y, 3);
            return false;
          }
          return true;
        });
      }

      // ── Spawn & update power-ups ──
      gs.powerUpTimer++;
      if (gs.powerUpTimer >= POWERUP_SPAWN_FRAMES) {
        gs.powerUpTimer = 0;
        const fromLeft = Math.random() > 0.5;
        // Stage 3 spawns laser power-ups; earlier stages spawn mega-bomb crates
        const kind: PowerUp["kind"] = gs.stage >= 3 ? "laser" : "mega";
        gs.powerUps.push({
          x: fromLeft ? -POWERUP_W : CANVAS_W + POWERUP_W,
          y: 70 + Math.random() * 140,
          vx: fromLeft ? 1.2 : -1.2,
          bob: Math.random() * Math.PI * 2,
          kind,
        });
      }
      gs.powerUps = gs.powerUps.filter((p) => {
        p.x += p.vx;
        p.bob += 0.05;
        const drawY = p.y + Math.sin(p.bob) * 6;
        // Heli pickup
        const hx = gs.heliX + HELI_W / 2;
        const hy = gs.heliY + HELI_H / 2;
        const dx = p.x - hx;
        const dy = drawY - hy;
        if (dx * dx + dy * dy < (POWERUP_W / 2 + HELI_W / 2.5) ** 2) {
          if (p.kind === "laser") {
            gs.laserFrames = Math.min(gs.laserFrames + LASER_DURATION_FRAMES, LASER_DURATION_FRAMES * 2);
          } else {
            gs.megaBombs += MEGA_BOMBS_PER_PICKUP;
          }
          gameSounds.win();
          spawnParticles(p.x, drawY, 16);
          return false;
        }
        return p.x > -POWERUP_W * 2 && p.x < CANVAS_W + POWERUP_W * 2;
      });

      // ── Update bullets ──
      gs.bullets = gs.bullets.filter((b) => {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < -10 || b.x > CANVAS_W + 10 || b.y < -10 || b.y > CANVAS_H + 10) return false;

        if (b.x > gs.heliX + 4 && b.x < gs.heliX + HELI_W - 4 && b.y > gs.heliY + 4 && b.y < gs.heliY + HELI_H - 4) {
          gs.health -= 25;
          gs.shakeIntensity = 5;
          spawnParticles(gs.heliX + HELI_W / 2, gs.heliY + HELI_H / 2, 8);
          if (gs.health <= 0) {
            gs.explosions.push({ x: gs.heliX + HELI_W / 2, y: gs.heliY + HELI_H / 2, frame: 0 });
            spawnParticles(gs.heliX + HELI_W / 2, gs.heliY + HELI_H / 2, 30);
            gameSounds.heliHit();
            setPhase("dead");
          }
          return false;
        }
        return true;
      });

      // ── Update explosions ──
      gs.explosions = gs.explosions.filter((e) => {
        e.frame++;
        return e.frame < 20;
      });

      // ── Update particles ──
      gs.particles = gs.particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life--;
        return p.life > 0;
      });

      // ── Screen shake decay ──
      gs.shakeIntensity *= 0.85;
      if (gs.shakeIntensity < 0.3) gs.shakeIntensity = 0;

      // ── Draw ──
      ctx.save();

      // Apply screen shake
      if (gs.shakeIntensity > 0) {
        const sx = (Math.random() - 0.5) * gs.shakeIntensity * 2;
        const sy = (Math.random() - 0.5) * gs.shakeIntensity * 2;
        ctx.translate(sx, sy);
      }

      // ── Camera offset (world-space pan) ──
      // camY is intentionally subtle — mostly X-axis follow
      const camOffsetX = -gs.camX * 0.15; // dampen X scroll so world feels huge but bounded
      const camOffsetY = -gs.camY * 0.5;

      // Parallax background (passes cam offset so layers scroll at different rates)
      drawParallaxBackground(ctx, gs.frame, camOffsetX);

      // Tanks
      for (const tank of gs.tanks) {
        if (tank.alive) {
          drawTank(ctx, tank.x, tank.type, heliCenterX, heliCenterY);
        }
      }

      // Trucks (stage 2)
      for (const truck of gs.trucks) {
        if (truck.alive) {
          drawTruck(ctx, truck.x, truck.hp, heliCenterX, heliCenterY);
        }
      }

      // Bombs with neon glow (mega bombs are bigger and yellow)
      for (const bomb of gs.bombs) {
        const r = bomb.mega ? BOMB_R * 1.8 : BOMB_R;
        const glow = bomb.mega ? NEON_COLORS.yellow : NEON_COLORS.magenta;
        ctx.shadowColor = glow;
        ctx.shadowBlur = bomb.mega ? 18 : 8;
        ctx.fillStyle = bomb.mega ? "#3a2a00" : "#222";
        ctx.beginPath();
        ctx.arc(bomb.x, bomb.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = glow;
        ctx.lineWidth = bomb.mega ? 2 : 1;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Fin
        ctx.fillStyle = bomb.mega ? NEON_COLORS.orange : "#444";
        ctx.fillRect(bomb.x - 3, bomb.y - r - 3, 6, 4);
        if (bomb.mega) {
          ctx.fillStyle = NEON_COLORS.yellow;
          ctx.font = "bold 8px 'Courier New', monospace";
          ctx.textAlign = "center";
          ctx.fillText("M", bomb.x, bomb.y + 3);
        }
      }

      // Power-ups (floating mega-bomb crates with neon star)
      for (const p of gs.powerUps) {
        const drawY = p.y + Math.sin(p.bob) * 6;
        const isLaser = p.kind === "laser";
        const glowColor = isLaser ? NEON_COLORS.cyan : NEON_COLORS.yellow;
        const bodyColor = isLaser ? "#001a2a" : "#3a2a00";
        const icon = isLaser ? "⚡" : "★";
        ctx.save();
        ctx.translate(p.x, drawY);
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 18 + Math.sin(gs.frame * 0.15) * 6;
        // Crate body
        ctx.fillStyle = bodyColor;
        ctx.fillRect(-POWERUP_W / 2, -POWERUP_H / 2, POWERUP_W, POWERUP_H);
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(-POWERUP_W / 2, -POWERUP_H / 2, POWERUP_W, POWERUP_H);
        // Icon
        ctx.fillStyle = glowColor;
        ctx.font = "bold 16px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(icon, 0, 1);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // Bullets (neon tracer)
      for (const b of gs.bullets) {
        ctx.shadowColor = NEON_COLORS.red;
        ctx.shadowBlur = 10;
        ctx.fillStyle = NEON_COLORS.red;
        ctx.beginPath();
        ctx.arc(b.x, b.y, BULLET_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = NEON_COLORS.orange;
        ctx.beginPath();
        ctx.arc(b.x - b.vx * 0.5, b.y - b.vy * 0.5, BULLET_R * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Explosions
      for (const e of gs.explosions) {
        drawExplosion(ctx, e.x, e.y, e.frame);
      }

      // Particles
      drawParticles(ctx, gs.particles);

      // Velocity ghost: faint ghost ahead of heli showing momentum direction
      const ghostAlpha = Math.min(0.35, (currentSpd / MAX_SPEED) * 0.45);
      if (ghostAlpha > 0.05) {
        ctx.save();
        ctx.globalAlpha = ghostAlpha;
        drawHeli(ctx, gs.heliX + gs.heliVX * 4, gs.heliY + gs.heliVY * 4, gs.frame, gs.heliVY);
        ctx.restore();
      }

      // Laser beam (drawn under the heli so it looks emitted from the underside)
      if (gs.laserFrames > 0) {
        const beamX = gs.heliX + HELI_W / 2;
        const beamTop = gs.heliY + HELI_H;
        const beamBottom = GROUND_Y;
        const flicker = 0.85 + Math.random() * 0.15;
        const halfW = (LASER_W / 2) * flicker;
        ctx.save();
        // Outer wide glow
        const grad = ctx.createLinearGradient(beamX - halfW * 2, 0, beamX + halfW * 2, 0);
        grad.addColorStop(0, "rgba(0,240,255,0)");
        grad.addColorStop(0.5, "rgba(0,240,255,0.55)");
        grad.addColorStop(1, "rgba(0,240,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(beamX - halfW * 2, beamTop, halfW * 4, beamBottom - beamTop);
        // Core beam
        ctx.shadowColor = NEON_COLORS.cyan;
        ctx.shadowBlur = 22;
        ctx.fillStyle = "rgba(220,255,255,0.95)";
        ctx.fillRect(beamX - halfW, beamTop, halfW * 2, beamBottom - beamTop);
        // White hot center line
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(beamX - 1.2, beamTop, 2.4, beamBottom - beamTop);
        // Impact flare at ground
        ctx.shadowBlur = 30;
        ctx.fillStyle = NEON_COLORS.cyan;
        ctx.beginPath();
        ctx.ellipse(beamX, beamBottom, 18 + Math.sin(gs.frame * 0.4) * 3, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Helicopter
      drawHeli(ctx, gs.heliX, gs.heliY, gs.frame, gs.heliVY);

      // HUD
      drawHUD(ctx, gs.score, gs.timeLeft, gs.health);
      drawBombCooldown(ctx, gs.bombCooldown, gs.megaBombs, gs.laserFrames);

      ctx.restore();

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [phase, spawnTank, spawnTruck, spawnParticles]);

  const coinsWon = Math.floor(score * 0.5);

  return (
    <GamePageLayout title="Heli Bomber" emoji="🚁" gradientFrom="from-cyan-500" gradientTo="to-purple-700">
      <div className="flex flex-col items-center gap-6">
        {/* Cyberpunk container with glowing border */}
        <div
          ref={containerRef}
          className="relative rounded-xl p-[2px] w-full max-w-[600px]"
          style={{
            background: "linear-gradient(135deg, #00f0ff, #ff00ff, #00f0ff)",
            boxShadow:
              "0 0 20px rgba(0,240,255,0.3), 0 0 40px rgba(255,0,255,0.15), inset 0 0 20px rgba(0,240,255,0.1)",
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="rounded-xl w-full block"
            style={{
              imageRendering: "pixelated",
              background: "#050510",
            }}
          />
          {/* Stage badge */}
          {phase === "playing" && (
            <div
              className="absolute top-2 left-2 px-3 py-1 rounded-md font-bold text-xs tracking-wider pointer-events-none"
              style={{
                background: "rgba(5,5,20,0.8)",
                color: stage === 1 ? "#00ffaa" : "#ff4477",
                border: `1px solid ${stage === 1 ? "#00ffaa" : "#ff4477"}`,
                boxShadow: `0 0 8px ${stage === 1 ? "#00ffaa" : "#ff4477"}`,
                fontFamily: "'Courier New', monospace",
              }}
            >
              STAGE {stage}
            </div>
          )}
          {/* Stage banner overlay */}
          {showStageBanner && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-300"
              style={{ background: "rgba(5,5,20,0.55)" }}
            >
              <div
                className="px-6 py-4 rounded-xl text-center font-bold"
                style={{
                  background: "linear-gradient(135deg, rgba(255,0,255,0.15), rgba(0,240,255,0.15))",
                  border: "2px solid #ff00ff",
                  boxShadow: "0 0 30px rgba(255,0,255,0.6), 0 0 60px rgba(0,240,255,0.3)",
                  fontFamily: "'Courier New', monospace",
                }}
              >
                <div className="text-2xl text-[#ffee00]" style={{ textShadow: "0 0 12px #ffee00" }}>
                  {showStageBanner.stage === 1 ? "🚁 GO!" : "Great Job!"}
                </div>
                <div className="text-sm mt-2 text-[#00f0ff]" style={{ textShadow: "0 0 8px #00f0ff" }}>
                  {showStageBanner.text}
                </div>
              </div>
            </div>
          )}
        </div>

        {phase === "ready" && (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              Fly your helicopter and drop bombs on tanks!
              <br />
              Dodge their bullets — you have a health bar now.
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                🎮 <strong>WASD / Arrows</strong> — Move helicopter
              </p>
              <p>
                💣 <strong>Space / Tap</strong> — Drop bomb
              </p>
              <p>
                📱 <strong>Touch & drag</strong> — Move on mobile
              </p>
            </div>
            <Button onClick={startGame} variant="hero" size="lg">
              🚁 Start Mission
            </Button>
          </div>
        )}

        {phase === "dead" && (
          <div className="text-center space-y-4">
            <p className="font-display text-xl font-bold text-destructive">💥 Shot Down!</p>
            <p className="text-muted-foreground">
              Score: <span className="font-bold text-foreground">{score}</span> tanks destroyed
            </p>
            <p className="text-sm text-[hsl(var(--neon-gold))]">
              🪙 Coins earned: <strong>{coinsWon}</strong>
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={async () => {
                if (onRetry) {
                  const ok = await onRetry(coinsWon);
                  if (ok) startGame();
                } else {
                  startGame();
                }
              }} variant="hero">
                🔄 Retry
              </Button>
              <Button onClick={() => onComplete(coinsWon)} variant="outline">
                Collect & Exit
              </Button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="text-center space-y-4">
            <p className="font-display text-xl font-bold text-[hsl(var(--neon-green))]">✅ Mission Complete!</p>
            <p className="text-muted-foreground">
              Tanks destroyed: <span className="font-bold text-foreground">{score}</span>
            </p>
            <p className="text-sm text-[hsl(var(--neon-gold))]">
              🪙 Coins earned: <strong>{coinsWon}</strong>
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={async () => {
                if (onRetry) {
                  const ok = await onRetry(coinsWon);
                  if (ok) startGame();
                } else {
                  startGame();
                }
              }} variant="hero">
                🔄 Play Again
              </Button>
              <Button onClick={() => onComplete(coinsWon)} variant="outline">
                Collect & Exit
              </Button>
            </div>
          </div>
        )}
      </div>
    </GamePageLayout>
  );
};

export default HeliBomber;
