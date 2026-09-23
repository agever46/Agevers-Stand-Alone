import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import GamePageLayout from "./GamePageLayout";
import { Button } from "@/components/ui/button";
import { gameSounds } from "@/lib/gameSounds";

const SEGMENTS = [
  { label: "5 🪙", coins: 5, color: "hsl(260 100% 65%)" },
  { label: "0", coins: 0, color: "hsl(240 8% 18%)" },
  { label: "10 🪙", coins: 10, color: "hsl(45 100% 55%)" },
  { label: "0", coins: 0, color: "hsl(240 8% 22%)" },
  { label: "3 🪙", coins: 3, color: "hsl(120 60% 40%)" },
  { label: "0", coins: 0, color: "hsl(240 8% 16%)" },
  { label: "15 🪙", coins: 15, color: "hsl(0 72% 55%)" },
  { label: "1 🪙", coins: 1, color: "hsl(200 70% 50%)" },
];

interface Props {
  onComplete: (coins: number) => void;
  onClose: () => void;
}

const SpinWheel = ({ onComplete, onClose }: Props) => {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<number | null>(null);

  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);
    gameSounds.spinStart();

    // Tick sound during spin
    let tickSpeed = 60;
    const startTicks = () => {
      tickIntervalRef.current = setInterval(() => {
        gameSounds.spinTick();
        tickSpeed = Math.min(tickSpeed + 15, 400);
        if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
        if (tickSpeed < 400) startTicks();
      }, tickSpeed);
    };
    startTicks();

    const winIndex = Math.floor(Math.random() * SEGMENTS.length);
    const segDeg = 360 / SEGMENTS.length;
    const targetAngle = 360 * 5 + (360 - winIndex * segDeg - segDeg / 2);

    setRotation(targetAngle);

    setTimeout(() => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
      setSpinning(false);
      const coins = SEGMENTS[winIndex].coins;
      setResult(coins);
      if (coins > 0) gameSounds.win();
      else gameSounds.lose();
    }, 3500);
  };

  useEffect(() => {
    return () => { if (tickIntervalRef.current) clearInterval(tickIntervalRef.current); };
  }, []);

  return (
    <GamePageLayout title="Spin & Win" emoji="🎡" gradientFrom="from-amber-500" gradientTo="to-orange-600">
      <div className="flex flex-col items-center">
        {/* Pointer */}
        <motion.div
          animate={spinning ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.5, repeat: spinning ? Infinity : 0 }}
          className="text-3xl mb-2 drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]"
        >
          ▼
        </motion.div>

        {/* Wheel */}
        <div className="relative w-72 h-72 mb-8">
          {/* Outer glow ring */}
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-primary via-[hsl(var(--neon-gold))] to-primary opacity-30 blur-md" />
          
          <motion.div
            animate={{ rotate: rotation }}
            transition={{ duration: 3.5, ease: [0.17, 0.67, 0.12, 0.99] }}
            className="w-full h-full rounded-full border-4 border-primary/40 relative overflow-hidden shadow-[0_0_30px_hsl(var(--primary)/0.3)]"
          >
            {SEGMENTS.map((seg, i) => {
              const angle = (360 / SEGMENTS.length) * i;
              return (
                <div
                  key={i}
                  className="absolute w-full h-full flex items-center justify-center"
                  style={{
                    transform: `rotate(${angle}deg)`,
                    clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.tan(Math.PI / SEGMENTS.length)}% 0%)`,
                  }}
                >
                  <div className="absolute inset-0" style={{ backgroundColor: seg.color }} />
                </div>
              );
            })}
            {SEGMENTS.map((seg, i) => {
              const angle = (360 / SEGMENTS.length) * i + 360 / SEGMENTS.length / 2;
              const rad = (angle * Math.PI) / 180;
              const x = 50 + 30 * Math.sin(rad);
              const y = 50 - 30 * Math.cos(rad);
              return (
                <div
                  key={`label-${i}`}
                  className="absolute text-xs font-display font-bold text-white drop-shadow-lg"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                  }}
                >
                  {seg.label}
                </div>
              );
            })}
            {/* Center dot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background border-2 border-primary/50 shadow-lg" />
          </motion.div>
        </div>

        {result === null ? (
          <Button variant="hero" size="lg" onClick={spin} disabled={spinning} className="w-48">
            {spinning ? "Spinning..." : "🎰 SPIN!"}
          </Button>
        ) : (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 10 }}
            className="text-center"
          >
            <div className="text-5xl mb-3">{result > 0 ? "🎉" : "😅"}</div>
            <p className="font-display text-2xl font-bold gradient-text mb-1">
              {result > 0 ? "You Won!" : "No Coins"}
            </p>
            {result > 0 && (
              <p className="font-display text-lg text-[hsl(var(--neon-gold))] mb-4">{result} coins earned</p>
            )}
            <Button variant="hero" size="lg" onClick={() => onComplete(result)} className="w-full">
              {result > 0 ? "Collect Coins" : "Continue"}
            </Button>
          </motion.div>
        )}
      </div>
    </GamePageLayout>
  );
};

export default SpinWheel;
