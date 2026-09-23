import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type ConsentApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

const oauthApi = () => (supabase.auth as unknown as { oauth: ConsentApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card/60 backdrop-blur p-6 space-y-4">
        {error ? (
          <>
            <h1 className="text-xl font-bold">Authorization failed</h1>
            <p className="text-muted-foreground text-sm">{error}</p>
          </>
        ) : !details ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <>
            <h1 className="text-xl font-bold">
              Connect {details.client?.name ?? "an app"} to your account
            </h1>
            <p className="text-muted-foreground text-sm">
              This lets {details.client?.name ?? "the client"} use Agever's on your behalf: search the
              store catalog and read your own orders.
            </p>
            <div className="flex gap-3 pt-2">
              <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
                Approve
              </Button>
              <Button disabled={busy} variant="outline" onClick={() => decide(false)} className="flex-1">
                Deny
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
