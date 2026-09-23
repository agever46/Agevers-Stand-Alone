import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Shield,
  TrendingUp,
  Globe,
  DoorOpen,
  ChevronRight,
} from "lucide-react";

const benefits = [
  {
    icon: DollarSign,
    title: "Competitive Commissions",
    desc: "Keep more of your earnings with our low commission rates.",
  },
  {
    icon: Globe,
    title: "Global Reach",
    desc: "Sell to customers worldwide across all major platforms.",
  },
  {
    icon: Shield,
    title: "Secure Transactions",
    desc: "Every transaction is protected with fraud prevention.",
  },
  {
    icon: TrendingUp,
    title: "Analytics Dashboard",
    desc: "Track your sales, revenue, and performance in real-time.",
  },
  {
    icon: DoorOpen,
    title: "Join Us Today",
    desc: "We've opened our doors to all sellers worldwide — don't miss this opportunity!",
  },
];

interface SellerBenefitsProps {
  onApply: () => void;
}

const SellerBenefits = ({ onApply }: SellerBenefitsProps) => (
  <>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center mb-12"
    >
      <h1 className="font-display text-3xl md:text-5xl font-bold gradient-text mb-4">
        Sell With Us
      </h1>
    </motion.div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-12 max-w-4xl mx-auto">
      {benefits.map((b, i) => (
        <motion.div
          key={b.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
          className="glass rounded-xl p-5 text-center group hover:border-primary/30 transition-colors"
        >
          <b.icon className="h-8 w-8 mx-auto mb-3 text-primary" />
          <h3 className="font-display text-sm font-bold tracking-wider text-foreground mb-1">
            {b.title}
          </h3>
          <p className="text-xs text-muted-foreground">{b.desc}</p>
        </motion.div>
      ))}
    </div>

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="text-center"
    >
      <Button
        variant="hero"
        size="lg"
        className="gap-2 text-base px-8"
        onClick={onApply}
      >
        Apply to Sell
        <ChevronRight className="h-5 w-5" />
      </Button>
    </motion.div>
  </>
);

export default SellerBenefits;
