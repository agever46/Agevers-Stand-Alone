import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ExternalLink, CheckCircle2, XCircle, Search, Star, Users, Loader2 } from "lucide-react";
import { Flame, Gamepad2 } from "lucide-react";
import { toast } from "sonner";

interface TrendingGame {
  id: number;
  name: string;
  released: string | null;
  background_image: string | null;
  rating: number;
  ratings_count: number;
  added: number;
  metacritic: number | null;
  genres?: Array<{ name: string }>;
  parent_platforms?: Array<{ platform: { name: string } }>;
  in_catalog: boolean;
  catalog_product_id: string | null;
  catalog_slug: string | null;
  kinguin_search_url: string;
  steam_top_seller: boolean;
  steam_most_played: boolean;
  hot_score: number;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2014 + 2 }, (_, i) => CURRENT_YEAR + 1 - i);
const ORDERING_OPTIONS = [
  { value: "-added", label: "Most Added (Popularity)" },
  { value: "-rating", label: "Highest Rated" },
  { value: "-metacritic", label: "Best Metacritic" },
  { value: "-released", label: "Newest Released" },
];

export default function AdminTrendingResearch() {
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [ordering, setOrdering] = useState<string>("-added");
  const [games, setGames] = useState<TrendingGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [hideExisting, setHideExisting] = useState(false);

  const fetchTrending = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-trending-games", {
        body: null,
        method: "GET",
        // @ts-ignore: query forwarded via URL
      });
      // The invoke helper does not support query string; use a direct fetch instead.
      const session = (await supabase.auth.getSession()).data.session;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-trending-games?year=${year}&ordering=${encodeURIComponent(ordering)}&page_size=20`;
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${session?.access_token || ""}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch");
      setGames(json.games || []);
      toast.success(`Loaded ${json.games?.length || 0} trending games for ${year}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Error: ${msg}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = hideExisting ? games.filter((g) => !g.in_catalog) : games;
  const missingCount = games.filter((g) => !g.in_catalog).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="w-7 h-7 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Trending Games Research</h2>
          <p className="text-sm text-muted-foreground">
            Internal tool — combines <strong>RAWG.io</strong> popularity, <strong>Steam Top Sellers</strong> & <strong>Steam Most Played</strong>. Identifies catalog gaps to import from Kinguin.
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Year</label>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Sort By</label>
          <Select value={ordering} onValueChange={setOrdering}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ORDERING_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={fetchTrending} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
          Fetch Trending
        </Button>
        {games.length > 0 && (
          <Button variant="outline" onClick={() => setHideExisting((v) => !v)}>
            {hideExisting ? "Show All" : `Hide Existing (${games.length - missingCount})`}
          </Button>
        )}
        {games.length > 0 && (
          <div className="ml-auto text-sm">
            <Badge variant="outline" className="mr-2">Total: {games.length}</Badge>
            <Badge className="bg-amber-600 text-white">Missing: {missingCount}</Badge>
          </div>
        )}
      </Card>

      {/* Results */}
      {filtered.length === 0 && !loading && (
        <Card className="p-12 text-center text-muted-foreground">
          {games.length === 0 ? "Select a year and click Fetch Trending to start" : "No games to show with current filter"}
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((g, idx) => {
          const rank = games.indexOf(g) + 1;
          return (
            <Card key={g.id} className="overflow-hidden flex flex-col">
              <div className="relative aspect-video bg-muted">
                {g.background_image ? (
                  <img src={g.background_image} alt={g.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">No image</div>
                )}
                <Badge className="absolute top-2 left-2 bg-black/70 text-white">#{rank}</Badge>
                {g.in_catalog ? (
                  <Badge className="absolute top-2 right-2 bg-green-600 text-white gap-1">
                    <CheckCircle2 className="w-3 h-3" /> In Catalog
                  </Badge>
                ) : (
                  <Badge className="absolute top-2 right-2 bg-amber-600 text-white gap-1">
                    <XCircle className="w-3 h-3" /> Missing
                  </Badge>
                )}
                {/* Hot score (bottom-left) */}
                <Badge className="absolute bottom-2 left-2 bg-gradient-to-r from-orange-600 to-red-600 text-white gap-1 font-bold">
                  <Flame className="w-3 h-3" /> {g.hot_score}
                </Badge>
              </div>
              <div className="p-3 flex-1 flex flex-col gap-2">
                <h3 className="font-bold text-sm line-clamp-2" title={g.name}>{g.name}</h3>
                {/* Steam signals */}
                {(g.steam_top_seller || g.steam_most_played) && (
                  <div className="flex flex-wrap gap-1">
                    {g.steam_top_seller && (
                      <Badge className="bg-blue-600 text-white text-[10px] gap-1 py-0.5">
                        <Gamepad2 className="w-3 h-3" /> Steam Top Seller
                      </Badge>
                    )}
                    {g.steam_most_played && (
                      <Badge className="bg-purple-600 text-white text-[10px] gap-1 py-0.5">
                        <Users className="w-3 h-3" /> Steam Most Played
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {g.released && <span>{g.released.slice(0, 4)}</span>}
                  {g.rating > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      {g.rating.toFixed(1)}
                    </span>
                  )}
                  {g.added > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {g.added.toLocaleString()}
                    </span>
                  )}
                  {g.metacritic && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1">MC {g.metacritic}</Badge>
                  )}
                </div>
                {g.genres && g.genres.length > 0 && (
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {g.genres.slice(0, 3).map((x) => x.name).join(" • ")}
                  </div>
                )}
                <div className="mt-auto flex flex-col gap-1 pt-2">
                  <a href={g.kinguin_search_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="default" className="w-full text-xs">
                      <Search className="w-3 h-3 mr-1" /> Search in Kinguin
                    </Button>
                  </a>
                  {g.in_catalog && g.catalog_slug && (
                    <a href={`/p/${g.catalog_slug}`} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="w-full text-xs">
                        View in Store
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground pt-4">
        Game data powered by{" "}
        <a href="https://rawg.io" target="_blank" rel="noopener noreferrer" className="underline">RAWG.io</a>
        {" • "}Steam signals from public Steam API
      </p>
    </div>
  );
}