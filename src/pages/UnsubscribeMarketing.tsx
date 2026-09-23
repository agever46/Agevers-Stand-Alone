import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, Mail } from "lucide-react";

const UnsubscribeMarketing = () => {
  const [params] = useSearchParams();
  const email = params.get("email") || "";
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const handleUnsubscribe = async () => {
    if (!email) return;
    setStatus("loading");
    const { error } = await supabase.functions.invoke("marketing-unsubscribe", {
      body: { email, reason: "user_requested" },
    });
    setStatus(error ? "error" : "done");
  };

  useEffect(() => {
    document.title = "Unsubscribe - Agever's";
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <Mail className="h-12 w-12 mx-auto text-primary" />
        <h1 className="text-2xl font-bold">Unsubscribe from Marketing Emails</h1>
        {!email && <p className="text-muted-foreground">No email provided.</p>}
        {email && status === "idle" && (
          <>
            <p className="text-muted-foreground">
              Are you sure you want to unsubscribe <strong>{email}</strong> from
              Agever's marketing emails? You'll still receive transactional emails
              (orders, account, etc.).
            </p>
            <Button onClick={handleUnsubscribe} variant="destructive" className="w-full">
              Yes, unsubscribe me
            </Button>
          </>
        )}
        {status === "loading" && <Loader2 className="h-8 w-8 animate-spin mx-auto" />}
        {status === "done" && (
          <div className="text-emerald-500 space-y-2">
            <CheckCircle2 className="h-12 w-12 mx-auto" />
            <p>You have been unsubscribed.</p>
          </div>
        )}
        {status === "error" && (
          <p className="text-destructive">Something went wrong. Please try again.</p>
        )}
      </Card>
    </div>
  );
};

export default UnsubscribeMarketing;