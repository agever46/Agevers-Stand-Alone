import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, ChevronRight, ArrowLeft } from "lucide-react";
import AgeversLoader from "@/components/AgeversLoader";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  category_id: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

const GuideArticle = () => {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("guide_articles")
        .select("*")
        .eq("slug", slug)
        .single();
      if (data) {
        setArticle(data as any);
        document.title = (data as any).meta_title || `${(data as any).title} — Agevers`;
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute("content", (data as any).meta_description || (data as any).excerpt || "");

        const { data: cat } = await supabase
          .from("guide_categories")
          .select("id, name, slug")
          .eq("id", (data as any).category_id)
          .single();
        if (cat) setCategory(cat as any);
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

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-center px-4">
          <div>
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">Guide Not Found</h1>
            <Link to="/guides" className="text-primary font-display text-sm hover:underline">
              ← Back to Guides
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Detect H2 headings in the markdown — if 2+ exist, treat the guide as a HowTo
  const h2Matches = Array.from(article.content.matchAll(/^##\s+(.+)$/gm)).map((m) => m[1].trim());
  const isHowTo = h2Matches.length >= 2;

  const baseSchema = {
    "@context": "https://schema.org",
    headline: article.title,
    name: article.title,
    description: article.meta_description || article.excerpt || "",
    image: article.image_url ? [article.image_url] : undefined,
    datePublished: article.created_at,
    dateModified: article.created_at,
    author: { "@type": "Organization", name: "Agever's Editorial" },
    publisher: {
      "@type": "Organization",
      name: "Agever's",
      logo: { "@type": "ImageObject", url: "https://agevers.com/favicon.png" },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://agevers.com/guides/${article.slug}`,
    },
  };

  const jsonLd = isHowTo
    ? {
        ...baseSchema,
        "@type": "HowTo",
        step: h2Matches.map((heading, idx) => ({
          "@type": "HowToStep",
          position: idx + 1,
          name: heading,
          url: `https://agevers.com/guides/${article.slug}#step-${idx + 1}`,
        })),
      }
    : { ...baseSchema, "@type": "Article" };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="container mx-auto px-4 pt-24 pb-10 flex-1 max-w-3xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-muted-foreground font-body mb-6">
          <Link to="/guides" className="hover:text-primary transition-colors">Guides</Link>
          <ChevronRight className="h-3 w-3" />
          {category && (
            <>
              <span>{category.name}</span>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
          <span className="text-foreground truncate">{article.title}</span>
        </nav>

        <Link to="/guides" className="inline-flex items-center gap-1.5 text-sm text-primary font-display font-bold hover:underline mb-6">
          <ArrowLeft className="h-4 w-4" /> All Guides
        </Link>

        {article.image_url && (
          <img
            src={article.image_url}
            alt={article.title}
            className="w-full rounded-xl mb-8 aspect-video object-cover"
          />
        )}

        <h1 className="font-display text-2xl md:text-4xl font-black tracking-wider text-foreground mb-6">
          {article.title}
        </h1>

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
          prose-img:rounded-lg
          prose-hr:my-8 prose-hr:border-border
          [&>*+*]:mt-5
        ">
          <ReactMarkdown rehypePlugins={[rehypeRaw, rehypeSanitize]}>{article.content}</ReactMarkdown>
        </div>
      </article>

      <Footer />
    </div>
  );
};

export default GuideArticle;
