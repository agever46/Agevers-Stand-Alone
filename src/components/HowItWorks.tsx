import { Search, CreditCard, Key } from "lucide-react";
import { useTranslation } from "react-i18next";

const HowItWorks = () => {
  const { t } = useTranslation();
  const steps = [
    { icon: Search, step: "01", title: t("home.howItWorks.s1Title"), description: t("home.howItWorks.s1Desc"), color: "from-primary to-primary/70" },
    { icon: CreditCard, step: "02", title: t("home.howItWorks.s2Title"), description: t("home.howItWorks.s2Desc"), color: "from-[hsl(150,60%,40%)] to-[hsl(150,60%,25%)]" },
    { icon: Key, step: "03", title: t("home.howItWorks.s3Title"), description: t("home.howItWorks.s3Desc"), color: "from-[hsl(45,80%,50%)] to-[hsl(30,70%,40%)]" },
  ];
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl md:text-3xl font-bold gradient-text mb-3 tracking-wide">
            {t("home.howItWorks.title")}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto text-sm">
            {t("home.howItWorks.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-[2px] bg-gradient-to-r from-primary/30 via-primary/60 to-primary/30" />

          {steps.map((step) => (
            <div
              key={step.step}
              className="relative flex flex-col items-center text-center"
            >
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-5 relative z-10 shadow-lg`}
              >
                <step.icon className="h-7 w-7 text-white" />
              </div>

              <span className="font-display text-xs tracking-widest text-primary/60 mb-2">
                {t("home.howItWorks.step")} {step.step}
              </span>
              <h3 className="font-display text-lg font-bold text-foreground mb-2 tracking-wide">
                {step.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-[250px]">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
