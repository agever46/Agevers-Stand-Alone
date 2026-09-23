import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper, ChevronRight, Search, Calendar } from "lucide-react";
import AgeversLoader from "@/components/AgeversLoader";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  image_url: string | null;
  category_id: string;
  published_at: string | null;
  created_at: string;
  author_name: string;
}

const News = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);

  useEffect(() => {
    document.title = "News — Agever's | Game Releases, Deals & Industry Updates";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Latest gaming news, game releases, deals, and industry updates. Stay informed with Agever's news section.");
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://agevers.com/news");

    const fetchData = async () => {
      const [catRes, artRes] = await Promise.all([
        supabase.from("news_categories").select("*").eq("is_active", true).order("display_order"),
        supabase
          .from("news_articles")
          .select("id, title, slug, excerpt, image_url, category_id, published_at, created_at, author_name")
          .eq("is_published", true)
          .order("published_at", { ascending: false })
          .limit(50),
      ]);
      setCategories((catRes.data as any[]) || []);
      setArticles((artRes.data as any[]) || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = articles.filter((a) => {
    if (activeCat && a.category_id !== activeCat) return false;
    if (search.trim() && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ItemList JSON-LD for the news landing page
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Agever's News",
    itemListElement: filtered.slice(0, 20).map((a, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `https://agevers.com/news/${a.slug}`,
      name: a.title,
    })),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative pt-20 pb-12 md:pt-28 md:pb-16 bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-display font-bold tracking-wider">
            <Newspaper className="h-4 w-4" />
            NEWSROOM
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground mb-4">
            Gaming <span className="text-primary">News</span>
          </h1>
          <p className="text-muted-foreground font-body text-sm md:text-base max-w-xl mx-auto mb-8">
            Releases, deals, updates and industry insight — refreshed daily.
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search news..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-card border border-border text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </section>

      {/* Category pills */}
      {categories.length > 0 && (
        <div className="container mx-auto px-4 pb-2">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={() => setActiveCat(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-display font-bold tracking-wider transition-colors ${
                !activeCat ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              All News
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-display font-bold tracking-wider transition-colors ${
                  activeCat === c.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <section className="container mx-auto px-4 py-10 flex-1">
        {loading ? (
          <div className="flex justify-center py-20"><AgeversLoader /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-display">
              {search || activeCat ? "No news matches your filters." : "No news yet. Check back soon!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
            {filtered.map((article) => {
              const cat = categories.find((c) => c.id === article.category_id);
              const date = article.published_at || article.created_at;
              return (
                <Link
                  key={article.id}
                  to={`/news/${article.slug}`}
                  className="group glass rounded-xl overflow-hidden hover:ring-1 hover:ring-primary/40 transition-all flex flex-col"
                >
                  {article.image_url ? (
                    <div className="aspect-video overflow-hidden bg-secondary">
                      <img
                        src={article.image_url}
                        alt={article.excerpt ? `${article.title} – ${article.excerpt.slice(0, 100)}` : `${article.title} - Agever's News`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        width={640}
                        height={360}
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center">
                      <Newspaper className="h-10 w-10 text-primary/50" />
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {cat && (
                        <span className="text-[10px] font-display font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                          {cat.name.toUpperCase()}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground font-body inline-flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <h3 className="font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1.5">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="text-xs text-muted-foreground line-clamp-2 font-body flex-1">
                        {article.excerpt}
                      </p>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-primary font-display font-bold mt-3">
                      Read More <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
};

export default News;
