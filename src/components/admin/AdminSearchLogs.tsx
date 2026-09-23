import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, AlertTriangle, TrendingUp, Trash2, ExternalLink, LayoutList, BarChart3, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SearchRow {
  id: string;
  query: string;
  results_count: number;
  created_at: string;
  page_path: string | null;
  user_agent: string | null;
}

interface SearchAgg {
  query: string;
  count: number;
  avg_results: number;
  last_searched: string;
  pages: { path: string; count: number }[];
}

interface PageViewAgg {
  page_path: string;
  view_count: number;
  unique_visitors: number;
  last_visit: string;
}

type Tab = "no-results" | "all" | "pages";

const AdminSearchLogs = () => {
  const [tab, setTab] = useState<Tab>("no-results");
  const [view, setView] = useState<"recent" | "grouped">("recent");
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [data, setData] = useState<SearchAgg[]>([]);
  const [pages, setPages] = useState<PageViewAgg[]>([]);
  const [days, setDays] = useState<number>(7);
  const [loading, setLoading] = useState(true);

  const fetchSearches = async () => {
    setLoading(true);
    const { data: raw } = await supabase
      .from("search_logs")
      .select("id, query, results_count, created_at, page_path, user_agent")
      .order("created_at", { ascending: false })
      .limit(5000) as any;

    if (!raw) { setLoading(false); return; }

    const filteredRaw: SearchRow[] = (raw as SearchRow[]).filter((r) =>
      tab === "no-results" ? (r.results_count || 0) === 0 : true
    );
    setRows(filteredRaw);

    const map = new Map<string, { count: number; totalResults: number; lastSearched: string; pages: Map<string, number> }>();
    for (const row of raw as SearchRow[]) {
      const q = row.query.toLowerCase().trim();
      const existing = map.get(q);
      const path = row.page_path || "(unknown)";
      if (existing) {
        existing.count++;
        existing.totalResults += row.results_count;
        if (row.created_at > existing.lastSearched) existing.lastSearched = row.created_at;
        existing.pages.set(path, (existing.pages.get(path) || 0) + 1);
      } else {
        const pgs = new Map<string, number>();
        pgs.set(path, 1);
        map.set(q, { count: 1, totalResults: row.results_count, lastSearched: row.created_at, pages: pgs });
      }
    }

    let agg: SearchAgg[] = Array.from(map.entries()).map(([query, v]) => ({
      query,
      count: v.count,
      avg_results: Math.round(v.totalResults / v.count),
      last_searched: v.lastSearched,
      pages: Array.from(v.pages.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count),
    }));

    if (tab === "no-results") {
      agg = agg.filter((a) => a.avg_results === 0);
    }

    agg.sort((a, b) => new Date(b.last_searched).getTime() - new Date(a.last_searched).getTime());
    setData(agg);
    setLoading(false);
  };

  const fetchPages = async () => {
    setLoading(true);
    const { data: result, error } = await (supabase as any).rpc("get_top_pages", { _days: days, _limit: 200 });
    if (error) {
      toast.error("Failed to load page views");
      setPages([]);
    } else {
      setPages(result || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (tab === "pages") fetchPages();
    else fetchSearches();
  }, [tab, days]);

  const clearLogs = async () => {
    if (tab === "pages") {
      if (!confirm("Delete all page view logs?")) return;
      const { error } = await (supabase.from("page_views") as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) toast.error("Failed to clear page views");
      else { toast.success("Page views cleared"); fetchPages(); }
    } else {
      if (!confirm("Delete all search logs?")) return;
      const { error } = await (supabase.from("search_logs") as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) toast.error("Failed to clear logs");
      else { toast.success("Search logs cleared"); fetchSearches(); }
    }
  };

  const buildHref = (query: string, isZero: boolean) =>
    isZero
      ? `/admin/kinguin?q=${encodeURIComponent(query)}`
      : `/search?q=${encodeURIComponent(query)}`;

  // Heuristic: detect bots/crawlers from the user-agent string.
  const detectBot = (ua: string | null): { isBot: boolean; label: string; color: string } => {
    if (!ua) return { isBot: false, label: "Unknown", color: "text-muted-foreground" };
    const lower = ua.toLowerCase();
    if (/googlebot|google-inspectiontool/.test(lower)) return { isBot: true, label: "Googlebot", color: "text-blue-400" };
    if (/bingbot|bingpreview/.test(lower)) return { isBot: true, label: "Bingbot", color: "text-cyan-400" };
    if (/yandexbot|yandex/.test(lower)) return { isBot: true, label: "Yandex", color: "text-red-400" };
    if (/duckduckbot/.test(lower)) return { isBot: true, label: "DuckDuckGo", color: "text-orange-400" };
    if (/baiduspider/.test(lower)) return { isBot: true, label: "Baidu", color: "text-red-500" };
    if (/applebot/.test(lower)) return { isBot: true, label: "Applebot", color: "text-gray-300" };
    if (/facebookexternalhit|meta-externalagent/.test(lower)) return { isBot: true, label: "Facebook", color: "text-blue-500" };
    if (/twitterbot/.test(lower)) return { isBot: true, label: "Twitter", color: "text-sky-400" };
    if (/linkedinbot/.test(lower)) return { isBot: true, label: "LinkedIn", color: "text-blue-600" };
    if (/ahrefsbot/.test(lower)) return { isBot: true, label: "Ahrefs", color: "text-yellow-400" };
    if (/semrushbot/.test(lower)) return { isBot: true, label: "Semrush", color: "text-orange-500" };
    if (/mj12bot/.test(lower)) return { isBot: true, label: "Majestic", color: "text-purple-400" };
    if (/dotbot|mozbot/.test(lower)) return { isBot: true, label: "Moz", color: "text-purple-500" };
    if (/gptbot|chatgpt-user|oai-searchbot/.test(lower)) return { isBot: true, label: "OpenAI", color: "text-emerald-400" };
    if (/claudebot|anthropic/.test(lower)) return { isBot: true, label: "Claude", color: "text-amber-400" };
    if (/perplexitybot/.test(lower)) return { isBot: true, label: "Perplexity", color: "text-fuchsia-400" };
    if (/bytespider/.test(lower)) return { isBot: true, label: "ByteDance", color: "text-pink-400" };
    if (/petalbot/.test(lower)) return { isBot: true, label: "Huawei", color: "text-rose-400" };
    if (/bot|crawler|spider|scraper|http|curl|wget|python|axios|node-fetch/.test(lower)) {
      return { isBot: true, label: "Other Bot", color: "text-orange-300" };
    }
    // Real browser
    if (/edg\//.test(lower)) return { isBot: false, label: "Edge", color: "text-emerald-300" };
    if (/chrome\//.test(lower)) return { isBot: false, label: "Chrome", color: "text-emerald-300" };
    if (/firefox\//.test(lower)) return { isBot: false, label: "Firefox", color: "text-emerald-300" };
    if (/safari\//.test(lower)) return { isBot: false, label: "Safari", color: "text-emerald-300" };
    return { isBot: false, label: "Browser", color: "text-emerald-300" };
  };

  const itemCount =
    tab === "pages" ? pages.length : view === "recent" ? rows.length : data.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-display font-bold">Site Analytics</h2>
          <span className="text-xs text-muted-foreground">
            ({itemCount} {tab === "pages" ? "pages" : view === "recent" ? "searches" : "terms"})
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant={tab === "no-results" ? "default" : "outline"}
            onClick={() => setTab("no-results")}
            className="text-xs"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            No Results
          </Button>
          <Button
            size="sm"
            variant={tab === "all" ? "default" : "outline"}
            onClick={() => setTab("all")}
            className="text-xs"
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            All Searches
          </Button>
          <Button
            size="sm"
            variant={tab === "pages" ? "default" : "outline"}
            onClick={() => setTab("pages")}
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            Page Views
          </Button>
          {tab !== "pages" && (
            <>
              <div className="w-px bg-border mx-1" />
              <Button
                size="sm"
                variant={view === "recent" ? "default" : "outline"}
                onClick={() => setView("recent")}
                className="text-xs"
              >
                <LayoutList className="h-3 w-3 mr-1" />
                Recent
              </Button>
              <Button
                size="sm"
                variant={view === "grouped" ? "default" : "outline"}
                onClick={() => setView("grouped")}
                className="text-xs"
              >
                <BarChart3 className="h-3 w-3 mr-1" />
                Grouped
              </Button>
            </>
          )}
          {tab === "pages" && (
            <>
              <div className="w-px bg-border mx-1" />
              {[1, 7, 30, 90].map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={days === d ? "default" : "outline"}
                  onClick={() => setDays(d)}
                  className="text-xs"
                >
                  {d === 1 ? "24h" : `${d}d`}
                </Button>
              ))}
            </>
          )}
          <Button size="sm" variant="destructive" onClick={clearLogs} className="text-xs">
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : itemCount === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          {tab === "no-results"
            ? "No zero-result searches yet 🎉"
            : tab === "pages"
              ? "No page views recorded yet"
              : "No search data yet"}
        </div>
      ) : tab === "pages" ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50 text-left">
                <th className="px-4 py-2 font-display font-bold">Page</th>
                <th className="px-4 py-2 font-display font-bold text-center">Views</th>
                <th className="px-4 py-2 font-display font-bold text-center">Unique Visitors</th>
                <th className="px-4 py-2 font-display font-bold">Last Visit</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.page_path} className="border-t border-border/50 hover:bg-secondary/20">
                  <td className="px-4 py-2 font-medium">
                    <Link
                      to={p.page_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                      title={p.page_path}
                    >
                      <span className="truncate max-w-[420px] inline-block align-middle">{p.page_path}</span>
                      <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-center font-mono text-green-400">{p.view_count}</td>
                  <td className="px-4 py-2 text-center font-mono">{p.unique_visitors}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(p.last_visit).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === "recent" ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50 text-left">
                <th className="px-4 py-2 font-display font-bold">Search Term</th>
                <th className="px-4 py-2 font-display font-bold text-center">Results</th>
                <th className="px-4 py-2 font-display font-bold">Page</th>
                <th className="px-4 py-2 font-display font-bold">Source</th>
                <th className="px-4 py-2 font-display font-bold">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isZero = (row.results_count || 0) === 0;
                const path = row.page_path || "(unknown)";
                const src = detectBot(row.user_agent);
                return (
                  <tr key={row.id} className="border-t border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-2 font-medium">
                      <Link
                        to={buildHref(row.query, isZero)}
                        target={isZero ? undefined : "_blank"}
                        rel={isZero ? undefined : "noopener noreferrer"}
                        title={isZero ? "Search on Kinguin to add it" : "View results on site"}
                        className={`inline-flex items-center gap-1.5 hover:underline ${
                          isZero ? "text-destructive font-bold" : "text-primary"
                        }`}
                      >
                        {row.query}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-center font-mono">
                      <span className={isZero ? "text-destructive" : "text-green-400"}>
                        {row.results_count}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {path !== "(unknown)" ? (
                        <Link
                          to={path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline hover:text-foreground inline-flex items-center gap-1"
                        >
                          {path}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </Link>
                      ) : (
                        <span className="italic">unknown</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      <span
                        className={`font-mono font-bold ${src.color}`}
                        title={row.user_agent || "No user agent recorded"}
                      >
                        {src.isBot ? "🤖 " : "👤 "}{src.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50 text-left">
                <th className="px-4 py-2 font-display font-bold">Search Term</th>
                <th className="px-4 py-2 font-display font-bold text-center">Times</th>
                <th className="px-4 py-2 font-display font-bold text-center">Avg Results</th>
                <th className="px-4 py-2 font-display font-bold">Pages Used</th>
                <th className="px-4 py-2 font-display font-bold">Last Searched</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const isZero = row.avg_results === 0;
                return (
                  <tr key={row.query} className="border-t border-border/50 hover:bg-secondary/20 align-top">
                    <td className="px-4 py-2 font-medium">
                      <Link
                        to={buildHref(row.query, isZero)}
                        target={isZero ? undefined : "_blank"}
                        rel={isZero ? undefined : "noopener noreferrer"}
                        className={`inline-flex items-center gap-1.5 hover:underline ${
                          isZero ? "text-destructive font-bold" : "text-primary"
                        }`}
                      >
                        {row.query}
                        <ExternalLink className="h-3 w-3 opacity-60" />
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-center font-mono">{row.count}</td>
                    <td className="px-4 py-2 text-center font-mono">
                      <span className={isZero ? "text-destructive" : "text-green-400"}>
                        {row.avg_results}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground space-y-0.5">
                      {row.pages.map((p) => (
                        <div key={p.path} className="flex items-center gap-1.5">
                          {p.path !== "(unknown)" ? (
                            <Link
                              to={p.path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline hover:text-foreground truncate max-w-[260px]"
                              title={p.path}
                            >
                              {p.path}
                            </Link>
                          ) : (
                            <span className="italic">unknown</span>
                          )}
                          <span className="font-mono text-muted-foreground/70">×{p.count}</span>
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(row.last_searched).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminSearchLogs;
