import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MailX, Loader2, CheckCircle, AlertCircle } from "lucide-react";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid === false && data.reason === "already_unsubscribed") setStatus("already");
        else if (data.valid) setStatus("valid");
        else setStatus("invalid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) setStatus("success");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch {
      setStatus("error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && <Loader2 className="h-12 w-12 text-primary mx-auto animate-spin" />}

        {status === "valid" && (
          <>
            <MailX className="h-16 w-16 text-primary mx-auto" />
            <h1 className="font-display text-2xl font-black tracking-wider text-foreground">Unsubscribe</h1>
            <p className="text-muted-foreground text-sm">
              Are you sure you want to unsubscribe from Agever's emails?
            </p>
            <Button variant="hero" onClick={handleUnsubscribe} disabled={processing} className="w-full">
              {processing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</> : "Confirm Unsubscribe"}
            </Button>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="font-display text-2xl font-black tracking-wider text-foreground">Unsubscribed</h1>
            <p className="text-muted-foreground text-sm">You've been successfully unsubscribed from our emails.</p>
          </>
        )}

        {status === "already" && (
          <>
            <CheckCircle className="h-16 w-16 text-muted-foreground mx-auto" />
            <h1 className="font-display text-2xl font-black tracking-wider text-foreground">Already Unsubscribed</h1>
            <p className="text-muted-foreground text-sm">You've already unsubscribed from our emails.</p>
          </>
        )}

        {status === "invalid" && (
          <>
            <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="font-display text-2xl font-black tracking-wider text-foreground">Invalid Link</h1>
            <p className="text-muted-foreground text-sm">This unsubscribe link is invalid or has expired.</p>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="font-display text-2xl font-black tracking-wider text-foreground">Something Went Wrong</h1>
            <p className="text-muted-foreground text-sm">Please try again or contact support.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
