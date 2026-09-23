import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  Copy,
  Download,
  RefreshCw,
  Sparkles,
  Twitter,
  Instagram,
  ShoppingBag,
  Flame,
  Tag,
  Clock,
  Video,
  FileText,
} from "lucide-react";
import AdminTikTokVideo from "./AdminTikTokVideo";

type PostType = "new_products" | "bestsellers" | "deals" | "preorders";

interface GeneratedPost {
  type: PostType;
  title: string;
  text: string;
  hashtags: string;
  imageUrl: string | null;
  productUrl: string;
}

const POST_TYPE_CONFIG: Record<PostType, { label: string; icon: React.ElementType; color: string }> = {
  new_products: { label: "מוצרים חדשים", icon: ShoppingBag, color: "text-blue-400" },
  bestsellers: { label: "Bestsellers", icon: Flame, color: "text-orange-400" },
  deals: { label: "מבצעים והנחות", icon: Tag, color: "text-green-400" },
  preorders: { label: "Pre-Orders", icon: Clock, color: "text-purple-400" },
};

const AdminSocialPosts = () => {
  const [selectedType, setSelectedType] = useState<PostType>("new_products");
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"posts" | "tiktok">("posts");

  const fetchProductsByType = async (type: PostType) => {
    let query = supabase
      .from("allowed_products")
      .select("id, title, image_url, platform, store, region, release_date")
      .not("image_url", "is", null);

    switch (type) {
      case "new_products":
        query = query.order("created_at", { ascending: false }).limit(10);
        break;
      case "bestsellers":
        query = query.order("sold_count", { ascending: false }).limit(10);
        break;
      case "preorders": {
        const today = new Date().toISOString().split("T")[0];
        query = query.gt("release_date", today).order("release_date", { ascending: true }).limit(10);
        break;
      }
      case "deals":
        query = query.order("wishlist_count", { ascending: false }).limit(10);
        break;
    }

    const { data } = await query;
    return data || [];
  };

  const generatePosts = async () => {
    setLoading(true);
    setPosts([]);

    try {
      const prods = await fetchProductsByType(selectedType);
      setProducts(prods);

      if (prods.length === 0) {
        toast.error("לא נמצאו מוצרים לקטגוריה זו");
        setLoading(false);
        return;
      }

      // Fetch prices for these products
      const ids = prods.map((p: any) => p.id);
      const { data: kinguinData } = await supabase.rpc("get_public_kinguin_by_ids", { _ids: ids });
      const priceMap = new Map<string, number>();
      if (kinguinData) {
        (kinguinData as any[]).forEach((k: any) => {
          priceMap.set(k.allowed_product_id, k.sell_price);
        });
      }

      // Generate AI posts
      // Shuffle products for variety each time
      const shuffled = [...prods].sort(() => Math.random() - 0.5);
      const productList = shuffled.slice(0, 5).map((p: any) => {
        const price = priceMap.get(p.id);
        return `- ${p.title} | Platform: ${p.platform} | Store: ${p.store || "N/A"} | Region: ${p.region || "Global"}${price ? ` | Price: €${price.toFixed(2)}` : ""}${p.release_date ? ` | Release: ${new Date(p.release_date).toLocaleDateString("en-GB")}` : ""}`;
      }).join("\n");

      const typePrompts: Record<PostType, string> = {
        new_products: "Create FOMO-driven social media posts about these BRAND NEW products just dropped in our store. Emphasize freshness, limited availability, and being first to grab them.",
        bestsellers: "Create social proof-driven posts about these TOP-SELLING products. Mention they're bestsellers, trusted by thousands, and flying off the shelves.",
        deals: "Create urgency-driven posts about these HOT DEALS. Highlight the amazing prices, savings, and that deals won't last forever.",
        preorders: "Create hype-driven posts about these upcoming PRE-ORDER titles. Build excitement about release dates and securing a copy early at the best price.",
      };

      const randomSeed = Math.random().toString(36).slice(2, 8);
      const prompt = `[seed:${randomSeed}] ${typePrompts[selectedType]}

Store: Agevers (agevers.com) — a trusted digital game keys & gift cards marketplace with instant delivery.

Products:
${productList}

Rules:
- Each post MUST mention the product name, platform, and price (if available)
- Include a clear call-to-action (e.g. "Grab yours now", "Don't miss out", "Shop now at agevers.com")
- Use emojis strategically to grab attention (🔥🎮💰⚡🚀💎)
- Keep it punchy and scroll-stopping — max 280 chars for Twitter
- Mention "Instant delivery" or "Instant key" when relevant
- Generate exactly 3 different posts with different angles/styles

- Be creative and vary your style — never repeat the same phrasing twice
- Each post should feature a DIFFERENT product from the list

Format your response as JSON array:
[{"text": "...", "hashtags": "#gaming #deals ..."}]`;

      const { data: aiData, error: aiError } = await supabase.functions.invoke("admin-ai-chat", {
        body: {
          messages: [
            { role: "system", content: "You are a social media marketing expert for a digital game keys store called Agevers. Always respond with valid JSON only, no markdown." },
            { role: "user", content: prompt },
          ],
        },
      });

      if (aiError) throw aiError;

      let aiPosts: { text: string; hashtags: string }[] = [];
      try {
        const reply = aiData?.reply || aiData?.message || "";
        // Extract JSON from reply
        const jsonMatch = reply.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          aiPosts = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Failed to parse AI response:", e);
      }

      if (aiPosts.length === 0) {
        // Fallback - generate simple posts
        aiPosts = shuffled.slice(0, 3).map((p: any) => {
          const price = priceMap.get(p.id);
          return {
            text: `🎮 ${p.title} now available at Agevers! ${price ? `Only €${price.toFixed(2)}` : "Best price guaranteed"} 🔥\n\n👉 agevers.com/product/${p.id}`,
            hashtags: "#gaming #gamekeys #pcgaming #deals #agevers",
          };
        });
      }

      const generated: GeneratedPost[] = aiPosts.map((post, i) => {
        const prod = prods[i % prods.length];
        return {
          type: selectedType,
          title: prod.title,
          text: post.text,
          hashtags: post.hashtags,
          imageUrl: prod.image_url,
          productUrl: `https://agevers.com/product/${prod.id}`,
        };
      });

      setPosts(generated);
      toast.success(`${generated.length} פוסטים נוצרו בהצלחה!`);
    } catch (err: any) {
      console.error("Error generating posts:", err);
      toast.error("שגיאה ביצירת הפוסטים: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("הועתק ללוח!");
  };

  const downloadImage = async (url: string, title: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.jpg`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success("התמונה הורדה!");
    } catch {
      toast.error("שגיאה בהורדת התמונה");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Social Media Generator
        </h2>
      </div>

      {/* Tab switcher */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setActiveTab("posts")}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-display font-bold ${
            activeTab === "posts"
              ? "bg-primary/10 border-primary text-primary shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
              : "bg-secondary/40 border-border/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          📝 פוסטים
        </button>
        <button
          onClick={() => setActiveTab("tiktok")}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-display font-bold ${
            activeTab === "tiktok"
              ? "bg-primary/10 border-primary text-primary shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
              : "bg-secondary/40 border-border/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <Video className="h-4 w-4" />
          🎬 TikTok
        </button>
      </div>

      {activeTab === "tiktok" ? (
        <AdminTikTokVideo />
      ) : (
      <>
      {/* Post type selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {(Object.entries(POST_TYPE_CONFIG) as [PostType, typeof POST_TYPE_CONFIG[PostType]][]).map(([type, config]) => {
          const Icon = config.icon;
          const isActive = selectedType === type;
          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-display font-bold ${
                isActive
                  ? "bg-primary/10 border-primary text-primary shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                  : "bg-secondary/40 border-border/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-primary" : config.color}`} />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Generate button */}
      <Button
        onClick={generatePosts}
        disabled={loading}
        className="w-full h-12 text-sm font-display font-bold tracking-wider"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            מייצר פוסטים עם AI...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            צור פוסטים — {POST_TYPE_CONFIG[selectedType].label}
          </>
        )}
      </Button>

      {/* Generated posts */}
      {posts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-display font-bold text-muted-foreground">
            {posts.length} פוסטים מוכנים לפרסום:
          </h3>

          {posts.map((post, i) => (
            <div
              key={i}
              className="bg-secondary/30 border border-border/50 rounded-xl p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-bold text-primary">
                  פוסט #{i + 1} — {post.title}
                </span>
                <div className="flex items-center gap-1">
                  <Twitter className="h-3.5 w-3.5 text-blue-400" />
                  <Instagram className="h-3.5 w-3.5 text-pink-400" />
                </div>
              </div>

              {/* Image */}
              {post.imageUrl && (
                <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-48">
                  <img
                    src={post.imageUrl}
                    alt={post.title}
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={() => downloadImage(post.imageUrl!, post.title)}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/70 hover:bg-black flex items-center justify-center text-white transition-colors"
                    title="Download image"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Text */}
              <div className="bg-background/50 rounded-lg p-3">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {post.text}
                </p>
                <p className="text-xs text-primary/70 mt-2">{post.hashtags}</p>
              </div>

              {/* Link */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>🔗</span>
                <span className="truncate">{post.productUrl}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-display"
                  onClick={() => copyToClipboard(`${post.text}\n\n${post.hashtags}\n\n${post.productUrl}`)}
                >
                  <Copy className="h-3 w-3 mr-1.5" />
                  העתק הכל
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-display"
                  onClick={() => copyToClipboard(post.text)}
                >
                  <Copy className="h-3 w-3 mr-1.5" />
                  טקסט בלבד
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-display"
                  onClick={() => copyToClipboard(post.hashtags)}
                >
                  <Copy className="h-3 w-3 mr-1.5" />
                  האשטגים
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-display"
                  onClick={() => copyToClipboard(post.productUrl)}
                >
                  <Copy className="h-3 w-3 mr-1.5" />
                  לינק
                </Button>
              </div>
            </div>
          ))}

          {/* Regenerate */}
          <Button
            variant="outline"
            onClick={generatePosts}
            disabled={loading}
            className="w-full h-10 text-xs font-display font-bold"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            צור פוסטים חדשים
          </Button>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default AdminSocialPosts;
