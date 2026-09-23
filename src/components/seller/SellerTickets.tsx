import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageSquare, Clock, CheckCircle, XCircle, Send, AlertTriangle, RefreshCw, Key, Shield } from "lucide-react";
import { sendTicketNotification } from "@/lib/ticketNotifications";
import AgeversLoader from "@/components/AgeversLoader";

interface Ticket {
  id: string;
  order_id: string;
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
}

const SellerTickets = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionType, setActionType] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("active");

  useEffect(() => {
    if (!user) return;
    fetchTickets();
  }, [user]);

  const fetchTickets = async () => {
    const { data } = await supabase
      .rpc("get_seller_tickets")
      .order("created_at", { ascending: false }) as any;

    if (data) {
      const orderIds = [...new Set(data.map((t: any) => t.order_id))] as string[];
      const { data: orderData } = await supabase
        .from("orders")
        .select("id, game_title")
        .in("id", orderIds);

      const orderMap: Record<string, string> = {};
      orderData?.forEach(o => { orderMap[o.id] = o.game_title; });

      setTickets(data.map((t: any) => ({ ...t, game_title: orderMap[t.order_id] || "Unknown" })));
    }
    setLoading(false);
  };

  const handleAction = async (ticketId: string, action: string) => {
    if (!responseText.trim() && action !== "challenge") {
      toast.error("Please write a response");
      return;
    }
    setSubmitting(true);

    const updateData: any = {
      updated_at: new Date().toISOString(),
      seller_response: responseText.trim() || null,
    };

    if (action === "challenge") {
      updateData.status = "escalated";
      updateData.resolution_type = "challenged";
    } else if (action === "refund" || action === "new_code") {
      updateData.status = "resolved";
      updateData.resolution_type = action;
    } else {
      updateData.status = "in_progress";
    }

    await supabase
      .from("support_tickets" as any)
      .update(updateData)
      .eq("id", ticketId) as any;

    // Send email notification to buyer
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      const notifAction = action === "challenge" ? "ticket_escalated" : "seller_response";
      sendTicketNotification({
        ticket_id: ticketId,
        action: notifAction,
        buyer_email: ticket.buyer_email,
        game_title: ticket.game_title || "Unknown",
        seller_response: responseText.trim() || undefined,
      });
    }

    const actionLabels: Record<string, string> = {
      reply: "Response sent",
      refund: "Ticket resolved with refund",
      new_code: "Ticket resolved with new code",
      challenge: "Ticket escalated to admin",
    };

    toast.success(actionLabels[action] || "Updated");
    setActiveTicket(null);
    setResponseText("");
    setActionType(null);
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
        return <Badge className="gap-1 text-[10px] bg-orange-500 text-white"><Shield className="h-3 w-3" /> Escalated to Admin</Badge>;
      case "resolved":
        return <Badge variant="secondary" className="gap-1 text-[10px]"><CheckCircle className="h-3 w-3" /> Resolved</Badge>;
      case "closed":
        return <Badge variant="outline" className="gap-1 text-[10px]"><XCircle className="h-3 w-3" /> Closed</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const resolutionLabel = (type: string | null) => {
    switch (type) {
      case "refund": return "Refund issued";
      case "new_code": return "New code sent";
      case "challenged": return "Challenged — awaiting admin";
      case "admin_resolved": return "Resolved by admin";
      case "admin_refund": return "Refund by admin";
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <AgeversLoader />
      </div>
    );
  }

  const activeTickets = tickets.filter(t => t.status !== "escalated" && t.status !== "resolved" && t.status !== "closed");
  const escalatedTickets = tickets.filter(t => t.status === "escalated");
  const resolvedTickets = tickets.filter(t => t.status === "resolved" || t.status === "closed");

  const filteredTickets = filter === "active" ? activeTickets : filter === "escalated" ? escalatedTickets : resolvedTickets;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold tracking-wider text-foreground">
          Support Tickets
        </h2>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "active", label: "Active", count: activeTickets.length },
          { key: "escalated", label: "Escalated", count: escalatedTickets.length },
          { key: "resolved", label: "Resolved", count: resolvedTickets.length },
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
          <p className="text-muted-foreground font-display">
            {filter === "escalated" ? "No escalated tickets" : filter === "resolved" ? "No resolved tickets" : "No active tickets"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map(ticket => (
            <div key={ticket.id} className="glass rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-foreground text-sm">{ticket.game_title}</h3>
                    {statusBadge(ticket.status)}
                    {ticket.resolution_type && (
                      <span className="text-[10px] font-display text-muted-foreground italic">
                        ({resolutionLabel(ticket.resolution_type)})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ticket.issue_type} • {ticket.buyer_email}
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
                  <p className="text-[10px] font-display font-bold uppercase tracking-wider text-primary mb-1">Your Response</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{ticket.seller_response}</p>
                </div>
              )}

              {/* Admin note (if escalated and admin responded) */}
              {ticket.admin_note && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                  <p className="text-[10px] font-display font-bold uppercase tracking-wider text-orange-400 mb-1">Admin Decision</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{ticket.admin_note}</p>
                </div>
              )}

              {/* Actions */}
              {ticket.status !== "resolved" && ticket.status !== "closed" && ticket.status !== "escalated" && (
                <div>
                  {activeTicket === ticket.id ? (
                    <div className="space-y-3">
                      <Textarea
                        value={responseText}
                        onChange={e => setResponseText(e.target.value)}
                        placeholder={
                          actionType === "refund" ? "Describe the refund details..."
                          : actionType === "new_code" ? "Paste the new code and describe..."
                          : actionType === "challenge" ? "Explain why you're challenging (optional)..."
                          : "Write a response to the buyer..."
                        }
                        className="min-h-[80px]"
                        maxLength={1000}
                      />
                      <div className="flex flex-wrap gap-2">
                        {actionType === "reply" && (
                          <Button size="sm" className="font-display tracking-wider text-xs gap-1.5" disabled={submitting || !responseText.trim()} onClick={() => handleAction(ticket.id, "reply")}>
                            <Send className="h-3 w-3" /> Send Reply
                          </Button>
                        )}
                        {actionType === "refund" && (
                          <Button size="sm" className="font-display tracking-wider text-xs gap-1.5 bg-neon-green hover:bg-neon-green/80 text-background" disabled={submitting || !responseText.trim()} onClick={() => handleAction(ticket.id, "refund")}>
                            <RefreshCw className="h-3 w-3" /> Confirm Refund & Resolve
                          </Button>
                        )}
                        {actionType === "new_code" && (
                          <Button size="sm" className="font-display tracking-wider text-xs gap-1.5 bg-neon-green hover:bg-neon-green/80 text-background" disabled={submitting || !responseText.trim()} onClick={() => handleAction(ticket.id, "new_code")}>
                            <Key className="h-3 w-3" /> Send Code & Resolve
                          </Button>
                        )}
                        {actionType === "challenge" && (
                          <Button size="sm" variant="destructive" className="font-display tracking-wider text-xs gap-1.5" disabled={submitting} onClick={() => handleAction(ticket.id, "challenge")}>
                            <AlertTriangle className="h-3 w-3" /> Escalate to Admin
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="font-display tracking-wider text-xs" onClick={() => { setActiveTicket(null); setResponseText(""); setActionType(null); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="font-display tracking-wider text-xs gap-1" onClick={() => { setActiveTicket(ticket.id); setActionType("reply"); }}>
                        <Send className="h-3 w-3" /> Reply
                      </Button>
                      <Button size="sm" variant="outline" className="font-display tracking-wider text-xs gap-1" onClick={() => { setActiveTicket(ticket.id); setActionType("refund"); }}>
                        <RefreshCw className="h-3 w-3" /> Send Refund
                      </Button>
                      <Button size="sm" variant="outline" className="font-display tracking-wider text-xs gap-1" onClick={() => { setActiveTicket(ticket.id); setActionType("new_code"); }}>
                        <Key className="h-3 w-3" /> Send New Code
                      </Button>
                      <Button size="sm" variant="destructive" className="font-display tracking-wider text-xs gap-1" onClick={() => { setActiveTicket(ticket.id); setActionType("challenge"); }}>
                        <AlertTriangle className="h-3 w-3" /> Challenge
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SellerTickets;
