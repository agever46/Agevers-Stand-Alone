import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, ArrowLeft, Clock, Share2, BookOpen } from "lucide-react";
import AgeversLoader from "@/components/AgeversLoader";
import { toast } from "sonner";
import DOMPurify from "dompurify";

interface SEOArticle {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  image_url: string | null;
  created_at: string;
  slug: string;
}

const BlogArticle = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<SEOArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!slug) return;
      
      const { data, error } = await supabase
        .from("seo_articles")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();

      if (error) {
        console.error(error);
        toast.error("Failed to load article");
      } else if (!data) {
        navigate("/blog");
      } else {
        setArticle(data);
        
        // Update SEO Meta
        document.title = `${data.title} | Agever's Blog`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute("content", data.excerpt || data.title);
        
        // Canonical
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.setAttribute("href", `https://agevers.com/blog/${data.slug}`);
      }
      setLoading(false);
    };

    fetchArticle();
  }, [slug, navigate]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: article?.title,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <AgeversLoader />
        </div>
        <Footer />
      </div>
    );
  }

  if (!article) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": article.title,
    "description": article.excerpt,
    "image": article.image_url || "https://agevers.com/og-image.png",
    "author": {
      "@type": "Organization",
      "name": "Agever's",
      "url": "https://agevers.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Agever's",
      "logo": {
        "@type": "ImageObject",
        "url": "https://agevers.com/logo.png"
      }
    },
    "datePublished": article.created_at,
    "url": `https://agevers.com/blog/${article.slug}`
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>

      <main className="flex-1 pt-24 pb-20">
        <article className="container mx-auto px-4 max-w-4xl">
          <Link 
            to="/blog" 
            className="inline-flex items-center gap-2 text-xs font-black text-primary uppercase tracking-widest hover:text-primary/80 transition-colors mb-8 group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            Back to Blog
          </Link>

          <header className="space-y-6 mb-12">
            <div className="flex items-center gap-4 text-xs font-bold tracking-widest text-muted-foreground uppercase">
              <span className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(article.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric"
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                ~8 min read
              </span>
            </div>

            <h1 className="font-display text-4xl md:text-6xl font-black tracking-tighter text-foreground leading-[0.95] md:leading-[0.9]">
              {article.title}
            </h1>

            {article.excerpt && (
              <p className="text-lg md:text-xl text-muted-foreground font-body leading-relaxed border-l-4 border-primary/30 pl-6 italic">
                {article.excerpt}
              </p>
            )}

            <div className="flex items-center justify-between py-6 border-y border-primary/10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-white font-black text-sm">
                  A
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Agever's Editorial</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Expert Content Team</p>
                </div>
              </div>
              <button 
                onClick={handleShare}
                className="p-3 rounded-full bg-secondary/50 text-muted-foreground hover:bg-primary/20 hover:text-primary transition-all shadow-lg"
                title="Share Article"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </header>

          {article.image_url && (
            <div className="aspect-video w-full rounded-3xl overflow-hidden mb-12 border border-primary/20 shadow-2xl relative group">
              <img 
                src={article.image_url} 
                alt={article.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent pointer-events-none" />
            </div>
          )}

          <div className="prose prose-invert prose-purple max-w-none 
            prose-headings:font-display prose-headings:font-black prose-headings:tracking-tight
            prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-primary
            prose-p:text-muted-foreground prose-p:leading-loose prose-p:text-lg
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-strong:text-foreground prose-strong:font-black
            prose-li:text-muted-foreground
            bg-card/20 backdrop-blur-sm rounded-3xl p-8 md:p-12 border border-primary/5 shadow-inner"
          >
            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content) }} />
          </div>

          <footer className="mt-20 pt-12 border-t border-primary/10">
            <div className="bg-gradient-to-br from-primary/10 to-purple-900/20 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
              <div className="flex-1 space-y-4">
                <h3 className="font-display text-2xl font-black text-foreground">Enjoyed this read?</h3>
                <p className="text-muted-foreground font-body">
                  We're constantly updating our blog with the best game key deals, software guides, and industry news. Don't miss out on the next big update.
                </p>
                <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                  <Link 
                    to="/" 
                    className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                  >
                    Shop Game Keys
                  </Link>
                  <Link 
                    to="/blog" 
                    className="px-6 py-3 rounded-xl bg-secondary text-foreground font-black text-sm uppercase tracking-widest hover:bg-secondary/80 transition-colors"
                  >
                    Browse More
                  </Link>
                </div>
              </div>
              <div className="shrink-0">
                <div className="h-32 w-32 md:h-40 md:w-40 bg-card rounded-3xl border-2 border-primary/20 flex items-center justify-center rotate-3 shadow-2xl">
                  <BookOpen className="h-16 w-16 text-primary animate-pulse" />
                </div>
              </div>
            </div>
          </footer>
        </article>
      </main>

      <Footer />
    </div>
  );
};

export default BlogArticle;
