import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, Save, X, Eye, EyeOff, FolderPlus, Newspaper, Upload, Sparkles, Search, ExternalLink, CalendarIcon,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

interface Article {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  image_url: string | null;
  og_image_url: string | null;
  is_published: boolean;
  meta_title: string | null;
  meta_description: string | null;
  author_name: string;
  tags: string[];
  published_at: string | null;
  scheduled_publish_at: string | null;
}

interface ProductPick {
  id: string;
  title: string;
  platform: string;
  image_url: string | null;
}

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 90);

const AdminNews = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  // Article form
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [artTitle, setArtTitle] = useState("");
  const [artCategoryId, setArtCategoryId] = useState("");
  const [artExcerpt, setArtExcerpt] = useState("");
  const [artContent, setArtContent] = useState("");
  const [artImageUrl, setArtImageUrl] = useState("");
  const [artOgImageUrl, setArtOgImageUrl] = useState("");
  const [artMetaTitle, setArtMetaTitle] = useState("");
  const [artMetaDesc, setArtMetaDesc] = useState("");
  const [artAuthor, setArtAuthor] = useState("Agever's Editorial");
  const [artTags, setArtTags] = useState("");
  const [artPublished, setArtPublished] = useState(false);
  const [artScheduledAt, setArtScheduledAt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCatFilter, setActiveCatFilter] = useState<string | null>(null);

  // Related products state
  const [relatedProducts, setRelatedProducts] = useState<ProductPick[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<ProductPick[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [catRes, artRes] = await Promise.all([
      supabase.from("news_categories").select("*").order("display_order"),
      supabase.from("news_articles").select("*").order("published_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    ]);
    setCategories((catRes.data as any[]) || []);
    setArticles((artRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Category CRUD
  const handleSaveCategory = async () => {
    if (!catName.trim()) return toast.error("Category name is required");
    const slug = slugify(catName);
    if (editingCat) {
      const { error } = await supabase.from("news_categories").update({ name: catName, slug, description: catDesc || null }).eq("id", editingCat.id);
      if (error) return toast.error(error.message);
      toast.success("Category updated");
    } else {
      const { error } = await supabase.from("news_categories").insert({ name: catName, slug, description: catDesc || null, display_order: categories.length });
      if (error) return toast.error(error.message);
      toast.success("Category created");
    }
    setCatName(""); setCatDesc(""); setEditingCat(null); setShowCatForm(false);
    fetchAll();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category and all its articles?")) return;
    await supabase.from("news_categories").delete().eq("id", id);
    toast.success("Category deleted");
    fetchAll();
  };

  const handleToggleCatActive = async (cat: Category) => {
    await supabase.from("news_categories").update({ is_active: !cat.is_active }).eq("id", cat.id);
    fetchAll();
  };

  // Article form helpers
  const resetArticleForm = () => {
    setArtTitle(""); setArtCategoryId(""); setArtExcerpt(""); setArtContent("");
    setArtImageUrl(""); setArtOgImageUrl(""); setArtMetaTitle(""); setArtMetaDesc("");
    setArtAuthor("Agever's Editorial"); setArtTags(""); setArtPublished(false);
    setArtScheduledAt("");
    setRelatedProducts([]); setProductSearch(""); setProductResults([]);
    setAiPrompt("");
    setEditingArticle(null); setShowArticleForm(false);
  };

  const openEditArticle = async (a: Article) => {
    setEditingArticle(a);
    setArtTitle(a.title); setArtCategoryId(a.category_id); setArtExcerpt(a.excerpt || "");
    setArtContent(a.content); setArtImageUrl(a.image_url || ""); setArtOgImageUrl(a.og_image_url || "");
    setArtMetaTitle(a.meta_title || ""); setArtMetaDesc(a.meta_description || "");
    setArtAuthor(a.author_name || "Agever's Editorial");
    setArtTags((a.tags || []).join(", "));
    setArtPublished(a.is_published);
    setArtScheduledAt(a.scheduled_publish_at ? new Date(a.scheduled_publish_at).toISOString().slice(0, 16) : "");
    setShowArticleForm(true);

    // Load related products
    const { data: links } = await supabase
      .from("news_related_products")
      .select("allowed_product_id, display_order")
      .eq("article_id", a.id)
      .order("display_order");
    if (links && links.length > 0) {
      const ids = (links as any[]).map((l) => l.allowed_product_id);
      const { data: prods } = await supabase
        .from("allowed_products")
        .select("id, title, platform, image_url")
        .in("id", ids);
      const orderMap = new Map(ids.map((id, idx) => [id, idx]));
      setRelatedProducts(((prods as any[]) || []).sort(
        (a, b) => (orderMap.get(a.id) ?? 99) - (orderMap.get(b.id) ?? 99)
      ));
    }
  };

  const handleSaveArticle = async () => {
    if (!artTitle.trim() || !artCategoryId) return toast.error("Title and category are required");
    const slug = slugify(artTitle);
    const tagArr = artTags.split(",").map((t) => t.trim()).filter(Boolean);
    const payload = {
      title: artTitle,
      slug,
      category_id: artCategoryId,
      excerpt: artExcerpt || null,
      content: artContent,
      image_url: artImageUrl || null,
      og_image_url: artOgImageUrl || null,
      is_published: artPublished,
      meta_title: artMetaTitle || null,
      meta_description: artMetaDesc || null,
      author_name: artAuthor || "Agever's Editorial",
      tags: tagArr,
      scheduled_publish_at: artScheduledAt && !artPublished ? new Date(artScheduledAt).toISOString() : null,
    };

    let articleId: string;
    if (editingArticle) {
      const { error } = await supabase.from("news_articles").update(payload).eq("id", editingArticle.id);
      if (error) return toast.error(error.message);
      articleId = editingArticle.id;
      toast.success("News article updated");
    } else {
      const { data, error } = await supabase.from("news_articles").insert(payload).select("id").single();
      if (error) return toast.error(error.message);
      articleId = (data as any).id;
      toast.success("News article created");
    }

    // Sync related products
    await supabase.from("news_related_products").delete().eq("article_id", articleId);
    if (relatedProducts.length > 0) {
      await supabase.from("news_related_products").insert(
        relatedProducts.map((p, idx) => ({
          article_id: articleId,
          allowed_product_id: p.id,
          display_order: idx,
        }))
      );
    }

    resetArticleForm();
    fetchAll();
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    await supabase.from("news_articles").delete().eq("id", id);
    toast.success("Article deleted");
    fetchAll();
  };

  const handleTogglePublish = async (a: Article) => {
    await supabase.from("news_articles").update({ is_published: !a.is_published }).eq("id", a.id);
    fetchAll();
  };

  const handleInlineSchedule = async (articleId: string, value: string) => {
    const iso = value ? new Date(value).toISOString() : null;
    const { error } = await supabase
      .from("news_articles")
      .update({ scheduled_publish_at: iso })
      .eq("id", articleId);
    if (error) return toast.error(error.message);
    toast.success(iso ? "Scheduled" : "Schedule cleared");
    setArticles((prev) => prev.map((a) => (a.id === articleId ? { ...a, scheduled_publish_at: iso } : a)));
  };

  // AI Draft Generator
  const generateAIDraft = async () => {
    if (!aiPrompt.trim()) return toast.error("Describe what the article should be about");
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-descriptions", {
        body: {
          mode: "news_article",
          prompt: aiPrompt,
          existing_title: artTitle || undefined,
        },
      });
      if (error) throw error;
      const result = data as any;
      if (result?.title && !artTitle) setArtTitle(result.title);
      if (result?.excerpt) setArtExcerpt(result.excerpt);
      if (result?.content) setArtContent(result.content);
      if (result?.meta_title && !artMetaTitle) setArtMetaTitle(result.meta_title);
      if (result?.meta_description && !artMetaDesc) setArtMetaDesc(result.meta_description);
      if (result?.tags && !artTags) setArtTags(result.tags.join(", "));
      toast.success("AI draft generated — review & edit before publishing");
    } catch (err: any) {
      toast.error("AI generation failed: " + (err.message || "unknown"));
    } finally {
      setAiLoading(false);
    }
  };

  // Image upload
  const handleImageUpload = async (file: File, target: "main" | "og") => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `news/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed: " + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    if (target === "main") setArtImageUrl(urlData.publicUrl);
    else setArtOgImageUrl(urlData.publicUrl);
    toast.success("Image uploaded");
    setUploading(false);
  };

  // Product search for related linking
  useEffect(() => {
    if (!productSearch.trim() || productSearch.length < 2) { setProductResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("allowed_products")
        .select("id, title, platform, image_url")
        .ilike("title", `%${productSearch}%`)
        .limit(10);
      setProductResults((data as any[]) || []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch]);

  const addRelated = (p: ProductPick) => {
    if (relatedProducts.find((r) => r.id === p.id)) return;
    if (relatedProducts.length >= 6) { toast.error("Maximum 6 related products"); return; }
    setRelatedProducts([...relatedProducts, p]);
    setProductSearch("");
    setProductResults([]);
  };

  const removeRelated = (id: string) => setRelatedProducts(relatedProducts.filter((p) => p.id !== id));

  const filteredArticles = activeCatFilter
    ? articles.filter((a) => a.category_id === activeCatFilter)
    : articles;

  const getCatName = (id: string) => categories.find((c) => c.id === id)?.name || "—";

  const [autoGenLoading, setAutoGenLoading] = useState(false);
  const handleAutoGenerateNews = async () => {
    if (!confirm("Generate a fresh news article from this week's gaming trends? It will be auto-published.")) return;
    setAutoGenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-generate-news", { body: {} });
      if (error) throw error;
      if ((data as any)?.ok) {
        toast.success(`Article created: ${(data as any).title}`);
        fetchAll();
      } else {
        throw new Error((data as any)?.error || "Generation failed");
      }
    } catch (e: any) {
      toast.error("Auto-generation failed: " + (e.message || "unknown"));
    } finally {
      setAutoGenLoading(false);
    }
  };

  if (loading) return <p className="text-muted-foreground p-8">Loading...</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-black tracking-wider text-foreground flex items-center gap-2">
          <Newspaper className="h-6 w-6 text-primary" /> News Manager
        </h2>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={autoGenLoading}
          onClick={handleAutoGenerateNews}
        >
          <Zap className="h-3.5 w-3.5" />
          {autoGenLoading ? "Generating..." : "Auto-Generate Today's News"}
        </Button>
      </div>

      {/* CATEGORIES */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-bold tracking-wider text-foreground">CATEGORIES</h3>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setShowCatForm(true); setEditingCat(null); setCatName(""); setCatDesc(""); }}>
            <FolderPlus className="h-3.5 w-3.5" /> Add Category
          </Button>
        </div>

        {showCatForm && (
          <div className="mb-4 p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
            <Input placeholder="Category name" value={catName} onChange={(e) => setCatName(e.target.value)} />
            <Input placeholder="Description (optional)" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" onClick={handleSaveCategory}><Save className="h-3.5 w-3.5" /> Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowCatForm(false); setEditingCat(null); }}><X className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition-colors">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveCatFilter(activeCatFilter === cat.id ? null : cat.id)}
                  className={`font-display text-sm font-bold ${activeCatFilter === cat.id ? "text-primary" : "text-foreground"} hover:text-primary transition-colors`}
                >
                  {cat.name}
                </button>
                <span className="text-xs text-muted-foreground">
                  ({articles.filter((a) => a.category_id === cat.id).length} articles)
                </span>
                {!cat.is_active && <span className="text-xs text-destructive font-bold">Hidden</span>}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleToggleCatActive(cat)} title={cat.is_active ? "Hide" : "Show"}>
                  {cat.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingCat(cat); setCatName(cat.name); setCatDesc(cat.description || ""); setShowCatForm(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {categories.length === 0 && <p className="text-xs text-muted-foreground">No categories yet.</p>}
        </div>
      </div>

      {/* ARTICLES */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-bold tracking-wider text-foreground">
            ARTICLES {activeCatFilter ? `— ${getCatName(activeCatFilter)}` : ""}
          </h3>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { resetArticleForm(); setShowArticleForm(true); if (activeCatFilter) setArtCategoryId(activeCatFilter); }}>
            <Plus className="h-3.5 w-3.5" /> Add Article
          </Button>
        </div>

        {showArticleForm && (
          <div className="mb-4 p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
            {/* AI Draft */}
            <div className="p-3 rounded-md bg-primary/5 border border-primary/20 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-display font-bold tracking-wider text-primary">AI DRAFT GENERATOR</span>
              </div>
              <textarea
                placeholder="Describe the article (e.g. 'GTA 6 launch deals — what to expect, pricing strategy, pre-order tips')"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground font-body resize-y focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button size="sm" className="gap-1.5" disabled={aiLoading} onClick={generateAIDraft}>
                <Sparkles className="h-3.5 w-3.5" /> {aiLoading ? "Generating..." : "Generate Draft"}
              </Button>
            </div>

            <Input placeholder="Article title (H1)" value={artTitle} onChange={(e) => setArtTitle(e.target.value)} />
            <select
              value={artCategoryId}
              onChange={(e) => setArtCategoryId(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground"
            >
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Input placeholder="Excerpt (short summary)" value={artExcerpt} onChange={(e) => setArtExcerpt(e.target.value)} />
            <Input placeholder="Author name" value={artAuthor} onChange={(e) => setArtAuthor(e.target.value)} />
            <Input placeholder="Tags (comma-separated, e.g. gta6, rockstar, release)" value={artTags} onChange={(e) => setArtTags(e.target.value)} />

            {/* Main image */}
            <div className="space-y-1.5">
              <label className="text-xs font-display font-bold text-muted-foreground">Cover Image</label>
              <div className="flex gap-2 items-end">
                <Input placeholder="Image URL" value={artImageUrl} onChange={(e) => setArtImageUrl(e.target.value)} />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    handleImageUpload(f, "main");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
                <Button type="button" size="sm" variant="outline" className="gap-1.5 shrink-0" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> {uploading ? "..." : "Upload"}
                </Button>
              </div>
              {artImageUrl && <img src={artImageUrl} alt="Preview" className="h-20 rounded-md object-cover" />}
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <label className="text-xs font-display font-bold text-muted-foreground">Content (Markdown — use ## for H2, ### for H3)</label>
              <textarea
                placeholder="## Section heading&#10;&#10;Article body..."
                value={artContent}
                onChange={(e) => setArtContent(e.target.value)}
                rows={14}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground font-body resize-y focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* SEO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Meta title (SEO)" value={artMetaTitle} onChange={(e) => setArtMetaTitle(e.target.value)} />
              <Input placeholder="OG image URL (social share)" value={artOgImageUrl} onChange={(e) => setArtOgImageUrl(e.target.value)} />
            </div>
            <Input placeholder="Meta description (SEO, <160 chars)" value={artMetaDesc} onChange={(e) => setArtMetaDesc(e.target.value)} />

            {/* Related products */}
            <div className="space-y-2 p-3 rounded-md bg-background/40 border border-border">
              <label className="text-xs font-display font-bold text-muted-foreground">
                Related Products ({relatedProducts.length}/6) — manual picks override auto-suggest
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search products to link..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 rounded-md bg-secondary border border-border text-sm text-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {productResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-background border border-border rounded-md shadow-xl max-h-60 overflow-y-auto">
                    {productResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addRelated(p)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
                      >
                        {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-body text-foreground line-clamp-1">{p.title}</div>
                          <div className="text-[10px] text-muted-foreground">{p.platform}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {relatedProducts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {relatedProducts.map((p) => (
                    <div key={p.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/30 text-xs">
                      <span className="text-foreground line-clamp-1 max-w-[180px]">{p.title}</span>
                      <button onClick={() => removeRelated(p.id)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-body text-foreground">
                  <input type="checkbox" checked={artPublished} onChange={(e) => setArtPublished(e.target.checked)} className="h-4 w-4" />
                  Published (visible on site)
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-display font-bold tracking-wider text-muted-foreground whitespace-nowrap">
                    Schedule auto-publish:
                  </label>
                  <Input
                    type="datetime-local"
                    value={artScheduledAt}
                    onChange={(e) => setArtScheduledAt(e.target.value)}
                    disabled={artPublished}
                    className="h-8 w-auto text-xs"
                    title={artPublished ? "Uncheck Published to schedule" : "Article will auto-publish at this date/time"}
                  />
                  {artScheduledAt && !artPublished && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setArtScheduledAt("")}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="gap-1.5" onClick={handleSaveArticle}><Save className="h-3.5 w-3.5" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={resetArticleForm}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {filteredArticles.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition-colors">
              <Link
                to={`/news/${a.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 min-w-0 flex-1 group"
                title="Open article in new tab"
              >
                {a.image_url && <img src={a.image_url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors inline-flex items-center gap-1.5">
                    {a.title}
                    <ExternalLink className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">{getCatName(a.category_id)}</span>
                    {a.is_published ? (
                      <span className="text-[10px] font-display font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">PUBLISHED</span>
                    ) : a.scheduled_publish_at ? (
                      <span className="text-[10px] font-display font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 inline-flex items-center gap-1">
                        SCHEDULED · {new Date(a.scheduled_publish_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    ) : (
                      <span className="text-[10px] font-display font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">DRAFT</span>
                    )}
                    {a.published_at && a.is_published && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(a.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                {!a.is_published && (
                  <InlineScheduler
                    articleId={a.id}
                    initialValue={a.scheduled_publish_at}
                    onSave={handleInlineSchedule}
                  />
                )}
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleTogglePublish(a)} title={a.is_published ? "Unpublish" : "Publish"}>
                  {a.is_published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditArticle(a)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteArticle(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {filteredArticles.length === 0 && <p className="text-xs text-muted-foreground">No articles yet.</p>}
        </div>
      </div>
    </div>
  );
};

// Inline scheduler with local state — prevents auto-saving on every keystroke
const InlineScheduler = ({
  articleId,
  initialValue,
  onSave,
}: {
  articleId: string;
  initialValue: string | null;
  onSave: (id: string, value: string) => Promise<unknown> | unknown;
}) => {
  const padN = (n: number) => String(n).padStart(2, "0");
  const toLocalInput = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getFullYear()}-${padN(d.getMonth() + 1)}-${padN(d.getDate())}T${padN(d.getHours())}:${padN(d.getMinutes())}`;
  };
  const formatted = toLocalInput(initialValue);
  const [value, setValue] = useState(formatted);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(formatted);
    setDirty(false);
  }, [formatted]);

  const handleSave = async () => {
    if (!value) return;
    const year = new Date(value).getFullYear();
    if (isNaN(year) || year < 2024 || year > 2099) {
      toast.error("Please enter a valid date with a 4-digit year");
      return;
    }
    await onSave(articleId, value);
    setDirty(false);
  };

  const handleClear = async () => {
    setValue("");
    setDirty(false);
    await onSave(articleId, "");
  };

  // Parse current value into a Date for the calendar (defaults to today's time portion if empty)
  const selectedDate = value ? new Date(value) : undefined;

  const pad = (n: number) => String(n).padStart(2, "0");

  // Build a local datetime-local string from parts
  const buildLocal = (date: Date, hours: number, minutes: number) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hours)}:${pad(minutes)}`;

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    const existing = value ? new Date(value) : null;
    const hours = existing ? existing.getHours() : 15;
    const minutes = existing ? existing.getMinutes() : 0;
    const local = buildLocal(date, hours, minutes);
    setValue(local);
    setDirty(local !== formatted);
  };

  // Current hour/minute parsed from value
  const currentHour = value ? new Date(value).getHours() : 15;
  const currentMinute = value ? new Date(value).getMinutes() : 0;

  const updateTime = (h: number, m: number) => {
    const base = value ? new Date(value) : new Date();
    const local = buildLocal(base, h, m);
    setValue(local);
    setDirty(local !== formatted);
  };

  return (
    <div className="flex items-center gap-1 mr-2 px-2 py-1 rounded-md bg-background/60 border border-border">
      <span className="text-[10px] font-display font-bold tracking-wider text-muted-foreground whitespace-nowrap">SCHEDULE:</span>
      <Input
        type="date"
        value={value ? value.slice(0, 10) : ""}
        min="2024-01-01"
        max="2099-12-31"
        onChange={(e) => {
          if (!e.target.value) { setValue(""); setDirty("" !== formatted); return; }
          const [y, mo, d] = e.target.value.split("-").map(Number);
          const date = new Date(y, mo - 1, d);
          const local = buildLocal(date, currentHour, currentMinute);
          setValue(local);
          setDirty(local !== formatted);
        }}
        className="h-7 w-[130px] text-[11px] px-1.5"
        title="Pick a date"
      />
      <select
        value={currentHour}
        onChange={(e) => updateTime(Number(e.target.value), currentMinute)}
        className="h-7 px-1 rounded-md bg-secondary border border-border text-[11px] text-foreground cursor-pointer"
        title="Hour"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{pad(i)}</option>
        ))}
      </select>
      <span className="text-[11px] text-muted-foreground">:</span>
      <select
        value={currentMinute}
        onChange={(e) => updateTime(currentHour, Number(e.target.value))}
        className="h-7 px-1 rounded-md bg-secondary border border-border text-[11px] text-foreground cursor-pointer"
        title="Minute"
      >
        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
          <option key={m} value={m}>{pad(m)}</option>
        ))}
      </select>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            title="Pick from calendar"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50 bg-popover" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || d > new Date("2099-12-31")}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {dirty && value && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 text-emerald-500 hover:text-emerald-400"
          onClick={handleSave}
          title="Save schedule"
        >
          <Save className="h-3 w-3" />
        </Button>
      )}
      {initialValue && !dirty && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleClear}
          title="Clear schedule"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

export default AdminNews;
