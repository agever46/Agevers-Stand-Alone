import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Eye, Clock, TrendingUp, RefreshCw, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { toast } from "sonner";

type Report = {
  rows?: Array<{ dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }>;
  totals?: Array<{ metricValues?: { value: string }[] }>;
};

type Data = {
  summary: Report;
  byDay: Report;
  topPages: Report;
  sources: Report;
  countries: Report;
  devices: Report;
  realtime?: Report;
  setupRequired?: boolean;
  code?: string;
  reason?: string;
  activationUrl?: string;
  error?: string;
};

const RANGES = [
  { label: "Today", value: "today" },
  { label: "7 days", value: "7daysAgo" },
  { label: "30 days", value: "30daysAgo" },
  { label: "90 days", value: "90daysAgo" },
];

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6"];

const fmtDate = (d: string) => `${d.slice(4, 6)}/${d.slice(6, 8)}`;
const fmtSec = (s: string) => {
  const n = Math.round(Number(s) || 0);
  const m = Math.floor(n / 60);
  return `${m}m ${n % 60}s`;
};

const AdminAnalytics = () => {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("7daysAgo");
  const [error, setError] = useState<string | null>(null);

  const load = async (r: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("ga4-analytics", { body: { range: r } });
      if (err) throw err;
      if (res?.setupRequired) {
        setData(res);
        setError(res.error || "Google Analytics setup is not complete");
        return;
      }
      if (res?.error) throw new Error(res.error);
      setData(res);
    } catch (e: any) {
      const msg = e?.message || "Failed to load analytics";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(range); /* eslint-disable-next-line */ }, [range]);

  const totals =
    data?.summary?.totals?.[0]?.metricValues ||
    data?.summary?.rows?.[0]?.metricValues ||
    [];
  const [activeUsers, newUsers, pageViews, sessions, avgDuration, bounceRate] = totals.map((m) => m?.value || "0");
  const realtimeUsers =
    (data?.realtime as any)?.totals?.[0]?.metricValues?.[0]?.value ||
    data?.realtime?.rows?.[0]?.metricValues?.[0]?.value ||
    "0";

  const byDay = (data?.byDay?.rows || []).map((r) => ({
    date: fmtDate(r.dimensionValues?.[0]?.value || ""),
    users: Number(r.metricValues?.[0]?.value || 0),
    views: Number(r.metricValues?.[1]?.value || 0),
  }));

  const topPages = (data?.topPages?.rows || []).map((r) => ({
    path: r.dimensionValues?.[0]?.value || "",
    views: Number(r.metricValues?.[0]?.value || 0),
  }));

  const sources = (data?.sources?.rows || []).map((r) => ({
    source: r.dimensionValues?.[0]?.value || "",
    sessions: Number(r.metricValues?.[0]?.value || 0),
  }));

  const countries = (data?.countries?.rows || []).map((r) => ({
    country: r.dimensionValues?.[0]?.value || "",
    users: Number(r.metricValues?.[0]?.value || 0),
  }));

  const devices = (data?.devices?.rows || []).map((r) => ({
    name: r.dimensionValues?.[0]?.value || "",
    value: Number(r.metricValues?.[0]?.value || 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Google Analytics</h2>
          <p className="text-sm text-muted-foreground">Live data from GA4 (property {(!error && data) ? "connected" : "..."})</p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <Button key={r.value} size="sm" variant={range === r.value ? "default" : "outline"} onClick={() => setRange(r.value)}>
              {r.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => load(range)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div>
      )}

      {error && !loading && (
        <Card className="p-6 border-destructive">
          <p className="text-destructive font-medium">Failed to load analytics</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          {data?.reason === "SERVICE_DISABLED" ? (
            <div className="text-xs text-muted-foreground mt-3 space-y-2">
              <p>Google is still reporting the Analytics Data API as disabled for the service account project. If it is already enabled, wait a few minutes and refresh.</p>
              {data.activationUrl && (
                <a className="text-primary underline" href={data.activationUrl} target="_blank" rel="noreferrer">Open Google API status</a>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-3">
              Make sure the service account <code>agevers@mineral-name-386307.iam.gserviceaccount.com</code> has <b>Viewer</b> access to GA4 property <b>531361158</b>, and that the Google Analytics Data API is enabled on the Google Cloud project.
            </p>
          )}
        </Card>
      )}

      {data && !data.setupRequired && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={Activity} label="Live (last 30 min)" value={realtimeUsers} />
            <StatCard icon={Users} label="Active users" value={activeUsers} />
            <StatCard icon={Users} label="New users" value={newUsers} />
            <StatCard icon={Eye} label="Page views" value={pageViews} />
            <StatCard icon={TrendingUp} label="Sessions" value={sessions} />
            <StatCard icon={Clock} label="Avg. duration" value={fmtSec(avgDuration)} />
          </div>
          <div className="text-xs text-muted-foreground">Bounce rate: {(Number(bounceRate) * 100).toFixed(1)}%</div>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Users & Page views over time</h3>
            <div className="w-full h-64">
              <ResponsiveContainer>
                <LineChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                  <Legend />
                  <Line type="monotone" dataKey="users" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="views" stroke="#22c55e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Top pages</h3>
              <div className="space-y-2">
                {topPages.map((p) => (
                  <div key={p.path} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                    <span className="truncate mr-3">{p.path}</span>
                    <span className="font-medium">{p.views.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Traffic sources</h3>
              <div className="space-y-2">
                {sources.map((s) => (
                  <div key={s.source} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                    <span className="truncate mr-3">{s.source || "(direct)"}</span>
                    <span className="font-medium">{s.sessions.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Top countries</h3>
              <div className="space-y-2">
                {countries.map((c) => (
                  <div key={c.country} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                    <span className="truncate mr-3">{c.country}</span>
                    <span className="font-medium">{c.users.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Devices</h3>
              <div className="w-full h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={devices} dataKey="value" nameKey="name" outerRadius={80} label>
                      {devices.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 text-muted-foreground text-xs">
      <Icon className="w-4 h-4" />
      {label}
    </div>
    <div className="text-2xl font-bold mt-2">{Number(value).toLocaleString ? (isNaN(Number(value)) ? value : Number(value).toLocaleString()) : value}</div>
  </Card>
);

export default AdminAnalytics;