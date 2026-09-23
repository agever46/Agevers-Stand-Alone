import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, Save, X, Eye, EyeOff, FolderPlus, BookOpen, GripVertical, ArrowRightLeft, Upload,
  Sparkles,
} from "lucide-react";

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
  is_published: boolean;
  meta_title: string | null;
  meta_description: string | null;
  display_order: number;
}

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const AdminGuides = () => {
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
  const [artMetaTitle, setArtMetaTitle] = useState("");
  const [artMetaDesc, setArtMetaDesc] = useState("");
  const [artPublished, setArtPublished] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Active category filter
  const [activeCatFilter, setActiveCatFilter] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [catRes, artRes] = await Promise.all([
      supabase.from("guide_categories").select("*").order("display_order"),
      supabase.from("guide_articles").select("*").order("display_order"),
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
      const { error } = await supabase.from("guide_categories").update({ name: catName, slug, description: catDesc || null }).eq("id", editingCat.id);
      if (error) return toast.error(error.message);
      toast.success("Category updated");
    } else {
      const { error } = await supabase.from("guide_categories").insert({ name: catName, slug, description: catDesc || null, display_order: categories.length });
      if (error) return toast.error(error.message);
      toast.success("Category created");
    }
    setCatName(""); setCatDesc(""); setEditingCat(null); setShowCatForm(false);
    fetchAll();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category and all its articles?")) return;
    await supabase.from("guide_categories").delete().eq("id", id);
    toast.success("Category deleted");
    fetchAll();
  };

  const handleToggleCatActive = async (cat: Category) => {
    await supabase.from("guide_categories").update({ is_active: !cat.is_active }).eq("id", cat.id);
    fetchAll();
  };

  // Article CRUD
  const resetArticleForm = () => {
    setArtTitle(""); setArtCategoryId(""); setArtExcerpt(""); setArtContent("");
    setArtImageUrl(""); setArtMetaTitle(""); setArtMetaDesc(""); setArtPublished(false);
    setEditingArticle(null); setShowArticleForm(false);
  };

  const openEditArticle = (a: Article) => {
    setEditingArticle(a);
    setArtTitle(a.title); setArtCategoryId(a.category_id); setArtExcerpt(a.excerpt || "");
    setArtContent(a.content); setArtImageUrl(a.image_url || "");
    setArtMetaTitle(a.meta_title || ""); setArtMetaDesc(a.meta_description || "");
    setArtPublished(a.is_published);
    setShowArticleForm(true);
  };

  const handleSaveArticle = async () => {
    if (!artTitle.trim() || !artCategoryId) return toast.error("Title and category are required");
    const slug = slugify(artTitle);
    const payload = {
      title: artTitle, slug, category_id: artCategoryId, excerpt: artExcerpt || null,
      content: artContent, image_url: artImageUrl || null, is_published: artPublished,
      meta_title: artMetaTitle || null, meta_description: artMetaDesc || null,
    };
    if (editingArticle) {
      const { error } = await supabase.from("guide_articles").update(payload).eq("id", editingArticle.id);
      if (error) return toast.error(error.message);
      toast.success("Article updated");
    } else {
      const { error } = await supabase.from("guide_articles").insert({ ...payload, display_order: articles.length });
      if (error) return toast.error(error.message);
      toast.success("Article created");
    }
    resetArticleForm();
    fetchAll();
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    await supabase.from("guide_articles").delete().eq("id", id);
    toast.success("Article deleted");
    fetchAll();
  };

  const handleTogglePublish = async (a: Article) => {
    await supabase.from("guide_articles").update({ is_published: !a.is_published }).eq("id", a.id);
    fetchAll();
  };

  const handleMoveArticle = async (articleId: string, newCategoryId: string) => {
    const { error } = await supabase.from("guide_articles").update({ category_id: newCategoryId }).eq("id", articleId);
    if (error) return toast.error(error.message);
    toast.success("Article moved");
    fetchAll();
  };

  const filteredArticles = activeCatFilter
    ? articles.filter((a) => a.category_id === activeCatFilter)
    : articles;

  const getCatName = (id: string) => categories.find((c) => c.id === id)?.name || "—";

  const [autoGenLoading, setAutoGenLoading] = useState(false);
  const [autoGenCount, setAutoGenCount] = useState(5);
  const handleAutoGenerateGuides = async () => {
    if (!confirm(`Auto-generate ${autoGenCount} buying guides for top-selling products? They will be auto-published.`)) return;
    setAutoGenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-generate-guide", {
        body: { limit: autoGenCount },
      });
      if (error) throw error;
      const d = data as any;
      if (d?.ok) {
        toast.success(`Generated ${d.generated}/${d.attempted} guides`);
        fetchAll();
      } else {
        throw new Error(d?.error || "Generation failed");
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
          <BookOpen className="h-6 w-6 text-primary" /> Help & Guides
        </h2>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={20}
            value={autoGenCount}
            onChange={(e) => setAutoGenCount(Math.min(Math.max(parseInt(e.target.value) || 1, 1), 20))}
            className="w-16 h-9"
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={autoGenLoading}
            onClick={handleAutoGenerateGuides}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {autoGenLoading ? "Generating..." : "Auto-Generate Guides"}
          </Button>
        </div>
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
            <Input placeholder="Article title" value={artTitle} onChange={(e) => setArtTitle(e.target.value)} />
            <select
              value={artCategoryId}
              onChange={(e) => setArtCategoryId(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground"
            >
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Input placeholder="Excerpt (short description)" value={artExcerpt} onChange={(e) => setArtExcerpt(e.target.value)} />
            <div className="space-y-1.5">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input placeholder="Image URL (optional)" value={artImageUrl} onChange={(e) => setArtImageUrl(e.target.value)} />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    const ext = file.name.split(".").pop();
                    const path = `guides/${Date.now()}.${ext}`;
                    const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
                    if (error) { toast.error("Upload failed: " + error.message); setUploading(false); return; }
                    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
                    setArtImageUrl(urlData.publicUrl);
                    toast.success("Image uploaded");
                    setUploading(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
              {artImageUrl && (
                <img src={artImageUrl} alt="Preview" className="h-20 rounded-md object-cover" />
              )}
            </div>
            <textarea
              placeholder="Content (Markdown supported)"
              value={artContent}
              onChange={(e) => setArtContent(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground font-body resize-y focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="SEO Title (optional)" value={artMetaTitle} onChange={(e) => setArtMetaTitle(e.target.value)} />
              <Input placeholder="SEO Description (optional)" value={artMetaDesc} onChange={(e) => setArtMetaDesc(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={artPublished} onChange={(e) => setArtPublished(e.target.checked)} className="accent-primary" />
              Published (visible to public)
            </label>
            <div className="flex gap-2">
              <Button size="sm" className="gap-1.5" onClick={handleSaveArticle}><Save className="h-3.5 w-3.5" /> Save</Button>
              <Button size="sm" variant="ghost" onClick={resetArticleForm}><X className="h-3.5 w-3.5" /> Cancel</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {filteredArticles.map((art) => (
            <div key={art.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition-colors">
              <div className="flex-1 min-w-0 mr-3">
                <Link to={`/guides/${art.slug}`} target="_blank" className="font-display text-sm font-bold text-foreground hover:text-primary transition-colors truncate block">{art.title}</Link>
                <p className="text-xs text-muted-foreground">{getCatName(art.category_id)} · /guides/{art.slug}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <select
                  value={art.category_id}
                  onChange={(e) => handleMoveArticle(art.id, e.target.value)}
                  className="h-7 px-1.5 rounded bg-secondary border border-border text-[10px] text-foreground cursor-pointer"
                  title="Move to category"
                >
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${art.is_published ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {art.is_published ? "Live" : "Draft"}
                </span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleTogglePublish(art)} title={art.is_published ? "Unpublish" : "Publish"}>
                  {art.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditArticle(art)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteArticle(art.id)}>
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

export default AdminGuides;
