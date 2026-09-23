import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Users, Shield, Zap, Globe, Heart, Headphones, Calendar, Package, MapPin } from "lucide-react";

const values = [
  {
    icon: Shield,
    title: "Trust & Security",
    description: "Every transaction is protected with SSL encryption and PayPal Buyer Protection. We verify all sellers and keys to ensure 100% legitimacy.",
  },
  {
    icon: Zap,
    title: "Instant Delivery",
    description: "Your CD keys are delivered instantly to your account — no waiting, no delays. Purchase and start playing within minutes.",
  },
  {
    icon: Globe,
    title: "Global Marketplace",
    description: "We serve gamers worldwide with products for every major platform including Steam, PlayStation, Xbox, Nintendo, Epic Games, and more.",
  },
  {
    icon: Heart,
    title: "Best Prices",
    description: "Our competitive marketplace model means sellers compete to offer you the best deals on the games and software you love.",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    description: "Our dedicated support team is always ready to help. Whether it's a key issue or a general question, we've got your back.",
  },
  {
    icon: Users,
    title: "Community First",
    description: "We're built by gamers, for gamers. Our community of verified sellers and satisfied buyers is what makes Agever's special.",
  },
];

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "url": "https://agevers.com/about",
  "name": "About Agever's",
  "description": "Agever's is a digital storefront for instant-delivery game CD keys, software licenses, gift cards, and subscriptions. Operating since 2018 with over 50,000 codes delivered worldwide.",
  "mainEntity": {
    "@type": "Organization",
    "name": "Agever's",
    "url": "https://agevers.com",
    "logo": "https://agevers.com/favicon.ico",
    "foundingDate": "2018",
    "description":
      "Direct-sales digital goods retailer specializing in game CD keys, software licenses, gift cards, and subscriptions for all major platforms.",
    "areaServed": { "@type": "Place", "name": "Worldwide" },
    "knowsAbout": [
      "Steam keys", "PlayStation Network", "Xbox Live", "Nintendo eShop",
      "Epic Games", "EA App", "Ubisoft Connect", "Battle.net", "GOG",
      "Gift cards", "Software licenses", "Game subscriptions"
    ],
    "sameAs": ["https://www.trustpilot.com/review/agevers.com"],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.7",
      "bestRating": "5",
      "worstRating": "1",
      "ratingCount": "1280",
      "reviewCount": "1280"
    },
    "review": [
      {
        "@type": "Review",
        "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
        "author": { "@type": "Person", "name": "David M." },
        "datePublished": "2025-09-12",
        "reviewBody": "Bought a Steam key, got it within seconds. Price was lower than CDKeys and the region warning saved me from picking the wrong edition. Will buy here again."
      },
      {
        "@type": "Review",
        "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
        "author": { "@type": "Person", "name": "Sarah K." },
        "datePublished": "2025-10-04",
        "reviewBody": "Used the live chat at 2am about a key that didn't activate — got a replacement within 10 minutes. Honestly better support than most major retailers."
      },
      {
        "@type": "Review",
        "reviewRating": { "@type": "Rating", "ratingValue": "4", "bestRating": "5" },
        "author": { "@type": "Person", "name": "Marco R." },
        "datePublished": "2025-11-21",
        "reviewBody": "Catalogue is smaller than the giants but everything I've ordered worked first try. Support answered fast when I had a question about a code."
      }
    ],
    "contactPoint": [
      {
        "@type": "ContactPoint",
        "email": "support@agevers.com",
        "contactType": "customer support",
        "availableLanguage": ["English"],
        "areaServed": "Worldwide",
      },
      {
        "@type": "ContactPoint",
        "email": "business@agevers.com",
        "contactType": "business inquiries",
        "availableLanguage": ["English"],
        "areaServed": "Worldwide",
      },
    ],
  },
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://agevers.com/" },
      { "@type": "ListItem", "position": 2, "name": "About", "item": "https://agevers.com/about" },
    ],
  },
};

const AboutUs = () => {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "About Agever's — Trusted Digital Game Keys Since 2018";

    const setMeta = (selector: string, attr: string, name: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
      return el;
    };

    const desc =
      "Agever's has delivered 50,000+ digital game keys worldwide since 2018. Instant delivery, verified suppliers, 14-day refund. Learn about our story and values.";
    setMeta('meta[name="description"]', "name", "description", desc);
    setMeta('meta[property="og:title"]', "property", "og:title", "About Agever's — Trusted Digital Game Keys Since 2018");
    setMeta('meta[property="og:description"]', "property", "og:description", desc);
    setMeta('meta[property="og:url"]', "property", "og:url", "https://agevers.com/about");
    setMeta('meta[property="og:type"]', "property", "og:type", "website");

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = "https://agevers.com/about";

    return () => {
      document.title = prevTitle;
    };
  }, []);

  return (
  <div className="min-h-screen bg-background">
    <Navbar />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }} />
    <section className="pt-32 pb-16">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground">
              ABOUT US
            </h1>
          </div>
          <p className="text-muted-foreground mb-12 text-sm">Trusted digital game keys since 2018 · 50,000+ codes delivered worldwide</p>

          {/* Intro */}
          <div className="space-y-6 text-muted-foreground text-sm leading-relaxed mb-16">
            <p className="text-base text-foreground font-medium">
              Welcome to <strong>Agever's</strong> — your trusted destination for digital game keys, software licenses, gift cards, and subscriptions, serving gamers worldwide since <strong>2018</strong>.
            </p>
            <p>
              Our journey began in 2018 with a simple mission: to make digital gaming accessible, affordable, and secure for everyone. Across our platforms, we've delivered over <strong>50,000 verified codes</strong> to customers around the globe — and counting. Every gamer deserves access to the best titles at the best prices, with the confidence that every purchase is protected and every key is legitimate.
            </p>
            <p>
              Agever's sources stock exclusively from <strong>authorised B2B distributors</strong> and verified suppliers — no grey-market reselling. Every key is verified before delivery, and our buyer protection guarantee backs every transaction.
            </p>
            <p>
              <strong>Our team:</strong> A small, dedicated group of gaming-industry veterans handling sourcing, fulfilment and 24/7 support — there's no anonymous marketplace between you and the people running the store. Every order is reviewed by a human if anything looks unusual, and our fraud screening uses the same enterprise-grade tools (IPQS, Cloudflare Turnstile, device fingerprinting) trusted by major fintechs.
            </p>
            <p>
              <strong>How we're different:</strong> Unlike open marketplaces, every key on Agever's comes from one accountable source — us. Unlike legacy stores, we add modern protections: automatic region-mismatch warnings before checkout, SMS-OTP on every order, live price comparison on every product page, and a 14-day refund window on undelivered keys with no questions asked.
            </p>
            <p>
              We ship digitally to <strong>every country in the world</strong>. Each product page clearly indicates regional compatibility, and our system automatically warns buyers of any region mismatch before purchase — so you know exactly what you're getting.
            </p>
          </div>

          {/* Quick Facts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16"
          >
            {[
              { icon: Calendar, label: "Founded", value: "2018" },
              { icon: Package, label: "Codes Delivered", value: "50,000+" },
              { icon: MapPin, label: "Delivery", value: "Worldwide" },
            ].map((fact) => (
              <div key={fact.label} className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <fact.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{fact.label}</p>
                  <p className="font-display text-xl font-bold text-foreground">{fact.value}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Our Values */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="font-display text-2xl font-bold text-foreground mb-8">Why Choose Agever's?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map((value, index) => (
                <motion.div
                  key={value.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * (index + 1) }}
                  className="rounded-xl border border-border bg-card p-6 hover:border-primary/30 transition-colors"
                >
                  <value.icon className="h-8 w-8 text-primary mb-4" />
                  <h3 className="font-display text-base font-bold text-foreground mb-2">{value.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{value.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-16 rounded-xl border border-border bg-card p-8"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { number: "50K+", label: "Codes Delivered" },
                { number: "10K+", label: "Products Available" },
                { number: "50+", label: "Platforms Supported" },
                { number: "100%", label: "Legitimate Keys" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-display text-2xl md:text-3xl font-black text-primary">{stat.number}</p>
                  <p className="text-muted-foreground text-xs mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Contact CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16 text-center"
          >
            <h2 className="font-display text-xl font-bold text-foreground mb-3">Get in Touch</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Have questions, feedback, or business inquiries? We'd love to hear from you.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <a
                href="mailto:support@agevers.com"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                <Headphones className="w-4 h-4" />
                support@agevers.com
              </a>
              <a
                href="mailto:business@agevers.com"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border text-foreground font-semibold hover:bg-accent transition-colors"
              >
                <Globe className="w-4 h-4" />
                business@agevers.com
              </a>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
    <Footer />
  </div>
  );
};

export default AboutUs;
