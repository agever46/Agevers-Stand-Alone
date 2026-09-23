/**
 * Lightweight, dependency-free confetti burst. Spawns a full-screen canvas
 * overlay, animates a handful of colorful pieces falling/spinning with
 * gravity, then removes itself. Used to celebrate the moment a purchased
 * code is actually revealed to the buyer.
 */
const CONFETTI_COLORS = ["#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: "rect" | "circle";
}

export function fireConfetti(count = 150) {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const width = window.innerWidth;
  const height = window.innerHeight;
  const gravity = 0.16;
  const drag = 0.995;
  const duration = 3200;
  const startedAt = performance.now();

  const pieces: Piece[] = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: -20 - Math.random() * height * 0.4,
    vx: (Math.random() - 0.5) * 6,
    vy: 2 + Math.random() * 4,
    size: 6 + Math.random() * 6,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 14,
    shape: Math.random() > 0.5 ? "rect" : "circle",
  }));

  let rafId: number;
  const tick = (now: number) => {
    const elapsed = now - startedAt;
    ctx.clearRect(0, 0, width, height);

    const fadeStart = duration * 0.7;
    const alpha = elapsed > fadeStart ? Math.max(0, 1 - (elapsed - fadeStart) / (duration - fadeStart)) : 1;

    for (const p of pieces) {
      p.vy += gravity;
      p.vx *= drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      if (p.shape === "rect") {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (elapsed < duration) {
      rafId = requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  };
  rafId = requestAnimationFrame(tick);

  // Safety net: make sure the canvas never lingers even if the tab is
  // backgrounded and rAF stalls.
  setTimeout(() => {
    cancelAnimationFrame(rafId);
    canvas.remove();
  }, duration + 1000);
}
