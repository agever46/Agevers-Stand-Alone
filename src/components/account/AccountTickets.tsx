import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, Clock, CheckCircle, XCircle, AlertTriangle, Plus, Upload, X, Send } from "lucide-react";
import { sendTicketNotification } from "@/lib/ticketNotifications";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AgeversLoader from "@/components/AgeversLoader";
import { useTranslation } from "react-i18next";

interface BuyerTicket {
  id: string;
  order_id: string;
  issue_type: string;
  message: string;
  status: string;
  seller_response: string | null;
  admin_note: string | null;
  resolution_type: string | null;
  screenshot_url: string | null;
  created_at: string;
  game_title?: string;
}

interface OrderOption {
  id: string;
  game_title: string;
  platform: string;
  seller_id: string;
}

const ISSUE_TYPES = [
  "Invalid key",
  "Already used key",
  "Wrong product received",
  "Key not received",
  "Other",
];

const AccountTickets = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<BuyerTicket[]>([]);
  const [loading, setLoading] = useState(true);

  // New ticket form
  const [showForm, setShowForm] = useState(false);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [issueType, setIssueType] = useState("");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchTickets();
  }, [user]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets" as any)
        .select("*")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false }) as any;

      if (error) {
        console.error("Failed to fetch tickets:", error);
        setTickets([]);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        const orderIds = [...new Set(data.map((t: any) => t.order_id))] as string[];
        const { data: orderData } = await supabase
          .from("orders")
          .select("id, game_title")
          .in("id", orderIds);

        const orderMap: Record<string, string> = {};
        orderData?.forEach(o => { orderMap[o.id] = o.game_title; });

        setTickets(data.map((t: any) => ({ ...t, game_title: orderMap[t.order_id] || "Unknown" })));
      } else {
        setTickets([]);
      }
    } catch (err) {
      console.error("Error in fetchTickets:", err);
      setTickets([]);
    }
    setLoading(false);
  };

  const ADMIN_ID = "0efdf045-36a2-408e-905e-bcc877742db9";

  const openForm = async () => {
    setShowForm(true);
    const { data } = await supabase
      .from("orders")
      .select("id, game_title, platform")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (data) {
      const ordersWithSeller: OrderOption[] = data.map((order) => ({
        ...order,
        seller_id: ADMIN_ID,
      }));
      setOrders(ordersWithSeller);
    }
  };

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedOrderId("");
    setIssueType("");
    setMessage("");
    setScreenshot(null);
    setScreenshotPreview(null);
  };

  const submitTicket = async () => {
    if (!selectedOrderId || !issueType || !message.trim()) {
      toast.error(t("account.tickets.toast.fillFields"));
      return;
    }
    if (!screenshot) {
      toast.error(t("account.tickets.toast.uploadScreenshot"));
      return;
    }
    const order = orders.find(o => o.id === selectedOrderId);
    if (!order?.seller_id) {
      toast.error(t("account.tickets.toast.sellerNotFound"));
      return;
    }

    setSubmitting(true);

    const fileExt = screenshot.name.split(".").pop();
    const filePath = `${user!.id}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("ticket-screenshots")
      .upload(filePath, screenshot);

    if (uploadError) {
      toast.error(t("account.tickets.toast.uploadFailed"));
      setSubmitting(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("ticket-screenshots")
      .getPublicUrl(filePath);

    const { error } = await supabase.from("support_tickets" as any).insert({
      order_id: selectedOrderId,
      buyer_id: user!.id,
      seller_id: order.seller_id,
      issue_type: issueType,
      message: message.trim(),
      buyer_email: user!.email || "",
      screenshot_url: urlData.publicUrl,
    } as any);

    setSubmitting(false);
    if (error) {
      toast.error(t("account.tickets.toast.submitFailed"));
      return;
    }
    toast.success(t("account.tickets.toast.submitted"));

    sendTicketNotification({
      ticket_id: selectedOrderId,
      action: "ticket_created",
      buyer_email: user!.email || "",
      game_title: order.game_title,
    });

    resetForm();
    fetchTickets();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <AgeversLoader />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-black tracking-wider text-foreground">{t("account.tickets.title")}</h2>
        <p className="text-muted-foreground text-sm mt-1">{t("account.tickets.subtitle")}</p>
        {!showForm && (
          <Button
            onClick={openForm}
            className="mt-3 font-display text-xs tracking-wider uppercase bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {t("account.tickets.newTicket")}
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {showForm && (
          <div className="glass rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold tracking-wider text-foreground uppercase">{t("account.tickets.form.title")}</h3>
              <button
                onClick={resetForm}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{t("account.tickets.form.order")}</label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                <option value="">{t("account.tickets.form.selectOrder")}</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.game_title} ({o.platform})
                  </option>
                ))}
              </select>
              {orders.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">{t("account.tickets.form.noOrders")}</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{t("account.tickets.form.issueType")}</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                <option value="">{t("account.tickets.form.selectIssue")}</option>
                {ISSUE_TYPES.map((tp) => (
                  <option key={tp} value={tp}>{tp}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{t("account.tickets.form.describe")}</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder={t("account.tickets.form.describePlaceholder")}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1 block">{t("account.tickets.form.screenshot")}</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleScreenshot}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                className="w-full font-display text-xs tracking-wider uppercase"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {screenshot ? t("account.tickets.form.changeScreenshot") : t("account.tickets.form.uploadScreenshot")}
              </Button>
              {screenshotPreview && (
                <img src={screenshotPreview} alt="preview" className="mt-2 max-h-32 rounded-lg border border-border" />
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={submitTicket}
                disabled={submitting}
                className="flex-1 font-display text-xs tracking-wider uppercase bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-4 w-4 mr-1.5" />
                {submitting ? t("account.tickets.form.submitting") : t("account.tickets.form.submit")}
              </Button>
              <Button
                onClick={resetForm}
                variant="outline"
                disabled={submitting}
                className="font-display text-xs tracking-wider uppercase"
              >
                {t("account.tickets.form.cancel")}
              </Button>
            </div>
          </div>
        )}

        {tickets.length === 0 && !showForm ? (
          <div className="glass rounded-xl p-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-body">{t("account.tickets.empty.title")}</p>
            <p className="text-sm text-muted-foreground/60 font-body mt-1">
              {t("account.tickets.empty.subtitle")}
            </p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <div key={ticket.id} className="glass rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-sm font-bold text-foreground">{ticket.game_title}</h3>
                    {ticket.status === "open" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-display px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                        <Clock className="h-3 w-3" /> {t("account.tickets.status.open")}
                      </span>
                    )}
                    {ticket.status === "in_progress" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-display px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">
                        <MessageSquare className="h-3 w-3" /> {t("account.tickets.status.inProgress")}
                      </span>
                    )}
                    {ticket.status === "escalated" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-display px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">
                        <AlertTriangle className="h-3 w-3" /> {t("account.tickets.status.underReview")}
                      </span>
                    )}
                    {ticket.status === "resolved" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-display px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                        <CheckCircle className="h-3 w-3" /> {t("account.tickets.status.resolved")}
                      </span>
                    )}
                    {ticket.status === "closed" && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-display px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        <XCircle className="h-3 w-3" /> {t("account.tickets.status.closed")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ticket.issue_type} • {new Date(ticket.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1">{t("account.tickets.labels.yourMessage")}</p>
                <p className="text-sm text-foreground whitespace-pre-line">{ticket.message}</p>
              </div>

              {ticket.screenshot_url && (
                <div>
                  <p className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground mb-1">{t("account.tickets.labels.yourScreenshot")}</p>
                  <a href={ticket.screenshot_url} target="_blank" rel="noopener noreferrer">
                    <img src={ticket.screenshot_url} alt="Issue screenshot" className="max-h-32 rounded-lg border border-border hover:opacity-80 transition-opacity" />
                  </a>
                </div>
              )}

              {ticket.seller_response && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <p className="text-[10px] font-display font-bold uppercase tracking-wider text-primary mb-1">{t("account.tickets.labels.sellerResponse")}</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{ticket.seller_response}</p>
                </div>
              )}

              {ticket.admin_note && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                  <p className="text-[10px] font-display font-bold uppercase tracking-wider text-orange-400 mb-1">{t("account.tickets.labels.adminDecision")}</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{ticket.admin_note}</p>
                </div>
              )}

              {ticket.resolution_type && (
                <p className="text-xs text-muted-foreground font-display italic">
                  {t("account.tickets.labels.resolution")}{" "}
                  {ticket.resolution_type === "refund" ? t("account.tickets.resolution.refund")
                    : ticket.resolution_type === "new_code" ? t("account.tickets.resolution.new_code")
                    : ticket.resolution_type === "challenged" ? t("account.tickets.resolution.challenged")
                    : ticket.resolution_type === "admin_resolved" ? t("account.tickets.resolution.admin_resolved")
                    : ticket.resolution_type === "admin_refund" ? t("account.tickets.resolution.admin_refund")
                    : ticket.resolution_type}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AccountTickets;
