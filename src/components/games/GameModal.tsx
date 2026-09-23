import { motion } from "framer-motion";
import { X } from "lucide-react";

interface GameModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const GameModal = ({ title, onClose, children }: GameModalProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="glass rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto relative"
    >
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </motion.div>
  </motion.div>
);

export default GameModal;
