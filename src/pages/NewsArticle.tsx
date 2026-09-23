import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper, ChevronRight, ArrowLeft, Calendar, User, ArrowRight } from "lucide-react";
import AgeversLoader from "@/components/AgeversLoader";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { useCurrency } from "@/hooks/useCurrency";
import { autoLinkNewsContent, NEWS_CTA_MARK } from "@/lib/newsAutoLink";

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  image_url: string | null;
  og_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  author_name: string;
  tags: string[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface RelatedProduct {
  id: string;
  title: string;
  slug: string;
  image_url: string | null;
  platform: string;
  region: string;
  sell_price?: number;
}

const SITE = "https://agevers.com";
const FALLBACK_OG = "https://ppernxjnicippytjuxpz.supabase.co/storage/v1/object/public/email-assets/og-image.png";

const NewsArticle = () => {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [related, setRelated] = useState<RelatedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    if (!slug) return;
    const run = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("news_articles")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      if (!data) { setLoading(false); return; }
      const art = data as any as Article;
      setArticle(art);

      // SEO meta
      const title = art.meta_title || `${art.title} — Agever's News`;
      document.title = title;
      const descContent = art.meta_description || art.excerpt || "";
      const setMeta = (selector: string, attr: string, value: string) => {
        const el = document.querySelector(selector);
        if (el) el.setAttribute(attr, value);
      };
      setMeta('meta[name="description"]', "content", descContent);
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.setAttribute("href", `${SITE}/news/${art.slug}`);

      const ogImage = art.og_image_url || art.image_url || FALLBACK_OG;
      setMeta('meta[property="og:type"]', "content", "article");
      setMeta('meta[property="og:url"]', "content", `${SITE}/news/${art.slug}`);
      setMeta('meta[property="og:title"]', "content", art.title);
      setMeta('meta[property="og:description"]', "content", descContent);
      setMeta('meta[property="og:image"]', "content", ogImage);
      setMeta('meta[name="twitter:title"]', "content", art.title);
      setMeta('meta[name="twitter:description"]', "content", descContent);
      setMeta('meta[name="twitter:image"]', "content", ogImage);

      // Fetch category + related (manual + auto)
      const [{ data: cat }, { data: manualLinks }] = await Promise.all([
        supabase.from("news_categories").select("id, name, slug").eq("id", art.category_id).maybeSingle(),
        supabase
          .from("news_related_products")
          .select("allowed_product_id, display_order")
          .eq("article_id", art.id)
          .order("display_order"),
      ]);
      if (cat) setCategory(cat as any);

      const manualIds = (manualLinks as any[] || []).map((r) => r.allowed_product_id);

      let products: RelatedProduct[] = [];
      if (manualIds.length > 0) {
        const { data: prods } = await supabase
          .from("allowed_products")
          .select("id, title, slug, image_url, platform, region")
          .in("id", manualIds);
        const orderMap = new Map(manualIds.map((id, idx) => [id, idx]));
        products = ((prods as any[]) || []).sort(
          (a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99)
        );
      }

      // Auto-suggest by tags/title keywords if no manual or fewer than 4
      if (products.length < 4) {
        const need = 6 - products.length;
        const tokens = [
          ...(art.tags || []),
          ...art.title.split(/\s+/).filter((w) => w.length > 4),
        ]
          .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
          .filter((t) => t.length > 3)
          .slice(0, 6);

        if (tokens.length > 0) {
          const orFilter = tokens.map((t) => `title.ilike.%${t}%`).join(",");
          const { data: autoProds } = await supabase
            .from("allowed_products")
            .select("id, title, slug, image_url, platform, region")
            .or(orFilter)
            .not("id", "in", `(${products.map((p) => p.id).join(",") || "null"})`)
            .limit(need);
          if (autoProds) products = [...products, ...(autoProds as any[])];
        }
      }

      // Get sell prices for the chosen products
      if (products.length > 0) {
        const ids = products.map((p) => p.id);
        const { data: kp } = await supabase.rpc("get_public_kinguin_by_ids" as any, { _ids: ids });
        const priceMap = new Map(
          ((kp as any[]) || [])
            .filter((k: any) => k.is_active)
            .map((k: any) => [k.allowed_product_id, Number(k.sell_price)])
        );
        products = products.map((p) => ({ ...p, sell_price: priceMap.get(p.id) }));
      }

      setRelated(products.slice(0, 6));
      setLoading(false);
    };
    run();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center"><AgeversLoader /></div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center px-4">
          <div>
            <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">News Article Not Found</h1>
            <Link to="/news" className="text-primary font-display text-sm hover:underline">← Back to News</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const datePublished = article.published_at || article.created_at;
  const ogImage = article.og_image_url || article.image_url || FALLBACK_OG;

  // NewsArticle JSON-LD
  // Auto-detect entity mentions (platforms / common gaming entities) for the `mentions` field.
  // Helps generative AI engines understand what the article is about.
  const ENTITY_MAP: Record<string, { name: string; sameAs: string }> = {
    steam: { name: "Steam", sameAs: "https://www.wikidata.org/wiki/Q337535" },
    playstation: { name: "PlayStation", sameAs: "https://www.wikidata.org/wiki/Q170325" },
    xbox: { name: "Xbox", sameAs: "https://www.wikidata.org/wiki/Q132777" },
    nintendo: { name: "Nintendo", sameAs: "https://www.wikidata.org/wiki/Q8093" },
    "epic games": { name: "Epic Games", sameAs: "https://www.wikidata.org/wiki/Q936790" },
    ubisoft: { name: "Ubisoft", sameAs: "https://www.wikidata.org/wiki/Q207936" },
    "battle.net": { name: "Battle.net", sameAs: "https://www.wikidata.org/wiki/Q798539" },
    gog: { name: "GOG.com", sameAs: "https://www.wikidata.org/wiki/Q1411567" },
    rockstar: { name: "Rockstar Games", sameAs: "https://www.wikidata.org/wiki/Q207257" },
  };
  const lowerHaystack = `${article.title} ${article.content}`.toLowerCase();
  const detectedMentions = Object.entries(ENTITY_MAP)
    .filter(([key]) => lowerHaystack.includes(key))
    .map(([, ent]) => ({ "@type": "Thing", name: ent.name, sameAs: ent.sameAs }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.meta_description || article.excerpt || "",
    image: {
      "@type": "ImageObject",
      url: ogImage,
      creditText: "Agever's",
      creator: { "@type": "Organization", name: "Agever's" },
      copyrightNotice: "© Agever's",
    },
    datePublished,
    dateModified: article.updated_at,
    author: {
      "@type": "Organization",
      name: article.author_name || "Agever's Editorial",
      url: "https://agevers.com/about",
      sameAs: [
        "https://agevers.com/about",
        "https://www.trustpilot.com/review/agevers.com",
      ],
    },
    publisher: {
      "@type": "Organization",
      name: "Agever's",
      url: "https://agevers.com",
      sameAs: [
        "https://www.trustpilot.com/review/agevers.com",
      ],
      logo: {
        "@type": "ImageObject",
        url: "https://agevers.com/favicon.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE}/news/${article.slug}`,
    },
    articleSection: category?.name,
    keywords: (article.tags || []).join(", "),
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", ".news-speakable-excerpt"],
    },
    ...(detectedMentions.length > 0 ? { mentions: detectedMentions } : {}),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="container mx-auto px-4 pt-24 pb-10 flex-1 max-w-3xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-muted-foreground font-body mb-6 flex-wrap">
          <Link to="/news" className="hover:text-primary transition-colors">News</Link>
          <ChevronRight className="h-3 w-3" />
          {category && (
            <>
              <Link to={`/news/category/${category.slug}`} className="hover:text-primary transition-colors">
                {category.name}
              </Link>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
          <span className="text-foreground truncate">{article.title}</span>
        </nav>

        <Link to="/news" className="inline-flex items-center gap-1.5 text-sm text-primary font-display font-bold hover:underline mb-6">
          <ArrowLeft className="h-4 w-4" /> All News
        </Link>

        {/* Category badge */}
        {category && (
          <Link
            to={`/news/category/${category.slug}`}
            className="inline-block mb-3 text-[11px] font-display font-bold tracking-wider px-2.5 py-1 rounded-full bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          >
            {category.name.toUpperCase()}
          </Link>
        )}

        {/* H1 - article headline */}
        <h1 className="font-display text-2xl md:text-4xl font-black tracking-wider text-foreground mb-4 leading-tight">
          {article.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground font-body mb-6 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3 w-3" /> {article.author_name}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3 w-3" />
            {new Date(datePublished).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </span>
        </div>

        {article.image_url && (
          <img
            src={article.image_url}
            alt={article.excerpt ? `${article.title} – ${article.excerpt.slice(0, 120)}` : article.title}
            className="w-full rounded-xl mb-8 aspect-video object-cover"
            width={1920}
            height={1080}
          />
        )}

        {article.excerpt && (
          <p className="news-speakable-excerpt text-base md:text-lg text-foreground font-body leading-relaxed mb-6 italic border-l-2 border-primary pl-4">
            {article.excerpt}
          </p>
        )}

        {/* Article body */}
        <div className="prose prose-invert prose-base max-w-none font-body
          prose-headings:font-display prose-headings:tracking-wider
          prose-h2:text-xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-5
          prose-h3:text-lg prose-h3:font-bold prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:mb-5
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-strong:text-foreground
          prose-li:text-muted-foreground prose-li:my-1.5
          prose-ol:text-muted-foreground prose-ol:my-4
          prose-ul:text-muted-foreground prose-ul:my-4
          prose-hr:my-8 prose-hr:border-border
          [&_img]:rounded-lg [&_img]:!w-full [&_img]:!h-auto [&_img]:!aspect-video [&_img]:!object-cover [&_img]:!my-6 [&_img]:block
          [&>*+*]:mt-5
        ">
          <ReactMarkdown
            rehypePlugins={[rehypeRaw, rehypeSanitize]}
            components={{
              a: ({ href, children, ...props }) => {
                const isCta = typeof href === "string" && href.endsWith(NEWS_CTA_MARK);
                if (isCta) {
                  const cleanHref = href!.slice(0, -NEWS_CTA_MARK.length);
                  return (
                    <Link
                      to={cleanHref}
                      className="not-prose inline-flex items-center gap-1.5 align-baseline px-3 py-1 mx-0.5 rounded-md bg-primary/15 text-primary font-display font-bold text-[0.92em] tracking-wide ring-1 ring-primary/30 hover:bg-primary hover:text-primary-foreground hover:ring-primary transition-colors no-underline"
                    >
                      {children}
                      <ArrowRight className="h-3 w-3 shrink-0" />
                    </Link>
                  );
                }
                const isInternal = typeof href === "string" && href.startsWith("/");
                if (isInternal) {
                  return <Link to={href}>{children}</Link>;
                }
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                    {children}
                  </a>
                );
              },
            }}
          >
            {autoLinkNewsContent(article.content)}
          </ReactMarkdown>
        </div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-10 pt-6 border-t border-border">
            <span className="text-xs text-muted-foreground font-body">Tags:</span>
            {article.tags.map((t) => (
              <span key={t} className="text-[11px] font-display px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Related Products */}
        {related.length > 0 && (
          <section className="mt-12 pt-8 border-t border-border">
            <h2 className="font-display text-xl font-bold tracking-wider text-foreground mb-5 flex items-center gap-2">
              <span className="h-1 w-6 rounded-full bg-primary" />
              Related Products
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {related.map((p) => (
                <Link
                  key={p.id}
                  to={`/product/${p.slug}`}
                  className="group glass rounded-lg overflow-hidden hover:ring-1 hover:ring-primary/40 transition-all"
                >
                  {p.image_url ? (
                    <div className="aspect-square overflow-hidden bg-secondary">
                      <img src={p.image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    </div>
                  ) : (
                    <div className="aspect-square bg-secondary flex items-center justify-center">
                      <Newspaper className="h-8 w-8 text-primary/30" />
                    </div>
                  )}
                  <div className="p-2.5">
                    <h3 className="text-xs font-display font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1">
                      {p.title}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-body">{p.platform}</span>
                      {p.sell_price != null && (
                        <span className="text-xs font-display font-bold text-primary">
                          {formatPrice(p.sell_price)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      <Footer />
    </div>
  );
};

export default NewsArticle;
