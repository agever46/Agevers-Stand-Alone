import { useEffect, ReactNode } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Check, X, Minus, ChevronRight, Scale, Shield, Zap, ArrowRight } from "lucide-react";

export interface CompareRow {
  feature: string;
  agevers: string | boolean;
  competitor: string | boolean;
  note?: string;
}

export interface CompareFAQ {
  q: string;
  a: string;
}

interface ComparePageLayoutProps {
  competitor: string;
  competitorTagline: string;
  slug: string; // e.g. "agevers-vs-g2a"
  metaTitle: string;
  metaDescription: string;
  intro: ReactNode;
  rows: CompareRow[];
  agevePros: string[];
  competitorPros: string[];
  whenToChooseUs: string;
  whenToChooseThem: string;
  faqs: CompareFAQ[];
  verdict: ReactNode;
}

const renderCell = (val: string | boolean) => {
  if (val === true) return <Check className="h-4 w-4 text-emerald-500 mx-auto" aria-label="Yes" />;
  if (val === false) return <X className="h-4 w-4 text-red-500 mx-auto" aria-label="No" />;
  if (val === "—" || val === "-") return <Minus className="h-4 w-4 text-muted-foreground mx-auto" />;
  return <span className="text-sm text-foreground">{val}</span>;
};

const ComparePageLayout = ({
  competitor,
  competitorTagline,
  slug,
  metaTitle,
  metaDescription,
  intro,
  rows,
  agevePros,
  competitorPros,
  whenToChooseUs,
  whenToChooseThem,
  faqs,
  verdict,
}: ComparePageLayoutProps) => {
  useEffect(() => {
    const prev = document.title;
    document.title = metaTitle;

    const setMeta = (selector: string, attr: string, name: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const url = `https://agevers.com/compare/${slug}`;
    setMeta('meta[name="description"]', "name", "description", metaDescription);
    setMeta('meta[property="og:title"]', "property", "og:title", metaTitle);
    setMeta('meta[property="og:description"]', "property", "og:description", metaDescription);
    setMeta('meta[property="og:url"]', "property", "og:url", url);
    setMeta('meta[property="og:type"]', "property", "og:type", "article");

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    return () => {
      document.title = prev;
    };
  }, [metaTitle, metaDescription, slug]);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", ".compare-speakable"],
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://agevers.com/" },
      { "@type": "ListItem", position: 2, name: "Compare", item: "https://agevers.com/compare" },
      { "@type": "ListItem", position: 3, name: `Agever's vs ${competitor}`, item: `https://agevers.com/compare/${slug}` },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      {/* Hero */}
      <section className="pt-28 pb-10 bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto px-4 max-w-5xl">
          <nav className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/compare" className="hover:text-foreground transition-colors">Compare</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">vs {competitor}</span>
          </nav>
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-primary/15 text-primary text-[11px] font-display font-bold tracking-wider">
            <Scale className="h-3.5 w-3.5" />
            HONEST COMPARISON
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground mb-3">
            Agever's <span className="text-muted-foreground font-light">vs</span> <span className="text-primary">{competitor}</span>
          </h1>
          <p className="compare-speakable text-muted-foreground text-sm md:text-base max-w-2xl">{competitorTagline}</p>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-5xl py-12 space-y-16">
        {/* Intro */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="prose-sm max-w-none text-muted-foreground space-y-4 text-sm leading-relaxed"
        >
          {intro}
        </motion.section>

        {/* Comparison table */}
        <section>
          <h2 className="font-display text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" /> Side-by-side comparison
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 border-b border-border">
                <tr>
                  <th className="text-left p-3 font-display font-bold text-xs uppercase tracking-wider text-muted-foreground">Feature</th>
                  <th className="p-3 font-display font-bold text-xs uppercase tracking-wider text-primary text-center min-w-[120px]">Agever's</th>
                  <th className="p-3 font-display font-bold text-xs uppercase tracking-wider text-foreground text-center min-w-[120px]">{competitor}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="p-3 align-top">
                      <p className="font-medium text-foreground">{row.feature}</p>
                      {row.note && <p className="text-xs text-muted-foreground mt-0.5">{row.note}</p>}
                    </td>
                    <td className="p-3 text-center align-top">{renderCell(row.agevers)}</td>
                    <td className="p-3 text-center align-top">{renderCell(row.competitor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pros/Pros */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
            <h3 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Where Agever's wins
            </h3>
            <ul className="space-y-2.5">
              {agevePros.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-muted-foreground" /> Where {competitor} has an edge
            </h3>
            <ul className="space-y-2.5">
              {competitorPros.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* When to choose */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-display text-base font-bold text-foreground mb-2">Choose Agever's if…</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{whenToChooseUs}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-display text-base font-bold text-foreground mb-2">Choose {competitor} if…</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{whenToChooseThem}</p>
          </div>
        </section>

        {/* Verdict */}
        <section className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-card p-8">
          <h2 className="font-display text-xl md:text-2xl font-bold text-foreground mb-3">Our verdict</h2>
          <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{verdict}</div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 mt-6 px-5 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Browse Agever's deals <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="font-display text-2xl font-bold text-foreground mb-6">Frequently asked</h2>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <details key={i} className="group rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                <summary className="cursor-pointer font-medium text-foreground text-sm flex items-center justify-between gap-3">
                  <span>{f.q}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90 flex-shrink-0" />
                </summary>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default ComparePageLayout;
