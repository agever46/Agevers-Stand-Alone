import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, Send, Clock as ClockIcon, XCircle } from "lucide-react";

interface Props {
  blockedReason: string;
  isNewAccountLimit: boolean;
  userEmail?: string;
  userId?: string;
}

type AppealRow = {
  id: string;
  status: "pending" | "approved" | "denied";
  buyer_message: string;
  admin_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const AppealForm = ({ blockedReason, isNewAccountLimit, userEmail, userId }: Props) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<AppealRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("account_appeals")
        .select("id,status,buyer_message,admin_comment,created_at,reviewed_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) setExisting(data[0] as AppealRow);
      setLoading(false);
    })();
  }, [userId]);

  if (!userId) {
    return (
      <div className="w-full max-w-md rounded-lg border border-border/50 bg-secondary/30 p-3 text-left">
        <p className="text-xs text-muted-foreground/80 italic">
          We could not load your account session. Please refresh this page and try logging in again to open the Appeal Form.
        </p>
      </div>
    );
  }

  if (existing && existing.status === "pending") {
    return (
      <div className="w-full max-w-md rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-left">
        <div className="flex items-center gap-2 text-amber-500 font-display text-xs font-bold tracking-wider">
          <ClockIcon className="h-4 w-4" /> APPEAL UNDER REVIEW
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          We received your request and will respond shortly. You'll be notified by email.
        </p>
      </div>
    );
  }

  if (existing && existing.status === "denied") {
    const cooldownMs = 24 * 3600 * 1000;
    const reviewedAt = existing.reviewed_at ? new Date(existing.reviewed_at).getTime() : 0;
    const remaining = reviewedAt + cooldownMs - Date.now();
    if (remaining > 0) {
      const hours = Math.ceil(remaining / 3600000);
      return (
        <div className="w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left">
          <div className="flex items-center gap-2 text-destructive font-display text-xs font-bold tracking-wider">
            <XCircle className="h-4 w-4" /> APPEAL DENIED
          </div>
          {existing.admin_comment && (
            <p className="text-xs text-muted-foreground mt-2 italic">"{existing.admin_comment}"</p>
          )}
          <p className="text-[11px] text-muted-foreground/70 mt-2">
            You can submit a new appeal in {hours}h.
          </p>
        </div>
      );
    }
  }

  const submit = async () => {
    if (message.trim().length < 20) {
      toast.error("Please provide at least 20 characters explaining your situation.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("account_appeals").insert({
      user_id: userId,
      user_email: userEmail || null,
      blocked_reason: (isNewAccountLimit ? "NEW_ACCOUNT_LIMIT: " : "FRAUD_BLOCK: ") + blockedReason.slice(0, 500),
      buyer_message: message.trim().slice(0, 2000),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Could not submit appeal");
      return;
    }
    toast.success("Appeal submitted — we'll review it shortly.");
    setExisting({
      id: "tmp",
      status: "pending",
      buyer_message: message,
      admin_comment: null,
      created_at: new Date().toISOString(),
      reviewed_at: null,
    });
    setMessage("");
    setOpen(false);
  };

  if (!open) {
    return (
      <div className="w-full max-w-md space-y-2">
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={() => setOpen(true)}
          className="w-full gap-2 border-destructive/50 bg-destructive/10 text-foreground hover:bg-destructive/20"
        >
          <Send className="h-4 w-4" />
          Open Appeal Form
        </Button>
        {loading && (
          <p className="text-[11px] text-muted-foreground text-center">Checking existing appeals…</p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-border/50 bg-secondary/30 p-3 text-left space-y-2">
      <p className="text-xs font-display font-bold tracking-wider">REQUEST MANUAL REVIEW</p>
      <p className="text-[11px] text-muted-foreground">
        Briefly explain your situation. An admin will verify your account and unblock it if appropriate.
      </p>
      <Textarea
        placeholder="e.g. I just created my account to buy a gift for a friend..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
        rows={4}
        className="text-xs bg-background"
      />
      <div className="flex gap-2 justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={submit} disabled={submitting} className="gap-2">
          <CheckCircle2 className="h-3 w-3" />
          {submitting ? "Submitting…" : "Submit"}
        </Button>
      </div>
    </div>
  );
};

export default AppealForm;