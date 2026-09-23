import { motion } from "framer-motion";
import { ArrowLeft, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGamePlays } from "@/hooks/useGamePlays";

interface GamePageLayoutProps {
  title: string;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  children: React.ReactNode;
}

const GamePageLayout = ({ title, emoji, gradientFrom, gradientTo, children }: GamePageLayoutProps) => {
  const navigate = useNavigate();
  const { coins } = useGamePlays();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} opacity-[0.07] blur-[120px]`} />
        <div className={`absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr ${gradientFrom} ${gradientTo} opacity-[0.05] blur-[100px]`} />
        {/* Floating particles */}
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-1 h-1 rounded-full bg-gradient-to-r ${gradientFrom} ${gradientTo} opacity-30`}
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 80}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.1, 0.4, 0.1],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Top bar */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate("/games")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors glass rounded-xl px-4 py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-display">Back</span>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass rounded-xl px-4 py-2 flex items-center gap-2"
          >
            <Coins className="h-4 w-4 text-[hsl(var(--neon-gold))]" />
            <span className="font-display text-sm font-bold text-foreground">{coins}</span>
          </motion.div>
        </div>
      </div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative z-10 text-center mt-4 mb-8"
      >
        <span className="text-5xl mb-2 block">{emoji}</span>
        <h1 className="font-display text-3xl md:text-4xl font-bold gradient-text">{title}</h1>
      </motion.div>

      {/* Game content */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="relative z-10 flex items-center justify-center px-4 pb-16"
      >
        <div className="glass rounded-3xl p-8 md:p-12 w-full max-w-lg border border-border/30 shadow-2xl">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

export default GamePageLayout;
