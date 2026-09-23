import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket } from "lucide-react";

interface FlyingItem {
  id: number;
  startX: number;
  startY: number;
}

let idCounter = 0;

export const useFlyToCart = () => {
  const [flyingItems, setFlyingItems] = useState<FlyingItem[]>([]);

  const triggerFly = useCallback((e: React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement | null;
    if (!target || typeof target.getBoundingClientRect !== "function") return;
    const rect = target.getBoundingClientRect();
    const id = ++idCounter;
    setFlyingItems((prev) => [
      ...prev,
      { id, startX: rect.left + rect.width / 2, startY: rect.top + rect.height / 2 },
    ]);
    setTimeout(() => {
      setFlyingItems((prev) => prev.filter((i) => i.id !== id));
    }, 700);
  }, []);

  return { flyingItems, triggerFly };
};

export const FlyToCartOverlay = ({ items }: { items: FlyingItem[] }) => {
  const getCartTarget = () => {
    const cartEl = document.querySelector("[data-cart-icon]");
    if (cartEl) {
      const rect = cartEl.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return { x: window.innerWidth - 100, y: 32 };
  };

  return (
    <AnimatePresence>
      {items.map((item) => {
        const target = getCartTarget();
        return (
          <motion.div
            key={item.id}
            initial={{
              position: "fixed",
              left: item.startX,
              top: item.startY,
              scale: 1.2,
              opacity: 1,
              zIndex: 9999,
            }}
            animate={{
              left: target.x,
              top: target.y,
              scale: 0.5,
              opacity: 0.5,
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{
              duration: 0.6,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{ position: "fixed", pointerEvents: "none", zIndex: 9999 }}
            className="-translate-x-1/2 -translate-y-1/2"
          >
            <Rocket className="h-8 w-8 text-primary -rotate-45 drop-shadow-lg" />
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
};
