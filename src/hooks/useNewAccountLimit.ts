import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Fallback cap used while the account's real cap hasn't loaded yet, or was
// never evaluated — matches fraud-check's BASE_NEW_ACCOUNT_CAP. The actual
// per-user cap (20 or 60) lives in fraud_scores.new_account_limit_cap.
export const NEW_ACCOUNT_LIMIT_EUR = 20;
// Dispatched (see Auth.tsx) once the auto new-account precheck finishes, so
// already-mounted consumers of this hook — and NewAccountLimitBanner, which
// duplicates this same fetch — re-read the fraud_scores row instead of
// staying on the pre-check value for the rest of the session.
export const NEW_ACCOUNT_LIMIT_REFRESH_EVENT = "agevers:new-account-limit-refresh";
const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Whether the current user is inside the new-account spend-cap window
 * (logged in, account created <24h ago, not manually exempted via
 * fraud_scores.new_account_limit_exempt), and what their effective cap is
 * (20 or 60, per new_account_limit_cap). Same rule enforced server-side in
 * fraud-check and useCart's addItem — this is the UI-facing check used to
 * hide purchase actions on products above the limit before the user even
 * tries to buy one.
 */
export function useNewAccountLimit() {
  const { user } = useAuth();
  const [exempt, setExempt] = useState(false);
  const [cap, setCap] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setExempt(false);
      setCap(null);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    const fetchLimit = () => {
      supabase
        .from("fraud_scores")
        .select("new_account_limit_exempt, new_account_limit_cap")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return;
          setExempt(!!(data as any)?.new_account_limit_exempt);
          setCap((data as any)?.new_account_limit_cap ?? null);
          setLoaded(true);
        });
    };
    fetchLimit();
    window.addEventListener(NEW_ACCOUNT_LIMIT_REFRESH_EVENT, fetchLimit);
    return () => {
      cancelled = true;
      window.removeEventListener(NEW_ACCOUNT_LIMIT_REFRESH_EVENT, fetchLimit);
    };
  }, [user?.id]);

  const isWithin24h = !!user && Date.now() - new Date(user.created_at).getTime() < WINDOW_MS;
  // Fail closed while the exemption check is still loading: a <24h-old
  // account is treated as limited until we've confirmed it's exempt, not
  // the other way around. Account age itself needs no async check (it's
  // derived straight from user.created_at), so this only affects genuinely
  // new accounts for the brief window before the exempt lookup resolves —
  // every other user is unaffected.
  const isLimited = isWithin24h && (!loaded || !exempt);

  return { isLimited, limitEur: cap ?? NEW_ACCOUNT_LIMIT_EUR };
}
