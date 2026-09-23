import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Trophy, Medal } from "lucide-react";

interface LeaderboardEntry {
  id: string;
  username: string;
  game_type: string;
  score: number;
  created_at: string;
}

const GAME_NAMES: Record<string, string> = {
  memory: "Memory Match",
  blackjack: "Blackjack",
  runner: "Alien Runner",
  duckshoot: "Duck Shoot",
  slots: "Slot Machine",
  coinflip: "Coin Flip",
  minesweeper: "Minesweeper",
  dice: "Dice Roll",
  spin: "Spin & Win",
  scratch: "Scratch Card",
};

const GameLeaderboard = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_public_leaderboard" as any, {
        _game_type: filter === "all" ? null : filter,
        _limit: 20,
      });
      setEntries((data as any as LeaderboardEntry[]) || []);
      setLoading(false);
    };
    fetchLeaderboard();
  }, [filter]);

  const medalColors = ["text-[hsl(var(--neon-gold))]", "text-gray-400", "text-amber-700"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass rounded-2xl p-4"
    >
      <div className="flex items-center justify-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-[hsl(var(--neon-gold))]" />
        <h2 className="font-display text-xl font-bold text-foreground text-center">Leaderboard</h2>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-display font-bold transition-all ${
            filter === "all" ? "bg-primary text-primary-foreground" : "glass text-muted-foreground hover:text-foreground"
          }`}
        >
          All Games
        </button>
        {Object.entries(GAME_NAMES).map(([key, name]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1 rounded-full text-xs font-display font-bold transition-all ${
              filter === key ? "bg-primary text-primary-foreground" : "glass text-muted-foreground hover:text-foreground"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground text-sm py-8">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-8">No scores yet. Be the first! 🎮</p>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[2rem_1fr_1fr_4rem] gap-2 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider">
            <span>#</span>
            <span>Player</span>
            <span>Game</span>
            <span className="text-right">Score</span>
          </div>
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`grid grid-cols-[2rem_1fr_1fr_4rem] gap-2 items-center px-3 py-2 rounded-lg ${
                i < 3 ? "glass border border-border/50" : ""
              }`}
            >
              <span className="font-display font-bold text-sm">
                {i < 3 ? (
                  <Medal className={`h-4 w-4 ${medalColors[i]}`} />
                ) : (
                  <span className="text-muted-foreground">{i + 1}</span>
                )}
              </span>
              <span className="font-display text-sm font-bold text-foreground truncate">{entry.username}</span>
              <span className="text-xs text-muted-foreground truncate">{GAME_NAMES[entry.game_type] || entry.game_type}</span>
              <span className="font-display text-sm font-bold text-[hsl(var(--neon-gold))] text-right">{entry.score}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default GameLeaderboard;
