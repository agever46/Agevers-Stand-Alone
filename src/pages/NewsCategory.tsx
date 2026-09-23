import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper, ChevronRight, ArrowLeft, Calendar } from "lucide-react";
import AgeversLoader from "@/components/AgeversLoader";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
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
}

const NewsCategory = () => {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<Category | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const fetch = async () => {
      const { data: cat } = await supabase
        .from("news_categories")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (cat) {
        setCategory(cat as any);
        document.title = `${(cat as any).name} News — Agever's`;
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute("content", `${(cat as any).description || (cat as any).name + " news and updates"} — Agever's news.`);
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.setAttribute("href", `https://agevers.com/news/category/${slug}`);

        const { data: arts } = await supabase
          .from("news_articles")
          .select("id, title, slug, excerpt, image_url, category_id, published_at, created_at")
          .eq("is_published", true)
          .eq("category_id", (cat as any).id)
          .order("published_at", { ascending: false })
          .limit(60);
        setArticles((arts as any[]) || []);
      }
      setLoading(false);
    };
    fetch();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center"><AgeversLoader /></div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center px-4">
          <div>
            <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">Category Not Found</h1>
            <Link to="/news" className="text-primary font-display text-sm hover:underline">← Back to News</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <section className="container mx-auto px-4 pt-24 pb-10 flex-1 max-w-6xl">
        <Link to="/news" className="inline-flex items-center gap-1.5 text-sm text-primary font-display font-bold hover:underline mb-4">
          <ArrowLeft className="h-4 w-4" /> All News
        </Link>
        <h1 className="font-display text-3xl md:text-4xl font-black tracking-wider text-foreground mb-2">
          {category.name}
        </h1>
        {category.description && (
          <p className="text-muted-foreground font-body text-sm mb-8 max-w-2xl">{category.description}</p>
        )}

        {articles.length === 0 ? (
          <div className="text-center py-16">
            <Newspaper className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-display">No articles in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map((a) => {
              const date = a.published_at || a.created_at;
              return (
                <Link
                  key={a.id}
                  to={`/news/${a.slug}`}
                  className="group glass rounded-xl overflow-hidden hover:ring-1 hover:ring-primary/40 transition-all flex flex-col"
                >
                  {a.image_url ? (
                    <div className="aspect-video overflow-hidden bg-secondary">
                      <img src={a.image_url} alt={a.excerpt ? `${a.title} – ${a.excerpt.slice(0, 100)}` : `${a.title} - Agever's News`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" width={640} height={360} />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center">
                      <Newspaper className="h-10 w-10 text-primary/50" />
                    </div>
                  )}
                  <div className="p-4 flex flex-col flex-1">
                    <span className="text-[10px] text-muted-foreground font-body inline-flex items-center gap-1 mb-1.5">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <h3 className="font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1.5">
                      {a.title}
                    </h3>
                    {a.excerpt && <p className="text-xs text-muted-foreground line-clamp-2 font-body flex-1">{a.excerpt}</p>}
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

export default NewsCategory;
