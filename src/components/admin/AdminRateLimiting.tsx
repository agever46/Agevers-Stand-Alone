import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Search, AlertTriangle, Ban, Activity, Globe, Clock, Trash2 } from "lucide-react";

const AdminRateLimiting = () => {
  const [search, setSearch] = useState("");
  const [filterBlocked, setFilterBlocked] = useState<string>("all");
  const [timeRange, setTimeRange] = useState("24h");

  const timeRangeInterval = {
    "1h": "1 hour",
    "6h": "6 hours",
    "24h": "24 hours",
    "7d": "7 days",
    "30d": "30 days",
  }[timeRange] || "24 hours";

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["rate-limit-events", search, filterBlocked, timeRange],
    queryFn: async () => {
      let query = supabase
        .from("rate_limit_events")
        .select("*")
        .gte("created_at", new Date(Date.now() - parseTimeRange(timeRange)).toISOString())
        .order("created_at", { ascending: false })
        .limit(500);

      if (search.trim()) {
        query = query.or(`ip_address.ilike.%${search}%,endpoint.ilike.%${search}%,user_agent.ilike.%${search}%`);
      }
      if (filterBlocked === "blocked") query = query.eq("was_blocked", true);
      if (filterBlocked === "allowed") query = query.eq("was_blocked", false);

      const { data } = await query;
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["rate-limit-stats", timeRange],
    queryFn: async () => {
      const since = new Date(Date.now() - parseTimeRange(timeRange)).toISOString();

      const [totalRes, blockedRes, topIpsRes, topEndpointsRes] = await Promise.all([
        supabase.from("rate_limit_events").select("id", { count: "exact", head: true }).gte("created_at", since),
        supabase.from("rate_limit_events").select("id", { count: "exact", head: true }).gte("created_at", since).eq("was_blocked", true),
        supabase.from("rate_limit_events").select("ip_address, event_count").gte("created_at", since).eq("was_blocked", true).order("event_count", { ascending: false }).limit(10),
        supabase.from("rate_limit_events").select("endpoint, was_blocked").gte("created_at", since).order("created_at", { ascending: false }).limit(200),
      ]);

      // Aggregate top IPs
      const ipMap: Record<string, number> = {};
      (topIpsRes.data || []).forEach((e: any) => {
        ipMap[e.ip_address] = (ipMap[e.ip_address] || 0) + (e.event_count || 1);
      });
      const topIps = Object.entries(ipMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      // Aggregate top endpoints
      const endpointMap: Record<string, { total: number; blocked: number }> = {};
      (topEndpointsRes.data || []).forEach((e: any) => {
        if (!endpointMap[e.endpoint]) endpointMap[e.endpoint] = { total: 0, blocked: 0 };
        endpointMap[e.endpoint].total++;
        if (e.was_blocked) endpointMap[e.endpoint].blocked++;
      });
      const topEndpoints = Object.entries(endpointMap)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5);

      return {
        total: totalRes.count || 0,
        blocked: blockedRes.count || 0,
        topIps,
        topEndpoints,
      };
    },
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Activity} label="Total Events" value={stats?.total || 0} color="text-blue-400" />
        <StatCard icon={Ban} label="Blocked" value={stats?.blocked || 0} color="text-destructive" />
        <StatCard icon={Shield} label="Block Rate" value={stats?.total ? `${Math.round((stats.blocked / stats.total) * 100)}%` : "0%"} color="text-yellow-400" />
        <StatCard icon={Globe} label="Unique IPs" value={stats?.topIps?.length || 0} color="text-green-400" />
      </div>

      {/* Top Offenders */}
      {stats?.topIps && stats.topIps.length > 0 && (
        <div className="glass rounded-lg p-4">
          <h3 className="font-display font-bold text-foreground text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            Top Blocked IPs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
            {stats.topIps.map(([ip, count]) => (
              <div key={ip} className="flex items-center justify-between bg-destructive/10 rounded px-3 py-2 text-xs">
                <span className="font-mono text-foreground">{ip}</span>
                <span className="text-destructive font-bold">{count} hits</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Endpoints */}
      {stats?.topEndpoints && stats.topEndpoints.length > 0 && (
        <div className="glass rounded-lg p-4">
          <h3 className="font-display font-bold text-foreground text-sm mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-400" />
            Most Targeted Endpoints
          </h3>
          <div className="space-y-1">
            {stats.topEndpoints.map(([endpoint, { total, blocked }]) => (
              <div key={endpoint} className="flex items-center justify-between bg-secondary/30 rounded px-3 py-2 text-xs">
                <span className="font-mono text-foreground truncate max-w-[300px]">{endpoint}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">{total} total</span>
                  {blocked > 0 && <span className="text-destructive font-bold">{blocked} blocked</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IP, endpoint, user agent..."
            className="pl-9"
          />
        </div>
        <div className="w-32">
          <Select value={filterBlocked} onValueChange={setFilterBlocked}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="blocked">Blocked Only</SelectItem>
              <SelectItem value="allowed">Allowed Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-28">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 Hour</SelectItem>
              <SelectItem value="6h">6 Hours</SelectItem>
              <SelectItem value="24h">24 Hours</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Events Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading events...</p>
      ) : events.length === 0 ? (
        <div className="glass rounded-lg p-8 text-center">
          <Shield className="h-10 w-10 text-green-400 mx-auto mb-3" />
          <p className="text-foreground font-display font-bold">No suspicious activity detected</p>
          <p className="text-muted-foreground text-sm mt-1">Rate limit events will appear here when detected</p>
        </div>
      ) : (
        <div className="glass rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-3 text-muted-foreground font-display">Time</th>
                  <th className="text-left p-3 text-muted-foreground font-display">IP</th>
                  <th className="text-left p-3 text-muted-foreground font-display">Endpoint</th>
                  <th className="text-left p-3 text-muted-foreground font-display">Method</th>
                  <th className="text-left p-3 text-muted-foreground font-display">Hits</th>
                  <th className="text-left p-3 text-muted-foreground font-display">Country</th>
                  <th className="text-left p-3 text-muted-foreground font-display">Status</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e: any) => (
                  <tr key={e.id} className={`border-b border-border/20 hover:bg-secondary/20 ${e.was_blocked ? "bg-destructive/5" : ""}`}>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {new Date(e.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="p-3 font-mono text-foreground">{e.ip_address}</td>
                    <td className="p-3 font-mono text-foreground truncate max-w-[200px]" title={e.endpoint}>{e.endpoint}</td>
                    <td className="p-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        e.method === "POST" ? "bg-yellow-500/20 text-yellow-400" :
                        e.method === "GET" ? "bg-blue-500/20 text-blue-400" :
                        "bg-secondary text-muted-foreground"
                      }`}>{e.method}</span>
                    </td>
                    <td className="p-3 text-foreground font-bold">{e.event_count}</td>
                    <td className="p-3 text-muted-foreground">{e.country || "—"}</td>
                    <td className="p-3">
                      {e.was_blocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px] font-bold">
                          <Ban className="h-3 w-3" /> BLOCKED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold">
                          <Shield className="h-3 w-3" /> OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) => (
  <div className="glass rounded-lg p-4 text-center">
    <Icon className={`h-6 w-6 mx-auto mb-1 ${color}`} />
    <p className="text-xl font-display font-bold text-foreground">{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

function parseTimeRange(range: string): number {
  switch (range) {
    case "1h": return 3600000;
    case "6h": return 21600000;
    case "24h": return 86400000;
    case "7d": return 604800000;
    case "30d": return 2592000000;
    default: return 86400000;
  }
}

export default AdminRateLimiting;
