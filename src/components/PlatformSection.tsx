import * as React from "react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import gtaViBanner from "@/assets/gta-vi-banner.jpg";
import fc27Banner from "@/assets/fc27-banner.jpg";
import { supabase } from "@/integrations/supabase/client";

const fetchPhantomBlade = async () => {
  const { data } = await supabase
    .from("allowed_products")
    .select("id, title, slug, image_url, platform")
    .ilike("title", "%phantom blade%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
};

const PlatformSection = () => {
  const { t } = useTranslation();
  const [api, setApi] = React.useState<CarouselApi>();
  const [current, setCurrent] = React.useState(0);
  const { data: phantomBlade } = useQuery({ queryKey: ["home-carousel-phantom-blade"], queryFn: fetchPhantomBlade });

  const plugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: false })
  );

  React.useEffect(() => {
    if (!api) return;

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  const slideCount = phantomBlade ? 3 : 2;

  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <Carousel
          setApi={setApi}
          plugins={[plugin.current]}
          className="w-full relative group"
          opts={{
            loop: true,
            align: "start",
          }}
        >
          <CarouselContent className="-ml-0 select-none">
            {/* GTA VI Slide */}
            <CarouselItem className="pl-0">
              <Link
                to="/search?q=Grand+Theft+Auto+VI"
                className="relative block h-[350px] md:h-[500px] lg:h-[600px] rounded-2xl overflow-hidden shadow-2xl"
                aria-label="Pre-order GTA VI — explore options"
              >
                <img
                  src={gtaViBanner}
                  alt="GTA VI Pre-Order"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                
                <div className="absolute inset-0 flex flex-col items-start justify-center px-8 md:px-16 gap-4 md:gap-6">
                  <div className="flex gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-md bg-primary text-primary-foreground font-display text-[10px] md:text-xs font-bold tracking-[0.2em] shadow-lg animate-pulse uppercase">
                      {t("home.gta.preOrder")}
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-md bg-destructive text-destructive-foreground font-display text-[10px] md:text-xs font-black tracking-[0.15em] shadow-lg uppercase">
                      {t("home.gta.offer")}
                    </span>
                  </div>
                  <h2 className="font-display text-4xl sm:text-6xl md:text-8xl font-black text-white tracking-widest drop-shadow-2xl leading-none uppercase">
                    GTA <span className="text-primary">VI</span>
                  </h2>
                  <p className="font-display text-sm md:text-xl text-white/90 tracking-wider max-w-xl drop-shadow-lg">
                    <Trans i18nKey="home.gta.tagline" components={{ 1: <span className="text-primary font-bold" /> }} />
                  </p>
                  <button className="h-12 px-10 rounded-md gradient-primary font-display text-sm md:text-base font-bold tracking-wider text-primary-foreground box-glow hover:opacity-90 transition-all uppercase">
                    {t("home.gta.cta")}
                  </button>
                </div>
              </Link>
            </CarouselItem>

            {/* FC 27 Slide */}
            <CarouselItem className="pl-0">
              <Link
                to="/search?q=EA+SPORTS+FC+27"
                className="relative block h-[350px] md:h-[500px] lg:h-[600px] rounded-2xl overflow-hidden shadow-2xl"
                aria-label="Pre-order EA SPORTS FC 27 — explore options"
              >
                <img
                  src={fc27Banner}
                  alt="EA SPORTS FC 27 Pre-Order"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                
                <div className="absolute inset-0 flex flex-col items-start justify-center px-8 md:px-16 gap-4 md:gap-6">
                  <div className="flex gap-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-md bg-primary text-primary-foreground font-display text-[10px] md:text-xs font-bold tracking-[0.2em] shadow-lg animate-pulse uppercase">
                      {t("home.gta.preOrder")}
                    </span>
                  </div>
                  <h2 className="font-display text-4xl sm:text-6xl md:text-8xl font-black text-white tracking-widest drop-shadow-2xl leading-none uppercase">
                    FC <span className="text-primary">27</span>
                  </h2>
                  <p className="font-display text-sm md:text-xl text-white/90 tracking-wider max-w-xl drop-shadow-lg">
                    EA SPORTS FC 27 — PRE-ORDER NOW AND BE READY FOR KICK-OFF.
                  </p>
                  <button className="h-12 px-10 rounded-md gradient-primary font-display text-sm md:text-base font-bold tracking-wider text-primary-foreground box-glow hover:opacity-90 transition-all uppercase">
                    {t("home.gta.cta")}
                  </button>
                </div>
              </Link>
            </CarouselItem>

            {/* Phantom Blade Slide */}
            {phantomBlade && (
              <CarouselItem className="pl-0">
                <Link
                  to="/search?q=Phantom+Blade+Zero"
                  className="relative block h-[350px] md:h-[500px] lg:h-[600px] rounded-2xl overflow-hidden shadow-2xl"
                  aria-label="Pre-order Phantom Blade Zero — explore options"
                >
                  <img
                    src={phantomBlade.image_url || "/placeholder.svg"}
                    alt="Phantom Blade Zero Pre-Order"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />

                  <div className="absolute inset-0 flex flex-col items-start justify-center px-8 md:px-16 gap-4 md:gap-6">
                    <h2 className="font-display text-4xl sm:text-6xl md:text-8xl font-black text-white tracking-widest drop-shadow-2xl leading-none uppercase">
                      PHANTOM BLADE <span className="text-primary">ZERO</span>
                    </h2>
                    <button className="h-12 px-10 rounded-md gradient-primary font-display text-sm md:text-base font-bold tracking-wider text-primary-foreground box-glow hover:opacity-90 transition-all uppercase">
                      {t("home.gta.cta")}
                    </button>
                  </div>
                </Link>
              </CarouselItem>
            )}
          </CarouselContent>

          {/* Navigation Dots */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {Array.from({ length: slideCount }, (_, index) => index).map((index) => (
              <button
                key={index}
                className={`w-12 h-1.5 rounded-full transition-all duration-300 ${
                  current === index 
                    ? "bg-primary w-16" 
                    : "bg-white/30 hover:bg-white/50"
                }`}
                onClick={() => api?.scrollTo(index)}
              />
            ))}
          </div>
        </Carousel>
      </div>
    </section>
  );
};

export default PlatformSection;
