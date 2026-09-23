import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import mascot from "@/assets/agevers-mascot.png";

interface AgeversLoaderProps {
  className?: string;
}

const AgeversLoader = ({ className = "" }: AgeversLoaderProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90;
        return prev + Math.random() * 15;
      });
    }, 300);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <motion.img
        src={mascot}
        alt="Loading"
        className="h-24 w-24 object-contain drop-shadow-[0_0_15px_rgba(139,92,246,0.6)]"
        animate={{
          y: [0, -8, 0],
          rotate: [-3, 3, -3],
        }}
        transition={{
          duration: 1.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <p className="font-display text-lg font-bold tracking-wider text-foreground animate-pulse">
        Loading...
      </p>
      <Progress value={progress} className="w-48 h-2" />
    </div>
  );
};

export default AgeversLoader;
