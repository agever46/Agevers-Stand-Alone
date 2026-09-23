import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  coins: number;
  onDone: () => void;
}

/**
 * Fullscreen overlay: coins fly from around the screen into a treasure chest,
 * chest opens, total tallies up. Auto-closes after ~2.6s.
 */
const CoinsToChestAnimation = ({ coins, onDone }: Props) => {
  const count = Math.min(Math.max(coins, 6), 24);
  const [opened, setOpened] = useState(false);
  const [tally, setTally] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setOpened(true), 1500);
    const t2 = setTimeout(() => onDone(), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const duration = 1200;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setTally(Math.round(coins * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [coins]);

  // Spawn coins around the edges of the screen
  const coinsArr = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const radius = 320 + Math.random() * 120;
    return {
      id: i,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius - 40,
      delay: 0.05 + Math.random() * 0.5,
    };
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md"
      >
        {/* Radial glow */}
        <motion.div
          animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute w-[480px] h-[480px] rounded-full bg-gradient-radial from-amber-400/30 via-yellow-500/10 to-transparent blur-3xl"
        />

        {/* Chest */}
        <div className="relative" style={{ width: 200, height: 180 }}>
          {/* Chest lid */}
          <motion.div
            initial={{ rotateX: 0 }}
            animate={{ rotateX: opened ? -110 : 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ transformOrigin: "bottom center", transformStyle: "preserve-3d" }}
            className="absolute top-0 left-0 right-0 h-[70px] rounded-t-3xl bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900 border-4 border-amber-950 shadow-2xl flex items-center justify-center"
          >
            <div className="absolute inset-x-4 top-3 h-2 rounded-full bg-amber-500/60" />
            <div className="absolute inset-x-4 bottom-3 h-2 rounded-full bg-amber-500/60" />
            <div className="w-8 h-8 rounded-full bg-[hsl(var(--neon-gold))] border-2 border-amber-950 shadow-inner flex items-center justify-center text-amber-950 font-bold">
              ★
            </div>
          </motion.div>

          {/* Chest body */}
          <div className="absolute bottom-0 left-0 right-0 h-[120px] rounded-b-xl bg-gradient-to-b from-amber-800 via-amber-900 to-amber-950 border-4 border-amber-950 shadow-2xl overflow-hidden">
            <div className="absolute inset-x-4 top-2 h-2 rounded-full bg-amber-600/60" />
            <div className="absolute inset-x-4 bottom-4 h-2 rounded-full bg-amber-600/60" />

            {/* Glow from inside when opened */}
            <motion.div
              animate={{ opacity: opened ? [0, 1, 0.8] : 0 }}
              transition={{ duration: 0.6 }}
              className="absolute -top-6 inset-x-0 h-12 bg-gradient-to-t from-transparent via-amber-300/80 to-yellow-200 blur-xl"
            />
          </div>

          {/* Total tally — appears once opened */}
          <AnimatePresence>
            {opened && (
              <motion.div
                initial={{ scale: 0, y: 0, opacity: 0 }}
                animate={{ scale: 1, y: -120, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", damping: 12 }}
                className="absolute left-1/2 -translate-x-1/2 top-0 flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_30px_hsl(var(--neon-gold)/0.6)] border-2 border-amber-200"
              >
                <span className="text-2xl">🪙</span>
                <span className="font-display text-2xl font-black text-amber-950">+{tally}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Flying coins */}
          {coinsArr.map((c) => (
            <motion.div
              key={c.id}
              initial={{ x: c.x, y: c.y, scale: 1, opacity: 0, rotate: 0 }}
              animate={{
                x: [c.x, c.x * 0.4, 0],
                y: [c.y, c.y * 0.3 - 80, 60],
                scale: [1, 1.1, 0.3],
                opacity: [0, 1, 1, 0],
                rotate: [0, 360, 720],
              }}
              transition={{ duration: 1.4, delay: c.delay, ease: "easeIn", times: [0, 0.2, 0.85, 1] }}
              className="absolute left-1/2 top-1/2 -ml-4 -mt-4 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-600 border-2 border-amber-200 shadow-lg flex items-center justify-center text-amber-900 font-black text-sm"
            >
              $
            </motion.div>
          ))}
        </div>

        {/* Sparkles */}
        {opened && Array.from({ length: 14 }).map((_, i) => (
          <motion.div
            key={`s${i}`}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
            animate={{
              x: (Math.random() - 0.5) * 400,
              y: (Math.random() - 0.5) * 400 - 100,
              scale: [0, 1, 0],
              opacity: [1, 1, 0],
            }}
            transition={{ duration: 1.2, delay: 0.2 + Math.random() * 0.3 }}
            className="absolute text-2xl pointer-events-none"
          >
            ✨
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
};

export default CoinsToChestAnimation;