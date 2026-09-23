import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Send, Zap, Globe } from "lucide-react";

const AdminIndexNow = () => {
  const [urls, setUrls] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  const submit = async (mode: "manual" | "recent" | "all") => {
    setLoading(mode);
    setLastResult(null);
    try {
      const body: any = { mode };
      if (mode === "manual") {
        const list = urls
          .split(/[\s,\n]+/)
          .map((u) => u.trim())
          .filter(Boolean);
        if (list.length === 0) {
          toast.error("Enter at least one URL");
          setLoading(null);
          return;
        }
        body.urls = list;
      }
      const { data, error } = await supabase.functions.invoke("indexnow-submit", { body });
      if (error) throw error;
      setLastResult(data);
      toast.success(`Submitted ${data.submitted} URL(s) to IndexNow`);
    } catch (e: any) {
      toast.error(e.message || "Submission failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" /> IndexNow Submission
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Instantly notify Bing, Yandex, Seznam & Naver about new or updated URLs.
          Bing also feeds ChatGPT search.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Bulk submit</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => submit("recent")}
            disabled={loading !== null}
          >
            <Send className="h-4 w-4 mr-2" />
            {loading === "recent" ? "Submitting..." : "Submit Last 24h"}
          </Button>
          <Button
            variant="outline"
            onClick={() => submit("all")}
            disabled={loading !== null}
          >
            <Send className="h-4 w-4 mr-2" />
            {loading === "all" ? "Submitting..." : "Submit Entire Catalog"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          "Last 24h" pings only fresh content. "Entire Catalog" pings every product, news article and guide — use sparingly.
        </p>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Manual URLs</span>
        </div>
        <Textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          placeholder="https://agevers.com/product/...&#10;https://agevers.com/news/..."
          className="min-h-[120px] text-xs font-mono"
        />
        <Button onClick={() => submit("manual")} disabled={loading !== null || !urls.trim()}>
          <Send className="h-4 w-4 mr-2" />
          {loading === "manual" ? "Submitting..." : "Submit URLs"}
        </Button>
      </Card>

      {lastResult && (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-2">Last result</p>
          <pre className="text-[10px] bg-muted/50 p-2 rounded overflow-auto max-h-64">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
};

export default AdminIndexNow;