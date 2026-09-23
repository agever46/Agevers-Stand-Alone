import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GamePageLayout from "./GamePageLayout";
import { Button } from "@/components/ui/button";
import { gameSounds } from "@/lib/gameSounds";
import dogImage from "@/assets/virtual-dog.png";

interface Props {
  onComplete: (coins: number) => void;
  onClose: () => void;
  onRetry?: (coins: number) => Promise<boolean>;
}

type Need = "walk" | "water" | "food" | "pet" | "play" | "bath";

interface DogState {
  happiness: number;
  activeNeed: Need | null;
  needTimer: number;
  score: number;
  missedNeeds: number;
  needsCompleted: number;
  animation: string;
  bubbleVisible: boolean;
}

const NEEDS: Record<Need, { emoji: string; label: string; actionEmoji: string; actionLabel: string }> = {
  walk: { emoji: "🦮", label: "Walk me!", actionEmoji: "🚶", actionLabel: "Take for Walk" },
  water: { emoji: "💧", label: "Thirsty!", actionEmoji: "🥤", actionLabel: "Give Water" },
  food: { emoji: "🍖", label: "Hungry!", actionEmoji: "🥩", actionLabel: "Give Food" },
  pet: { emoji: "🤚", label: "Pet me!", actionEmoji: "💕", actionLabel: "Pet Dog" },
  play: { emoji: "🎾", label: "Play!", actionEmoji: "⚽", actionLabel: "Play Fetch" },
  bath: { emoji: "🛁", label: "Bath time!", actionEmoji: "🧼", actionLabel: "Give Bath" },
};

const NEED_KEYS = Object.keys(NEEDS) as Need[];
const GAME_DURATION = 40;
const NEED_TIMEOUT = 3500; // ms to fulfill a need
const NEED_INTERVAL_MIN = 1800;
const NEED_INTERVAL_MAX = 3200;

const CANVAS_W = 360;
const CANVAS_H = 300;

const DOG_IMG_SIZE = 120;

function drawDogImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  frame: number,
  animation: string,
  happiness: number,
) {
  ctx.save();
  ctx.translate(x, y);

  // Squash & stretch for happy — simulates jumping with body deformation
  const happyPhase = Math.sin(frame * 0.25);
  const jumpY = animation === "happy" ? Math.abs(happyPhase) * -12 : 0; // jump up
  const squashX = animation === "happy" ? 1 + (happyPhase < -0.5 ? 0.08 : happyPhase > 0.5 ? -0.04 : 0) : 1;
  const squashY = animation === "happy" ? 1 + (happyPhase < -0.5 ? -0.06 : happyPhase > 0.5 ? 0.05 : 0) : 1;
  const tilt = animation === "happy" ? Math.sin(frame * 0.15) * 0.04 :
               animation === "playing" ? Math.sin(frame * 0.2) * 0.08 : 
               animation === "walking" ? Math.sin(frame * 0.3) * 0.06 : 0;

  ctx.translate(0, jumpY);
  ctx.rotate(tilt);
  ctx.scale(squashX, squashY);


  // Draw the dog image centered
  ctx.drawImage(img, -DOG_IMG_SIZE / 2, -DOG_IMG_SIZE / 2, DOG_IMG_SIZE, DOG_IMG_SIZE);

  ctx.restore();

  // Draw animation effects (outside the transform so they float freely)
  ctx.save();
  ctx.translate(x, y + jumpY);

  if (animation === "hearts") {
    for (let i = 0; i < 3; i++) {
      const hx = -20 + i * 20 + Math.sin(frame * 0.1 + i) * 5;
      const hy = -DOG_IMG_SIZE / 2 - 15 - i * 14 - (frame % 30) * 0.8;
      ctx.font = "16px serif";
      ctx.globalAlpha = 1 - (frame % 30) / 30;
      ctx.fillText("❤️", hx, hy);
    }
    ctx.globalAlpha = 1;
  }

  if (animation === "eating") {
    ctx.font = "18px serif";
    ctx.fillText("🍖", DOG_IMG_SIZE / 2 + 5, -DOG_IMG_SIZE / 4 + Math.sin(frame * 0.5) * 4);
  }

  if (animation === "drinking") {
    ctx.font = "18px serif";
    ctx.fillText("💧", DOG_IMG_SIZE / 2 + 5, -DOG_IMG_SIZE / 4 + Math.sin(frame * 0.5) * 4);
  }

  if (animation === "playing") {
    const ballX = DOG_IMG_SIZE / 2 + 15 + Math.sin(frame * 0.2) * 20;
    const ballY = -DOG_IMG_SIZE / 4 + Math.abs(Math.sin(frame * 0.15)) * -30;
    ctx.font = "18px serif";
    ctx.fillText("🎾", ballX, ballY);
  }

  if (animation === "bathing") {
    for (let i = 0; i < 5; i++) {
      const bx = -DOG_IMG_SIZE / 3 + i * 16;
      const by = -DOG_IMG_SIZE / 4 + Math.sin(frame * 0.2 + i) * 6;
      ctx.font = "12px serif";
      ctx.globalAlpha = 0.7;
      ctx.fillText("🫧", bx, by);
    }
    ctx.globalAlpha = 1;
  }

  if (animation === "walking") {
    ctx.font = "14px serif";
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.4 - i * 0.12;
      ctx.fillText("🐾", -DOG_IMG_SIZE / 2 - 15 - i * 20, DOG_IMG_SIZE / 2 - 10);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

const VirtualDog = ({ onComplete, onRetry }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"ready" | "playing" | "done">("ready");
  const [score, setScore] = useState(0);
  const [happiness, setHappiness] = useState(100);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [activeNeed, setActiveNeed] = useState<Need | null>(null);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [animation, setAnimation] = useState("idle");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [missedNeeds, setMissedNeeds] = useState(0);
  const [buttonOrder, setButtonOrder] = useState<Need[]>([...NEED_KEYS]);

  const shuffleButtons = useCallback(() => {
    setButtonOrder(prev => {
      const arr = [...prev];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
  }, []);

  const animRef = useRef<number>(0);
  const frameRef = useRef(0);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const needTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);
  const scoreRef = useRef(0);

  const showNeed = useCallback(() => {
    if (!isPlayingRef.current) return;
    // After 5 fulfilled needs, show TWO needs at once (fake-outs)
    const need = NEED_KEYS[Math.floor(Math.random() * NEED_KEYS.length)];
    setActiveNeed(need);
    setBubbleVisible(true);
    gameSounds.click();

    // Dynamic timeout — gets shorter as score increases
    const dynamicTimeout = Math.max(2000, NEED_TIMEOUT - scoreRef.current * 40);

    // Timeout — if not fulfilled
    needTimeoutRef.current = setTimeout(() => {
      if (!isPlayingRef.current) return;
      setMissedNeeds((m) => {
        const newM = m + 1;
        if (newM >= 4) {
          isPlayingRef.current = false;
          setPhase("done");
        }
        return newM;
      });
      setHappiness((h) => Math.max(0, h - 20));
      setAnimation("idle");
      setBubbleVisible(false);
      setActiveNeed(null);
      gameSounds.lose();
      scheduleNextNeed();
    }, dynamicTimeout);
  }, []);

  const scheduleNextNeed = useCallback(() => {
    if (!isPlayingRef.current) return;
    // Intervals get shorter as score rises
    const speedFactor = Math.max(0.4, 1 - scoreRef.current * 0.02);
    const delay = (NEED_INTERVAL_MIN + Math.random() * (NEED_INTERVAL_MAX - NEED_INTERVAL_MIN)) * speedFactor;
    needTimerRef.current = setTimeout(() => {
      showNeed();
    }, delay);
  }, [showNeed]);

  const handleAction = useCallback((need: Need) => {
    if (!activeNeed) return;

    if (activeNeed !== need) {
      // Wrong guess — penalty
      setHappiness((h) => Math.max(0, h - 10));
      setAnimation("idle");
      gameSounds.lose();
      shuffleButtons();
      return;
    }

    // Clear timeout
    if (needTimeoutRef.current) clearTimeout(needTimeoutRef.current);

    const animMap: Record<Need, string> = {
      walk: "walking",
      water: "drinking",
      food: "eating",
      pet: "hearts",
      play: "playing",
      bath: "bathing",
    };

    setAnimation(animMap[need]);
    setActionFeedback(NEEDS[need].actionEmoji);
    setBubbleVisible(false);
    setActiveNeed(null);
    setScore((s) => { scoreRef.current = s + 5; return s + 5; });
    setHappiness((h) => Math.min(100, h + 8));
    gameSounds.win();
    shuffleButtons();

    // Reset animation after a bit
    setTimeout(() => {
      setAnimation("happy");
      setActionFeedback(null);
      setTimeout(() => setAnimation("idle"), 800);
    }, 1200);

    scheduleNextNeed();
  }, [activeNeed, scheduleNextNeed, shuffleButtons]);

  const startGame = useCallback(() => {
    setScore(0);
    scoreRef.current = 0;
    setHappiness(100);
    setTimeLeft(GAME_DURATION);
    setActiveNeed(null);
    setBubbleVisible(false);
    setAnimation("happy");
    setMissedNeeds(0);
    setActionFeedback(null);
    isPlayingRef.current = true;
    setPhase("playing");

    setTimeout(() => setAnimation("idle"), 1000);

    // Game timer
    let t = GAME_DURATION;
    gameTimerRef.current = setInterval(() => {
      t--;
      setTimeLeft(t);
      if (t <= 0) {
        isPlayingRef.current = false;
        setPhase("done");
      }
    }, 1000);

    // First need after short delay
    needTimerRef.current = setTimeout(() => showNeed(), 2000);
  }, [showNeed]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      if (needTimerRef.current) clearTimeout(needTimerRef.current);
      if (needTimeoutRef.current) clearTimeout(needTimeoutRef.current);
      cancelAnimationFrame(animRef.current);
      isPlayingRef.current = false;
    };
  }, []);

  // Stop timers when phase changes to done
  useEffect(() => {
    if (phase === "done") {
      isPlayingRef.current = false;
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      if (needTimerRef.current) clearTimeout(needTimerRef.current);
      if (needTimeoutRef.current) clearTimeout(needTimeoutRef.current);
    }
  }, [phase]);

  // Load dog image
  const dogImgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.src = dogImage;
    img.onload = () => { dogImgRef.current = img; };
  }, []);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = () => {
      frameRef.current++;

      // Background — park scene
      const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      skyGrad.addColorStop(0, "#87CEEB");
      skyGrad.addColorStop(0.6, "#B0E0E6");
      skyGrad.addColorStop(1, "#90EE90");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Sun
      ctx.fillStyle = "#FFD700";
      ctx.beginPath();
      ctx.arc(CANVAS_W - 50, 45, 25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFF8DC";
      ctx.beginPath();
      ctx.arc(CANVAS_W - 50, 45, 20, 0, Math.PI * 2);
      ctx.fill();

      // Clouds
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      [60, 180, 300].forEach((cx, i) => {
        const cy = 35 + i * 10;
        const ox = (frameRef.current * 0.1 + i * 50) % (CANVAS_W + 60) - 30;
        ctx.beginPath();
        ctx.arc(ox, cy, 18, 0, Math.PI * 2);
        ctx.arc(ox + 16, cy - 4, 14, 0, Math.PI * 2);
        ctx.arc(ox - 14, cy - 2, 12, 0, Math.PI * 2);
        ctx.fill();
      });

      // Ground
      ctx.fillStyle = "#5dad3c";
      ctx.fillRect(0, CANVAS_H - 80, CANVAS_W, 80);
      ctx.fillStyle = "#4a9632";
      ctx.fillRect(0, CANVAS_H - 80, CANVAS_W, 4);

      // Grass tufts
      ctx.fillStyle = "#6bc44e";
      for (let i = 0; i < 15; i++) {
        const gx = (i * 27 + 10) % CANVAS_W;
        const gy = CANVAS_H - 75 + (i % 3) * 20;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx - 3, gy - 8);
        ctx.lineTo(gx + 3, gy - 8);
        ctx.closePath();
        ctx.fill();
      }

      // Tree
      ctx.fillStyle = "#6B4226";
      ctx.fillRect(40, CANVAS_H - 130, 12, 55);
      ctx.fillStyle = "#2E8B57";
      ctx.beginPath();
      ctx.arc(46, CANVAS_H - 140, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3CB371";
      ctx.beginPath();
      ctx.arc(38, CANVAS_H - 135, 20, 0, Math.PI * 2);
      ctx.fill();

      // Dog house (far right)
      ctx.fillStyle = "#8B4513";
      ctx.fillRect(CANVAS_W - 70, CANVAS_H - 115, 55, 40);
      ctx.fillStyle = "#A0522D";
      ctx.beginPath();
      ctx.moveTo(CANVAS_W - 75, CANVAS_H - 115);
      ctx.lineTo(CANVAS_W - 42, CANVAS_H - 140);
      ctx.lineTo(CANVAS_W - 10, CANVAS_H - 115);
      ctx.closePath();
      ctx.fill();
      // Door
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(CANVAS_W - 42, CANVAS_H - 85, 12, Math.PI, 0);
      ctx.fillRect(CANVAS_W - 54, CANVAS_H - 85, 24, 10);
      ctx.fill();

      // Draw dog
      if (dogImgRef.current) {
        drawDogImage(ctx, dogImgRef.current, CANVAS_W / 2, CANVAS_H - 75, frameRef.current, animation, happiness);
      }

      // Happiness bar
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.roundRect(CANVAS_W / 2 - 50, 10, 100, 12, 6);
      ctx.fill();
      const barColor = happiness > 60 ? "#4ade80" : happiness > 30 ? "#fbbf24" : "#ef4444";
      ctx.fillStyle = barColor;
      ctx.beginPath();
      ctx.roundRect(CANVAS_W / 2 - 48, 12, Math.max(0, (happiness / 100) * 96), 8, 4);
      ctx.fill();

      // Happiness label
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(`❤️ ${Math.round(happiness)}%`, CANVAS_W / 2, 36);

      // Timer
      ctx.textAlign = "right";
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = timeLeft <= 10 ? "#ef4444" : "#fff";
      ctx.fillText(`⏱ ${timeLeft}s`, CANVAS_W - 10, 24);

      // Score
      ctx.textAlign = "left";
      ctx.fillStyle = "#fff";
      ctx.fillText(`⭐ ${score}`, 10, 24);

      // Need bubble
      if (bubbleVisible && activeNeed) {
        const bx = CANVAS_W / 2 + 40;
        const by = CANVAS_H - 170;
        // Bubble
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.roundRect(bx - 25, by - 20, 50, 40, 12);
        ctx.fill();
        ctx.strokeStyle = "#ddd";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Tail
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.moveTo(bx - 5, by + 20);
        ctx.lineTo(bx - 10, by + 30);
        ctx.lineTo(bx + 5, by + 20);
        ctx.closePath();
        ctx.fill();
        // Emoji
        ctx.font = "22px serif";
        ctx.textAlign = "center";
        ctx.fillText(NEEDS[activeNeed].emoji, bx, by + 8);

        // Urgency ring
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5 + Math.sin(frameRef.current * 0.15) * 0.3;
        ctx.beginPath();
        ctx.arc(bx, by, 28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Action feedback
      if (actionFeedback) {
        ctx.font = "32px serif";
        ctx.textAlign = "center";
        const fy = CANVAS_H - 160 - (frameRef.current % 30) * 0.8;
        ctx.globalAlpha = Math.max(0, 1 - (frameRef.current % 30) / 30);
        ctx.fillText(actionFeedback, CANVAS_W / 2 + 10, fy);
        ctx.globalAlpha = 1;
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [animation, happiness, timeLeft, score, bubbleVisible, activeNeed, actionFeedback]);

  const coinsWon = Math.floor(score * 0.2);

  return (
    <GamePageLayout
      title="Virtual Puppy"
      emoji="🐕"
      gradientFrom="from-amber-400"
      gradientTo="to-orange-500"
    >
      <div className="flex flex-col items-center gap-4">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="rounded-xl border border-border/30 w-full max-w-[360px]"
        />

        {phase === "ready" && (
          <div className="text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              Take care of your virtual puppy! 🐶<br />
              Fulfill its needs before time runs out.
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Watch for thought bubbles — tap the matching action!</p>
              <p>Miss 4 needs and the game is over. It gets faster!</p>
            </div>
            <Button onClick={startGame} variant="hero" size="lg">
              🐕 Meet Your Puppy
            </Button>
          </div>
        )}

        {phase === "playing" && (
          <div className="w-full">
            {!activeNeed && (
              <p className="text-center text-xs text-muted-foreground mb-3">
                Wait for your puppy's next request... 🐾
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {buttonOrder.map((need) => (
                 <motion.button
                  key={need}
                  layout
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleAction(need)}
                  disabled={!activeNeed}
                  className="flex flex-col items-center gap-1 rounded-xl p-3 transition-all text-center glass border border-border/30"
                >
                  <span className="text-xl">{NEEDS[need].actionEmoji}</span>
                  <span className="text-[10px] font-display font-bold text-foreground">{NEEDS[need].actionLabel}</span>
                </motion.button>
              ))}
            </div>
            <div className="flex justify-center gap-2 mt-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className={`text-sm ${i < missedNeeds ? "opacity-100" : "opacity-20"}`}>
                  💔
                </span>
              ))}
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="text-center space-y-3">
            <div className="text-5xl mb-2">{score >= 30 ? "🏆" : score >= 15 ? "🎉" : "😅"}</div>
            <p className="font-display text-xl font-bold gradient-text">
              {score >= 30 ? "Best Dog Parent!" : score >= 15 ? "Good Job!" : "Keep Practicing!"}
            </p>
            <p className="text-muted-foreground text-sm">
              Needs fulfilled: <strong className="text-foreground">{Math.floor(score / 5)}</strong>
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
              }} variant="hero">🔄 Play Again</Button>
              <Button onClick={() => onComplete(coinsWon)} variant="outline">Collect & Exit</Button>
            </div>
          </div>
        )}
      </div>
    </GamePageLayout>
  );
};

export default VirtualDog;
