import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageSquare, Clock, CheckCircle, XCircle, Shield, RefreshCw, Key, Send, AlertTriangle, Headphones, Volume2, Power, MessagesSquare } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { sendTicketNotification } from "@/lib/ticketNotifications";
import AgeversLoader from "@/components/AgeversLoader";
import { gameSounds } from "@/lib/gameSounds";
import LiveChatPanel from "@/components/LiveChatPanel";
import { useAuth } from "@/hooks/useAuth";

interface Ticket {
  id: string;
  order_id: string;
  buyer_id: string;
  seller_id: string;
  buyer_email: string;
  issue_type: string;
  message: string;
  status: string;
  admin_note: string | null;
  seller_response: string | null;
  resolution_type: string | null;
  screenshot_url: string | null;
  created_at: string;
  game_title?: string;
  seller_name?: string;
}

interface LiveRequest {
  id: string;
  user_id: string;
  user_email: string;
  status: string;
  created_at: string;
  username?: string;
}

type OverrideMode = "auto" | "force_on" | "force_off";

const AdminTickets = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [liveRequests, setLiveRequests] = useState<LiveRequest[]>([]);
  const [activeChatRequest, setActiveChatRequest] = useState<LiveRequest | null>(null);
  const [overrideMode, setOverrideMode] = useState<OverrideMode>("auto");
  const [togglingSupport, setTogglingSupport] = useState(false);
  const prevLiveCountRef = useRef(0);
  const { user } = useAuth();

  // Fetch live support setting
  useEffect(() => {
    const fetchSetting = async () => {
      const { data } = await supabase
        .from("live_support_settings" as any)
        .select("override_mode")
        .eq("id", 1)
        .single() as any;
      if (data?.override_mode) setOverrideMode(data.override_mode as OverrideMode);
    };
    fetchSetting();
  }, []);

  const setOverride = async (mode: OverrideMode) => {
    if (mode === overrideMode) return;
    setTogglingSupport(true);
    await supabase
      .from("live_support_settings" as any)
      .update({ override_mode: mode, updated_at: new Date().toISOString(), updated_by: user?.id } as any)
      .eq("id", 1) as any;
    setOverrideMode(mode);
    const labels: Record<OverrideMode, string> = {
      auto: "Live support set to Auto (follows business hours)",
      force_on: "Live support forced ON",
      force_off: "Live support forced OFF",
    };
    toast.success(labels[mode]);
    setTogglingSupport(false);
  };

  const fetchLiveRequests = async () => {
    const { data } = await supabase
      .from("live_support_requests" as any)
      .select("*")
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false }) as any;
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((r: any) => r.user_id))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", userIds);
      const profileMap: Record<string, string> = {};
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p.username || p.display_name || ""; });
      setLiveRequests(data.map((r: any) => ({ ...r, username: profileMap[r.user_id] || "" })));
    } else {
      setLiveRequests([]);
    }
  };

  const handleCloseLiveRequest = async (id: string) => {
    // Send system close message
    if (user) {
      await supabase.from("live_chat_messages").insert({
        request_id: id,
        sender_id: user.id,
        sender_role: "system",
        content: "Chat ended by Admin.",
      } as any);
    }
    await supabase.from("live_support_requests" as any).update({ status: "closed" } as any).eq("id", id) as any;
    setLiveRequests((prev) => prev.filter((r) => r.id !== id));
    toast.success("Live request closed");
  };

  const startLiveChatFromTicket = async (ticket: Ticket) => {
    if (!user) return;
    // Try to find an existing open request for this buyer
    const { data: existing } = await supabase
      .from("live_support_requests" as any)
      .select("*")
      .eq("user_id", ticket.buyer_id)
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false })
      .limit(1) as any;

    let request: any = existing?.[0];

    if (!request) {
      const { data: created, error } = await supabase
        .from("live_support_requests" as any)
        .insert({
          user_id: ticket.buyer_id,
          user_email: ticket.buyer_email,
          status: "active",
          initiated_by: "admin",
        } as any)
        .select()
        .single() as any;
      if (error || !created) {
        toast.error("Could not start live chat");
        return;
      }
      request = created;
    }

    setActiveChatRequest({
      id: request.id,
      user_id: request.user_id,
      user_email: request.user_email || ticket.buyer_email,
      status: request.status,
      created_at: request.created_at,
    });

    // Email-notify the buyer that an agent is waiting
    try {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'live-chat-invite',
          recipientEmail: ticket.buyer_email,
          idempotencyKey: `live-chat-invite-${ticket.id}-${request.id}`,
          templateData: { ticketMessage: ticket.message },
        },
      });
    } catch (e) {
      console.error('Failed to send live-chat invite email', e);
    }

    toast.success("Live chat opened — buyer notified by email");
  };

  useEffect(() => {
    fetchTickets();
    fetchLiveRequests();

    // Realtime subscription for live support requests
    const channel = supabase
      .channel("live-support-admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_support_requests" },
        async (payload) => {
          const newReq = payload.new as LiveRequest;
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, display_name")
            .eq("user_id", newReq.user_id)
            .single();
          newReq.username = profile?.username || profile?.display_name || "";
          setLiveRequests((prev) => [newReq, ...prev]);
          gameSounds.notification();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_support_requests" },
        async (payload) => {
          const updated = payload.new as LiveRequest;
          if (updated.status === "pending") {
            // Reopened chat — add to list if not already there
            const { data: profile } = await supabase
              .from("profiles")
              .select("username, display_name")
              .eq("user_id", updated.user_id)
              .single();
            updated.username = profile?.username || profile?.display_name || "";
            setLiveRequests((prev) => {
              if (prev.some((r) => r.id === updated.id)) return prev;
              return [updated, ...prev];
            });
            gameSounds.notification();
          } else if (updated.status === "closed") {
            setLiveRequests((prev) => prev.filter((r) => r.id !== updated.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTickets = async () => {
    const { data } = await supabase
      .from("support_tickets" as any)
      .select("*")
      .order("created_at", { ascending: false }) as any;

    if (data) {
      const orderIds = [...new Set(data.map((t: any) => t.order_id))] as string[];
      const sellerIds = [...new Set(data.map((t: any) => t.seller_id))] as string[];

      const [orderRes, profileRes] = await Promise.all([
        supabase.from("orders").select("id, game_title").in("id", orderIds),
        supabase.from("profiles").select("user_id, username, display_name").in("user_id", sellerIds),
      ]);

      const orderMap: Record<string, string> = {};
      orderRes.data?.forEach(o => { orderMap[o.id] = o.game_title; });

      const sellerMap: Record<string, string> = {};
      profileRes.data?.forEach(p => { sellerMap[p.user_id] = p.username || p.display_name || "Unknown"; });

      setTickets(data.map((t: any) => ({
        ...t,
        game_title: orderMap[t.order_id] || "Unknown",
        seller_name: sellerMap[t.seller_id] || "Unknown",
      })));
    }
    setLoading(false);
  };

  const handleAdminAction = async (ticketId: string, action: "resolve" | "refund" | "close") => {
    if (!adminNote.trim() && action !== "close") {
      toast.error("Please add an admin note");
      return;
    }
    setSubmitting(true);
    const updateData: any = {
      admin_note: adminNote.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (action === "resolve") {
      updateData.status = "resolved";
      updateData.resolution_type = "admin_resolved";
    } else if (action === "refund") {
      updateData.status = "resolved";
      updateData.resolution_type = "admin_refund";
    } else {
      updateData.status = "closed";
    }

    await supabase.from("support_tickets" as any).update(updateData).eq("id", ticketId) as any;

    // Send email notification to buyer
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      const notifAction = action === "resolve" ? "admin_resolved" : action === "refund" ? "admin_refund" : "admin_closed";
      sendTicketNotification({
        ticket_id: ticketId,
        action: notifAction,
        buyer_email: ticket.buyer_email,
        game_title: ticket.game_title || "Unknown",
        admin_note: adminNote.trim() || undefined,
      });
    }

    toast.success(`Ticket ${action === "close" ? "closed" : "resolved"}`);
    setActiveTicket(null);
    setAdminNote("");
    setSubmitting(false);
    fetchTickets();
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive" className="gap-1 text-[10px]"><Clock className="h-3 w-3" /> Open</Badge>;
      case "in_progress":
        return <Badge className="gap-1 text-[10px] bg-accent text-accent-foreground"><MessageSquare className="h-3 w-3" /> In Progress</Badge>;
      case "escalated":
        return <Badge className="gap-1 text-[10px] bg-orange-500 text-white"><Shield className="h-3 w-3" /> Escalated</Badge>;
      case "resolved":
        return <Badge variant="secondary" className="gap-1 text-[10px]"><CheckCircle className="h-3 w-3" /> Resolved</Badge>;
      case "closed":
        return <Badge variant="outline" className="gap-1 text-[10px]"><XCircle className="h-3 w-3" /> Closed</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const filteredTickets = filter === "all" ? tickets : tickets.filter(t => t.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <AgeversLoader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Live support override control */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Power className={`h-5 w-5 ${overrideMode === "force_off" ? "text-destructive" : overrideMode === "force_on" ? "text-green-400" : "text-accent"}`} />
          <div className="flex-1">
            <p className="text-sm font-display font-bold text-foreground">
              Live Support Service
            </p>
            <p className="text-xs text-muted-foreground">
              {overrideMode === "auto" && "Auto — follows business hours (Sun–Thu 8AM–11PM · Fri 8AM–12PM · Sat 8PM–11PM IST)"}
              {overrideMode === "force_on" && "Forced ON — chat is open right now, regardless of business hours"}
              {overrideMode === "force_off" && "Forced OFF — chat is closed right now, regardless of business hours"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={overrideMode === "auto" ? "default" : "outline"}
            className="font-display tracking-wider text-xs"
            disabled={togglingSupport}
            onClick={() => setOverride("auto")}
          >
            Auto (schedule)
          </Button>
          <Button
            size="sm"
            variant={overrideMode === "force_on" ? "default" : "outline"}
            className={`font-display tracking-wider text-xs ${overrideMode === "force_on" ? "bg-neon-green hover:bg-neon-green/80 text-background" : ""}`}
            disabled={togglingSupport}
            onClick={() => setOverride("force_on")}
          >
            Force ON
          </Button>
          <Button
            size="sm"
            variant={overrideMode === "force_off" ? "destructive" : "outline"}
            className="font-display tracking-wider text-xs"
            disabled={togglingSupport}
            onClick={() => setOverride("force_off")}
          >
            Force OFF
          </Button>
        </div>
      </div>

      {/* Live support requests */}
      {liveRequests.length > 0 && (
        <div className="glass rounded-xl p-5 border-2 border-destructive/50 space-y-3">
          <div className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-destructive animate-pulse" />
            <h2 className="font-display font-bold text-foreground text-sm">
              Live Support Requests
            </h2>
            <Badge variant="destructive" className="animate-pulse text-xs">
              {liveRequests.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {liveRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between bg-destructive/10 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {req.username ? `${req.username} · ` : ""}{req.user_email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                   <Button
                     size="sm"
                     className="font-display tracking-wider text-xs gap-1 bg-neon-green hover:bg-neon-green/80 text-background"
                     onClick={() => {
                       setActiveChatRequest(req);
                       setLiveRequests(prev => prev.filter(r => r.id !== req.id));
                     }}
                   >
                     <Send className="h-3 w-3" /> {req.status === "active" ? "Rejoin" : "Chat"}
                   </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="font-display tracking-wider text-xs gap-1"
                    onClick={() => handleCloseLiveRequest(req.id)}
                  >
                    <XCircle className="h-3 w-3" /> Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: "All", count: tickets.length },
          { key: "escalated", label: "Escalated", count: tickets.filter(t => t.status === "escalated").length },
          { key: "open", label: "Open", count: tickets.filter(t => t.status === "open").length },
          { key: "in_progress", label: "In Progress", count: tickets.filter(t => t.status === "in_progress").length },
          { key: "resolved", label: "Resolved", count: tickets.filter(t => t.status === "resolved").length },
          { key: "closed", label: "Closed", count: tickets.filter(t => t.status === "closed").length },
        ].map(f => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            className="font-display tracking-wider text-xs gap-1"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            {f.count > 0 && <span className="ml-1 opacity-70">({f.count})</span>}
          </Button>
        ))}
      </div>

      {filteredTickets.length === 0 ? (
        <div className="text-center py-16 glass rounded-xl">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-display">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map(ticket => (
            <div
              key={ticket.id}
              className={`glass rounded-xl p-5 space-y-3 ${ticket.status === "escalated" ? "border-2 border-orange-500/50" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-foreground text-sm">{ticket.game_title}</h3>
                    {statusBadge(ticket.status)}
                    {ticket.resolution_type && (
                      <span className="text-[10px] font-display text-muted-foreground italic">
                        ({ticket.resolution_type.replace("_", " ")})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ticket.issue_type} • Buyer: {ticket.buyer_email} • Seller: <span className="text-foreground font-semibold">{ticket.seller_name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleDateString()} at {new Date(ticket.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Buyer message */}
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1">Buyer's Message</p>
                <p className="text-sm text-foreground whitespace-pre-line">{ticket.message}</p>
              </div>

              {/* Screenshot */}
              {ticket.screenshot_url && (
                <div>
                  <p className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1">Buyer's Screenshot</p>
                  <a href={ticket.screenshot_url} target="_blank" rel="noopener noreferrer">
                    <img src={ticket.screenshot_url} alt="Issue screenshot" className="max-h-40 rounded-lg border border-border hover:opacity-80 transition-opacity" />
                  </a>
                </div>
              )}

              {/* Seller response */}
              {ticket.seller_response && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <p className="text-[10px] font-display font-bold uppercase tracking-wider text-primary mb-1">Seller Response</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{ticket.seller_response}</p>
                </div>
              )}

              {/* Admin note */}
              {ticket.admin_note && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                  <p className="text-[10px] font-display font-bold uppercase tracking-wider text-orange-400 mb-1">Admin Note</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{ticket.admin_note}</p>
                </div>
              )}

              {/* Admin actions */}
              {ticket.status !== "resolved" && ticket.status !== "closed" && (
                <div>
                  {activeTicket === ticket.id ? (
                    <div className="space-y-3">
                      <Textarea
                        value={adminNote}
                        onChange={e => setAdminNote(e.target.value)}
                        placeholder="Admin decision / note..."
                        className="min-h-[80px]"
                        maxLength={1000}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" className="font-display tracking-wider text-xs gap-1.5 bg-neon-green hover:bg-neon-green/80 text-background" disabled={submitting || !adminNote.trim()} onClick={() => handleAdminAction(ticket.id, "resolve")}>
                          <CheckCircle className="h-3 w-3" /> Resolve
                        </Button>
                        <Button size="sm" variant="destructive" className="font-display tracking-wider text-xs gap-1.5" disabled={submitting || !adminNote.trim()} onClick={() => handleAdminAction(ticket.id, "refund")}>
                          <RefreshCw className="h-3 w-3" /> Refund Buyer
                        </Button>
                        <Button size="sm" variant="outline" className="font-display tracking-wider text-xs gap-1.5" disabled={submitting} onClick={() => handleAdminAction(ticket.id, "close")}>
                          <XCircle className="h-3 w-3" /> Close
                        </Button>
                        <Button size="sm" variant="ghost" className="font-display tracking-wider text-xs" onClick={() => { setActiveTicket(null); setAdminNote(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="font-display tracking-wider text-xs gap-1" onClick={() => setActiveTicket(ticket.id)}>
                        <Shield className="h-3 w-3" /> Take Action
                      </Button>
                      <Button
                        size="sm"
                        className="font-display tracking-wider text-xs gap-1 bg-primary hover:bg-primary/80 text-primary-foreground"
                        onClick={() => startLiveChatFromTicket(ticket)}
                      >
                        <MessagesSquare className="h-3 w-3" /> Start Live Chat
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Live chat panel */}
      {activeChatRequest && user && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-[420px] max-w-full h-[600px] max-h-[90vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <LiveChatPanel
              requestId={activeChatRequest.id}
              currentUserId={user.id}
              currentRole="admin"
              userEmail={activeChatRequest.user_email}
               onClose={(wasClosed) => {
                 // Only add back to the pending list if the chat is still
                 // open (admin just minimized it) — if it was actually
                 // ended via "End Chat", it's closed server-side and must
                 // not reappear as if it were still active.
                 if (!wasClosed) {
                   setLiveRequests(prev => {
                     if (prev.some(r => r.id === activeChatRequest.id)) return prev;
                     return [{ ...activeChatRequest, status: "active" }, ...prev];
                   });
                 }
                 setActiveChatRequest(null);
               }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTickets;
