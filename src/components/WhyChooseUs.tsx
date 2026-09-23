import { Shield, Zap, HeadphonesIcon, BadgePercent } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "INSTANT DELIVERY",
    description: "Get your game keys delivered instantly after purchase. No waiting, no delays.",
    gradient: "from-[hsl(45,80%,50%)] to-[hsl(30,70%,40%)]",
  },
  {
    icon: Shield,
    title: "100% SECURE",
    description: "All transactions are encrypted and protected. Your payment info is always safe.",
    gradient: "from-[hsl(150,60%,40%)] to-[hsl(150,60%,25%)]",
  },
  {
    icon: BadgePercent,
    title: "BEST PRICES",
    description: "We compare prices across multiple suppliers to bring you the lowest price guaranteed.",
    gradient: "from-primary to-primary/70",
  },
  {
    icon: HeadphonesIcon,
    title: "24/7 SUPPORT",
    description: "Our dedicated support team is always here to help you with any questions or issues.",
    gradient: "from-[hsl(280,50%,50%)] to-[hsl(280,50%,35%)]",
  },
];

const WhyChooseUs = () => {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl md:text-3xl font-bold gradient-text mb-3 tracking-wide">
            WHY CHOOSE US
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto text-sm">
            Trusted by thousands of gamers worldwide
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="glass rounded-xl p-6 text-center group cursor-default hover:-translate-y-1 transition-transform"
            >
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                <feature.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-display text-sm font-bold text-foreground mb-2 tracking-wider">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUs;
