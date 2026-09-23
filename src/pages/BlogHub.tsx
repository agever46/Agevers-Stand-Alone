import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Calendar, ChevronRight, Search } from "lucide-react";
import AgeversLoader from "@/components/AgeversLoader";

interface SEOArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  image_url: string | null;
  created_at: string;
}

const BlogHub = () => {
  const [articles, setArticles] = useState<SEOArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    document.title = "Blog — Agever's | Gaming Insights & Software Guides";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Explore Agever's blog for the latest gaming insights, software guides, and industry trends. Stay ahead with our expert-generated content.");
    
    const fetchArticles = async () => {
      const { data, error } = await supabase
        .from("seo_articles")
        .select("id, title, slug, excerpt, image_url, created_at")
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (data) setArticles(data);
      setLoading(false);
    };
    fetchArticles();
  }, []);

  const filtered = articles.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.excerpt?.toLowerCase().includes(search.toLowerCase())
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Agever's Blog",
    "description": "Expert insights into gaming and software.",
    "publisher": {
      "@type": "Organization",
      "name": "Agever's",
      "url": "https://agevers.com"
    },
    "blogPost": filtered.map(a => ({
      "@type": "BlogPosting",
      "headline": a.title,
      "url": `https://agevers.com/blog/${a.slug}`,
      "datePublished": a.created_at,
      "description": a.excerpt
    }))
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>

      <section className="relative pt-24 pb-12 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-display font-bold tracking-wider">
            <BookOpen className="h-4 w-4" />
            AGEVER'S BLOG
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-black tracking-tighter text-foreground mb-6">
            Level Up Your <span className="text-primary text-glow">Knowledge</span>
          </h1>
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search articles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-14 pl-12 pr-6 rounded-2xl bg-card/50 backdrop-blur-md border border-primary/20 text-foreground font-body focus:ring-2 focus:ring-primary/50 outline-none transition-all"
            />
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12 flex-1">
        {loading ? (
          <div className="flex justify-center py-20"><AgeversLoader /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-card/30 rounded-3xl border border-dashed border-primary/20">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground font-display text-xl">
              No articles found. Try a different search!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {filtered.map((article) => (
              <Link
                key={article.id}
                to={`/blog/${article.slug}`}
                className="group relative flex flex-col bg-card/40 backdrop-blur-sm border border-primary/10 rounded-2xl overflow-hidden hover:border-primary/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)]"
              >
                <div className="aspect-[16/9] overflow-hidden bg-secondary/50 relative">
                  {article.image_url ? (
                    <img
                      src={article.image_url}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-purple-900/20">
                      <BookOpen className="h-12 w-12 text-primary/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                </div>
                
                <div className="p-6 flex flex-col flex-1 relative z-10">
                  <div className="flex items-center gap-2 mb-3 text-[10px] font-bold tracking-widest text-primary uppercase">
                    <Calendar className="h-3 w-3" />
                    {new Date(article.created_at).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </div>
                  
                  <h3 className="font-display text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-3 leading-tight">
                    {article.title}
                  </h3>
                  
                  {article.excerpt && (
                    <p className="text-sm text-muted-foreground line-clamp-3 font-body leading-relaxed mb-6">
                      {article.excerpt}
                    </p>
                  )}
                  
                  <div className="mt-auto pt-4 border-t border-primary/5 flex items-center gap-1 text-xs font-black text-primary uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                    Read Article <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default BlogHub;
