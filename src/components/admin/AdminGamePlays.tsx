import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Gamepad2, Coins, ArrowUpDown, Calendar, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SortField = "total_plays" | "last_played" | "coins_won" | "wins_count" | "free_plays" | "paid_plays" | "plays_bought" | "plays_remaining";
export type SortDir = "asc" | "desc";

interface PlayerStats {
  user_id: string;
  username: string | null;
  display_name: string | null;
  total_plays: number;
  free_plays: number;
  paid_plays: number;
  total_coins_won: number;
  wins_count: number;
  last_played: string;
  plays_bought: number;
  plays_remaining: number;
  games_played: Record<string, number>;
}

const GAME_NAMES: Record<string, string> = {
  memory: "Memory",
  blackjack: "Blackjack",
  runner: "Runner",
  duckshoot: "Duck Shoot",
  slots: "Slots",
  coinflip: "Coin Flip",
  minesweeper: "Minesweeper",
  dice: "Dice",
  spin: "Spin",
  scratch: "Scratch",
  helibomber: "Heli Bomber",
  virtualpup: "Virtual Pup",
  bombfield: "Bomb Field",
  jetfighter: "Jet Fighter",
};

const AdminGamePlays = () => {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("last_played");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [gameFilter, setGameFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: plays } = await supabase
        .from("game_plays")
        .select("user_id, coins_won, is_paid, created_at, game_type")
        .order("created_at", { ascending: false });

      const { data: purchases } = await supabase
        .from("play_purchases")
        .select("user_id, plays_bought, plays_remaining");

      const userIds = Array.from(new Set((plays || []).map((p: any) => p.user_id)));
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, username, display_name").in("user_id", userIds)
        : { data: [] as any[] };

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const purchaseMap = new Map<string, { bought: number; remaining: number }>();
      (purchases || []).forEach((pu: any) => {
        const cur = purchaseMap.get(pu.user_id) || { bought: 0, remaining: 0 };
        cur.bought += pu.plays_bought || 0;
        cur.remaining += pu.plays_remaining || 0;
        purchaseMap.set(pu.user_id, cur);
      });

      const statsMap = new Map<string, PlayerStats>();
      (plays || []).forEach((p: any) => {
        let s = statsMap.get(p.user_id);
        if (!s) {
          const prof = profileMap.get(p.user_id);
          const pur = purchaseMap.get(p.user_id);
          s = {
            user_id: p.user_id,
            username: prof?.username || null,
            display_name: prof?.display_name || null,
            total_plays: 0,
            free_plays: 0,
            paid_plays: 0,
            total_coins_won: 0,
            wins_count: 0,
            last_played: p.created_at,
            plays_bought: pur?.bought || 0,
            plays_remaining: pur?.remaining || 0,
          games_played: {},
          };
          statsMap.set(p.user_id, s);
        }
        s.total_plays += 1;
        if (p.game_type) {
          s.games_played[p.game_type] = (s.games_played[p.game_type] || 0) + 1;
        }
        if (p.is_paid) s.paid_plays += 1; else s.free_plays += 1;
        if (p.coins_won > 0) {
          s.wins_count += 1;
          s.total_coins_won += p.coins_won;
        }
        if (new Date(p.created_at) > new Date(s.last_played)) s.last_played = p.created_at;
      });

      const arr = Array.from(statsMap.values());
      setPlayers(arr);
      setLoading(false);
    })();
  }, []);

  const filteredPlayers = useMemo(() => {
    let arr = [...players];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(
        (p) =>
          (p.display_name || "").toLowerCase().includes(q) ||
          (p.username || "").toLowerCase().includes(q)
      );
    }

    if (gameFilter !== "all") {
      arr = arr.filter((p) => Object.keys(p.games_played).includes(gameFilter));
    }

    arr.sort((a, b) => {
      let av: number | string = a[sortField];
      let bv: number | string = b[sortField];
      if (sortField === "last_played") {
        av = new Date(av as string).getTime();
        bv = new Date(bv as string).getTime();
      }
      const cmp = (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return arr;
  }, [players, search, sortField, sortDir, gameFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUpDown className="h-3 w-3 ml-1 rotate-180 text-primary" />
    ) : (
      <ArrowUpDown className="h-3 w-3 ml-1 text-primary" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const sortableHeader = (field: SortField, label: string, align: "left" | "right" = "right") => (
    <th
      className={`px-4 py-2 font-display font-bold cursor-pointer select-none hover:text-foreground transition-colors ${align === "left" ? "text-left" : "text-right"}`}
      onClick={() => handleSort(field)}
    >
      <span className={`inline-flex items-center ${align === "right" ? "justify-end" : ""}`}>
        {label}
        <SortIcon field={field} />
      </span>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gamepad2 className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold text-foreground">Game Plays — Player Stats</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {players.length} players total · {filteredPlayers.length} shown · Shows wins, plays used, and whether they were free or purchased.
      </p>

      {players.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search player name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/30 border-border"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={gameFilter} onValueChange={setGameFilter}>
              <SelectTrigger className="w-[180px] bg-secondary/30 border-border">
                <SelectValue placeholder="Filter by game" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Games</SelectItem>
                {Object.entries(GAME_NAMES).map(([key, name]) => (
                  <SelectItem key={key} value={key}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {search || gameFilter !== "all" ? (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setGameFilter("all"); }}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {filteredPlayers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-border rounded-lg">
          {players.length === 0 ? "No game plays yet." : "No players match your filters."}
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-display font-bold">Player</th>
                {sortableHeader("total_plays", "Total")}
                {sortableHeader("free_plays", "Free")}
                {sortableHeader("paid_plays", "Paid")}
                <th className="text-left px-4 py-2 font-display font-bold">Games Played</th>
                {sortableHeader("wins_count", "Wins")}
                {sortableHeader("coins_won", "Coins Won")}
                {sortableHeader("plays_bought", "Bought")}
                {sortableHeader("plays_remaining", "Remaining")}
                {sortableHeader("last_played", "Last Played")}
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((p) => (
                <tr key={p.user_id} className="border-t border-border hover:bg-secondary/20">
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{p.display_name || p.username || "Unknown"}</span>
                      {p.username && p.display_name && (
                        <span className="text-xs text-muted-foreground">@{p.username}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{p.total_plays}</td>
                  <td className="px-4 py-2 text-right font-mono text-emerald-400">{p.free_plays}</td>
                  <td className="px-4 py-2 text-right font-mono text-amber-400">{p.paid_plays}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1 max-w-[280px]">
                      {Object.entries(p.games_played)
                        .sort((a, b) => b[1] - a[1])
                        .map(([game, count]) => (
                          <span
                            key={game}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs border border-primary/20"
                          >
                            {GAME_NAMES[game] || game}
                            <span className="text-muted-foreground">×{count}</span>
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{p.wins_count}</td>
                  <td className="px-4 py-2 text-right font-mono text-primary">
                    <span className="inline-flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {p.total_coins_won}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{p.plays_bought}</td>
                  <td className="px-4 py-2 text-right font-mono">{p.plays_remaining}</td>
                  <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                    {new Date(p.last_played).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminGamePlays;