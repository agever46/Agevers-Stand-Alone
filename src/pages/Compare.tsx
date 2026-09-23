import { useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Scale, ChevronRight, ArrowRight, Shield, Zap, Globe } from "lucide-react";

const comparisons = [
  {
    slug: "agevers-vs-g2a",
    competitor: "G2A",
    blurb: "Marketplace giant vs direct-sales storefront — see why an accountable single seller often beats third-party listings.",
    accent: "bg-red-500/10 text-red-500",
  },
  {
    slug: "agevers-vs-cdkeys",
    competitor: "CDKeys",
    blurb: "Two direct-sales stores compared head-to-head. Catalogue depth vs modern fraud protection and instant support.",
    accent: "bg-blue-500/10 text-blue-400",
  },
  {
    slug: "agevers-vs-eneba",
    competitor: "Eneba",
    blurb: "Hybrid marketplace vs strict direct-sales. See why a single accountable seller and free in-store games beat marketplace upsells.",
    accent: "bg-amber-500/10 text-amber-400",
  },
  {
    slug: "agevers-vs-difmark",
    competitor: "Difmark",
    blurb: "Same direct-sales model — but Agever's adds modern fraud protection, region warnings and free games that earn checkout discounts.",
    accent: "bg-emerald-500/10 text-emerald-400",
  },
];

const Compare = () => {
  useEffect(() => {
    document.title = "Compare Agever's vs Other Game Key Stores (2026)";
    const setMeta = (selector: string, attr: string, name: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const desc = "Honest side-by-side comparisons of Agever's vs G2A and CDKeys. Prices, fees, delivery, refund policy and fraud protection — see which CD-key store fits you.";
    setMeta('meta[name="description"]', "name", "description", desc);
    setMeta('meta[property="og:title"]', "property", "og:title", "Compare Agever's vs Other Game Key Stores");
    setMeta('meta[property="og:description"]', "property", "og:description", desc);
    setMeta('meta[property="og:url"]', "property", "og:url", "https://agevers.com/compare");
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = "https://agevers.com/compare";
  }, []);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Agever's comparison guides",
    itemListElement: comparisons.map((c, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `https://agevers.com/compare/${c.slug}`,
      name: `Agever's vs ${c.competitor}`,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />

      <section className="pt-28 pb-12 bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-display font-bold tracking-wider">
            <Scale className="h-3.5 w-3.5" />
            COMPARE STORES
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground mb-4">
            How Agever's <span className="text-primary">compares</span>
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
            Honest, fact-based comparisons of Agever's against the biggest CD-key stores online. We list our weaknesses too — because we'd rather you make an informed choice.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 max-w-5xl py-12">
        {/* Why these comparisons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {[
            { icon: Shield, title: "No bias", text: "We list features the competitor wins on." },
            { icon: Zap, title: "Up to date", text: "Reviewed every quarter for accuracy." },
            { icon: Globe, title: "Worldwide", text: "Pricing & delivery info reflects global availability." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-border bg-card p-5">
              <item.icon className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-display text-sm font-bold text-foreground">{item.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{item.text}</p>
            </div>
          ))}
        </div>

        <h2 className="font-display text-2xl font-bold text-foreground mb-6">All comparisons</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {comparisons.map((c, idx) => (
            <motion.div
              key={c.slug}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Link
                to={`/compare/${c.slug}`}
                className="group block rounded-xl border border-border bg-card p-6 hover:border-primary/40 hover:bg-card/80 transition-all"
              >
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-display font-bold tracking-wider mb-4 ${c.accent}`}>
                  vs {c.competitor.toUpperCase()}
                </div>
                <h3 className="font-display text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                  Agever's vs {c.competitor}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{c.blurb}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Read comparison <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">Looking for a comparison we haven't published yet?</p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-secondary transition-colors"
          >
            Suggest a store to compare <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Compare;
