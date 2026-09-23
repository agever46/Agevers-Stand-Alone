import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Loader2, Mail, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Subscriber {
  id: string;
  user_id: string;
  email: string;
  created_at: string;
  display_name?: string | null;
}

const AdminNewsletter = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscribers = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from("newsletter_subscribers" as any)
      .select("*")
      .order("created_at", { ascending: false }) as any);

    if (error) {
      toast.error("Failed to load subscribers");
      setLoading(false);
      return;
    }

    // Fetch display names from profiles
    const userIds = (data || []).map((s: any) => s.user_id);
    let profileMap: Record<string, string | null> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      if (profiles) {
        profiles.forEach((p) => {
          profileMap[p.user_id] = p.display_name;
        });
      }
    }

    setSubscribers(
      (data || []).map((s: any) => ({
        ...s,
        display_name: profileMap[s.user_id] || null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this subscriber?")) return;
    const { error } = await (supabase
      .from("newsletter_subscribers" as any)
      .delete()
      .eq("id", id) as any);
    if (error) toast.error("Failed to remove");
    else {
      toast.success("Subscriber removed");
      fetchSubscribers();
    }
  };

  const handleExportCSV = () => {
    // Neutralize spreadsheet formula injection: a cell starting with = + - @
    // (or a tab/CR) is executed by Excel/Sheets, so prefix it with a quote.
    const csvCell = (value: string) => {
      const raw = String(value ?? "");
      const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const csvHeader = "Email,Display Name,Subscribed At\n";
    const csvRows = subscribers
      .map(
        (s) =>
          `${csvCell(s.email)},${csvCell(s.display_name || "")},${csvCell(new Date(s.created_at).toLocaleDateString())}`
      )
      .join("\n");
    const blob = new Blob([csvHeader + csvRows], { type: "text/csv" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "newsletter_subscribers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold text-foreground">
            Newsletter Subscribers
          </h2>
          <span className="text-sm text-muted-foreground">
            ({subscribers.length} total)
          </span>
        </div>
        {subscribers.length > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      {subscribers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No subscribers yet.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50 border-b border-border">
                <th className="text-left px-4 py-3 font-display text-xs text-muted-foreground uppercase tracking-wider">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-display text-xs text-muted-foreground uppercase tracking-wider">
                  Display Name
                </th>
                <th className="text-left px-4 py-3 font-display text-xs text-muted-foreground uppercase tracking-wider">
                  Subscribed
                </th>
                <th className="text-right px-4 py-3 font-display text-xs text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((sub) => (
                <tr
                  key={sub.id}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3 font-body text-foreground">{sub.email}</td>
                  <td className="px-4 py-3 font-body text-muted-foreground">
                    {sub.display_name || "—"}
                  </td>
                  <td className="px-4 py-3 font-body text-muted-foreground">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="text-destructive hover:text-destructive/80 transition-colors"
                      title="Remove subscriber"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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

export default AdminNewsletter;
