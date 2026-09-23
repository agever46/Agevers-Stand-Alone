import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, ChevronRight, Search } from "lucide-react";
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
  created_at: string;
}

const Guides = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "Help & Guides — Agevers | Game Key Tutorials & How-To";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Step-by-step guides on how to redeem game keys for Steam, Xbox, PlayStation, Nintendo, and more. Expert tips from Agevers.");

    const fetchData = async () => {
      const [catRes, artRes] = await Promise.all([
        supabase.from("guide_categories").select("*").order("display_order"),
        supabase.from("guide_articles").select("id, title, slug, excerpt, image_url, category_id, created_at").order("display_order"),
      ]);
      setCategories((catRes.data as any[]) || []);
      setArticles((artRes.data as any[]) || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = search.trim()
    ? articles.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()))
    : articles;

  const grouped = categories
    .map((cat) => ({
      ...cat,
      articles: filtered.filter((a) => a.category_id === cat.id),
    }))
    .filter((g) => g.articles.length > 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-20 pb-16 md:pt-28 md:pb-24 bg-gradient-to-b from-primary/10 to-background">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-display font-bold tracking-wider">
            <BookOpen className="h-4 w-4" />
            HELP & GUIDES
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground mb-4">
            Help & <span className="text-primary">Guides</span>
          </h1>
          <p className="text-muted-foreground font-body text-sm md:text-base max-w-xl mx-auto mb-8">
            Step-by-step tutorials for every platform. Find exactly what you need.
          </p>
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search guides..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-card border border-border text-foreground font-body text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-12 flex-1">
        {loading ? (
          <div className="flex justify-center py-20"><AgeversLoader /></div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-display">
              {search ? "No guides match your search." : "No guides available yet. Check back soon!"}
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {grouped.map((cat) => (
              <div key={cat.id}>
                <h2 className="font-display text-xl font-bold tracking-wider text-foreground mb-5 flex items-center gap-2">
                  <span className="h-1 w-6 rounded-full bg-primary" />
                  {cat.name}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {cat.articles.map((article) => (
                    <Link
                      key={article.id}
                      to={`/guides/${article.slug}`}
                      className="group glass rounded-xl overflow-hidden hover:ring-1 hover:ring-primary/40 transition-all"
                    >
                      {article.image_url && (
                        <div className="aspect-video overflow-hidden">
                          <img
                            src={article.image_url}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                          {article.title}
                        </h3>
                        {article.excerpt && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 font-body">
                            {article.excerpt}
                          </p>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs text-primary font-display font-bold mt-3">
                          Read Guide <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
};

export default Guides;
