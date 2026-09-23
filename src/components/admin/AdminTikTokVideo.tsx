import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Copy, Download, RefreshCw, Video, Play } from "lucide-react";

interface TikTokPost {
  title: string;
  caption: string;
  hashtags: string;
  videoUrl: string;
  imageUrl: string | null;
  price: number | null;
  platform: string;
  productUrl: string;
}

const AdminTikTokVideo = () => {
  const [post, setPost] = useState<TikTokPost | null>(null);
  const [loading, setLoading] = useState(false);

  const generateTikTok = async () => {
    setLoading(true);
    setPost(null);

    try {
      // Fetch products that have video_url
      const { data: prods } = await supabase
        .from("allowed_products")
        .select("id, title, image_url, video_url, platform, store, region")
        .not("video_url", "is", null)
        .not("image_url", "is", null)
        .order("sold_count", { ascending: false })
        .limit(20);

      if (!prods || prods.length === 0) {
        toast.error("לא נמצאו מוצרים עם סרטון");
        setLoading(false);
        return;
      }

      // Pick random product
      const prod = prods[Math.floor(Math.random() * prods.length)];

      // Fetch price
      const { data: kinguinData } = await supabase.rpc("get_public_kinguin_by_ids", {
        _ids: [prod.id],
      });
      const price = kinguinData?.[0]?.sell_price || null;

      // Generate AI caption
      const seed = Math.random().toString(36).slice(2, 8);
      const prompt = `[seed:${seed}] Write a short, viral TikTok video caption for this game:

Product: ${prod.title}
Platform: ${prod.platform}
Store: ${prod.store}
Region: ${prod.region}
${price ? `Price: €${price.toFixed(2)}` : ""}

Rules:
- The caption should be in English, punchy and TikTok-style (Gen Z friendly)
- Mention that you can get this game at the LOWEST PRICE on agevers.com
- Emphasize that Agevers is the most RELIABLE and TRUSTED site for game keys
- Include "Instant delivery" or "Key delivered instantly"
- Use emojis heavily 🎮🔥💰⚡
- Max 150 characters for the main caption
- Add 8-10 relevant TikTok hashtags separately

Format as JSON: {"caption": "...", "hashtags": "#gaming #tiktok ..."}`;

      const { data: aiData, error: aiError } = await supabase.functions.invoke("admin-ai-chat", {
        body: {
          messages: [
            { role: "system", content: "You are a viral TikTok content creator for gaming. Always respond with valid JSON only, no markdown." },
            { role: "user", content: prompt },
          ],
        },
      });

      let caption = `🎮 Get ${prod.title} at the LOWEST price! 💰⚡ Instant delivery on agevers.com — the most trusted game key site! 🔥`;
      let hashtags = "#gaming #gamekeys #cheapgames #pcgaming #agevers #tiktokgaming #gamer #deals";

      if (!aiError && aiData) {
        try {
          const reply = aiData?.reply || aiData?.message || "";
          const jsonMatch = reply.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.caption) caption = parsed.caption;
            if (parsed.hashtags) hashtags = parsed.hashtags;
          }
        } catch (e) {
          console.error("Failed to parse AI TikTok response:", e);
        }
      }

      setPost({
        title: prod.title,
        caption,
        hashtags,
        videoUrl: prod.video_url!,
        imageUrl: prod.image_url,
        price,
        platform: prod.platform,
        productUrl: `https://agevers.com/product/${prod.id}`,
      });

      toast.success("סרטון TikTok מוכן!");
    } catch (err: any) {
      console.error("Error generating TikTok:", err);
      toast.error("שגיאה ביצירת סרטון: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("הועתק ללוח!");
  };

  const getYouTubeId = (url: string): string | null => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  const isYouTubeUrl = (url: string): boolean => !!getYouTubeId(url);

  const openVideo = (url: string) => {
    window.open(url, "_blank");
    toast.success("הסרטון נפתח בטאב חדש");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          TikTok Video Generator
        </h2>
      </div>

      <p className="text-xs text-muted-foreground">
        בוחר מוצר אקראי עם סרטון מהקטלוג, מייצר כיתוב TikTok ויראלי עם AI, ומאפשר הורדת הסרטון + העתקת הכיתוב לפרסום.
      </p>

      {/* Generate button */}
      <Button
        onClick={generateTikTok}
        disabled={loading}
        className="w-full h-12 text-sm font-display font-bold tracking-wider"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            מייצר סרטון TikTok...
          </>
        ) : (
          <>
            <Play className="h-4 w-4 mr-2" />
            🎬 צור סרטון TikTok
          </>
        )}
      </Button>

      {/* Generated TikTok post */}
      {post && (
        <div className="bg-secondary/30 border border-border/50 rounded-xl p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-display font-bold text-primary">
              🎬 TikTok — {post.title}
            </span>
            {post.price && (
              <span className="text-xs font-bold text-green-400">€{post.price.toFixed(2)}</span>
            )}
          </div>

          {/* Video preview */}
          <div className="relative rounded-lg overflow-hidden bg-black aspect-[9/16] max-h-[400px] mx-auto">
            {isYouTubeUrl(post.videoUrl) ? (
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeId(post.videoUrl)}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={post.videoUrl}
                controls
                className="w-full h-full object-contain"
                poster={post.imageUrl || undefined}
              />
            )}
          </div>

          {/* Open video */}
          <Button
            onClick={() => openVideo(post.videoUrl)}
            className="w-full h-10 text-xs font-display font-bold"
            variant="outline"
          >
            <Play className="h-3.5 w-3.5 mr-2" />
            פתח סרטון
          </Button>

          {/* Caption */}
          <div className="bg-background/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-bold text-muted-foreground">כיתוב:</p>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {post.caption}
            </p>
            <p className="text-xs text-primary/70 mt-2">{post.hashtags}</p>
          </div>

          {/* Link */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>🔗</span>
            <span className="truncate">{post.productUrl}</span>
          </div>

          {/* Copy actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-display"
              onClick={() => copyToClipboard(`${post.caption}\n\n${post.hashtags}\n\n🔗 ${post.productUrl}`)}
            >
              <Copy className="h-3 w-3 mr-1.5" />
              העתק הכל
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-display"
              onClick={() => copyToClipboard(post.caption)}
            >
              <Copy className="h-3 w-3 mr-1.5" />
              כיתוב בלבד
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
          </div>

          {/* Regenerate */}
          <Button
            variant="outline"
            onClick={generateTikTok}
            disabled={loading}
            className="w-full h-10 text-xs font-display font-bold"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            צור סרטון חדש
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminTikTokVideo;
