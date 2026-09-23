import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Wand2, Save, Eye, Loader2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const AdminSEOGenerator = () => {
  const [keyword, setKeyword] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<{
    title: string;
    slug: string;
    excerpt: string;
    content: string;
  } | null>(null);

  const handleGenerate = async () => {
    if (!keyword.trim()) {
      toast.error("Please enter a target keyword");
      return;
    }

    setIsGenerating(true);
    setGeneratedContent(null);

    try {
      const { data, error } = await supabase.functions.invoke("seo-article-generator", {
        body: { keyword },
      });

      if (error) throw error;
      setGeneratedContent(data);
      toast.success("Article generated successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to generate article");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!generatedContent) return;

    setIsPublishing(true);
    try {
      const { error } = await supabase.from("seo_articles").insert({
        title: generatedContent.title,
        slug: generatedContent.slug,
        excerpt: generatedContent.excerpt,
        content: generatedContent.content,
        status: "published",
      });

      if (error) throw error;
      toast.success("Article published successfully!");
      setGeneratedContent(null);
      setKeyword("");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to publish article");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-black tracking-wider text-foreground">
            SEO <span className="text-primary">Generator</span>
          </h2>
          <p className="text-muted-foreground text-sm">
            Generate high-quality SEO blog posts using Google Gemini AI.
          </p>
        </div>
      </div>

      <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="keyword" className="text-sm font-bold tracking-wide">Target Keyword</Label>
            <div className="flex gap-3">
              <Input
                id="keyword"
                placeholder="e.g., GTA 6 cheap pre-order keys"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="flex-1 bg-background/50 border-primary/10"
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              />
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating}
                className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate Article
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {generatedContent && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 duration-500">
          <Card className="lg:col-span-2 p-6 bg-card/50 backdrop-blur-sm border-primary/20 space-y-6">
            <div className="flex items-center justify-between border-b border-primary/10 pb-4">
              <div className="flex items-center gap-2 text-primary font-bold">
                <Eye className="h-5 w-5" />
                Live Preview
              </div>
              <Badge variant="outline" className="border-primary/40 text-primary">Draft</Badge>
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl font-display font-black text-foreground">
                {generatedContent.title}
              </h1>
              
              <div className="prose prose-invert prose-purple max-w-none">
                <div dangerouslySetInnerHTML={{ __html: generatedContent.content }} />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20 h-fit sticky top-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">SEO Slug</Label>
                <div className="flex items-center gap-2 p-2 rounded bg-background/50 border border-primary/10 text-xs font-mono break-all">
                  <Globe className="h-3 w-3 text-primary shrink-0" />
                  /blog/{generatedContent.slug}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Meta Description</Label>
                <p className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-primary/20 pl-3">
                  {generatedContent.excerpt}
                </p>
              </div>

              <Button 
                onClick={handlePublish} 
                disabled={isPublishing}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-black py-6 text-lg shadow-[0_0_20px_rgba(22,163,74,0.3)] transition-all active:scale-[0.98]"
              >
                {isPublishing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Save className="mr-2 h-5 w-5" />
                    PUBLISH TO BLOG
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminSEOGenerator;
