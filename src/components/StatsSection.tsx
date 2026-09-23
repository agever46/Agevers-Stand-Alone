import { useEffect, useState, useRef } from "react";
import { useInView } from "framer-motion";
import { ShoppingCart, Users, Shield, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const useAnimatedCounter = (target: number, inView: boolean, duration = 2000) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const startTime = Date.now();
    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);

  return count;
};

const roundUp = (n: number, step: number) => Math.ceil(n / step) * step;

interface StatDef {
  icon: typeof ShoppingCart;
  label: string;
  value: number;
  suffix: string;
  color: string;
}

const StatsSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [productCount, setProductCount] = useState(5000);

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from("allowed_products")
        .select("id", { count: "exact", head: true });
      if (count !== null) {
        // Round up to nearest 500
        setProductCount(roundUp(count, 500));
      }
    };
    fetchCount();
  }, []);

  const stats: StatDef[] = [
    { icon: ShoppingCart, label: "Products Available", value: productCount, suffix: "+", color: "text-primary" },
    { icon: Users, label: "Happy Customers", value: 12000, suffix: "+", color: "text-[hsl(var(--neon-green))]" },
    { icon: Shield, label: "Secure Transactions", value: 100, suffix: "%", color: "text-[hsl(var(--neon-gold))]" },
    { icon: Zap, label: "Instant Delivery", value: 100, suffix: "%", color: "text-[hsl(var(--neon-glow))]" },
  ];
  return (
    <section ref={ref} className="py-16">
      <div className="container mx-auto px-4">
        <div className="glass rounded-2xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute inset-0 gradient-primary opacity-[0.03]" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 relative z-10">
            {stats.map((stat, i) => (
              <StatItem key={stat.label} stat={stat} index={i} inView={isInView} />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/60 text-right mt-4 relative z-10">
            * Delivery speed may vary depending on the results of our security verification system.
          </p>
        </div>
      </div>
    </section>
  );
};

const StatItem = ({
  stat,
  index,
  inView,
}: {
  stat: StatDef;
  index: number;
  inView: boolean;
}) => {
  const count = useAnimatedCounter(stat.value, inView);
  const Icon = stat.icon;

  return (
    <div className="flex flex-col items-center text-center gap-2">
      <Icon className={`h-8 w-8 ${stat.color}`} />
      <span className={`font-display text-3xl md:text-4xl font-bold ${stat.color}`}>
        {count.toLocaleString()}{stat.suffix}
      </span>
      <span className="font-display text-xs tracking-widest text-muted-foreground uppercase">
        {stat.label}
      </span>
    </div>
  );
};

export default StatsSection;
