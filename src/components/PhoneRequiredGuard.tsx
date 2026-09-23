import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import PhoneInputWithCountry from "@/components/PhoneInputWithCountry";

const PUBLIC_PATHS = [
  "/auth",
  "/reset-password",
  "/terms-of-service",
  "/privacy-policy",
  "/refund-policy",
  "/faq",
  "/contact",
  "/help-center",
  "/about",
];

const PhoneRequiredGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [phone, setPhone] = useState("");
  const [profilePhone, setProfilePhone] = useState<string | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + "/")
  );

  // Check if user signed up via OAuth (Google/Apple) — only those need the phone prompt
  const isOAuthUser = user?.app_metadata?.provider !== "email";
  
  // Also check session storage to see if we've already prompted in this session
  // This ensures the screen doesn't keep appearing if the user tries to navigate away
  const [sessionPromptSkipped, setSessionPromptSkipped] = useState(() => {
    return sessionStorage.getItem(`phone_prompt_skipped_${user?.id}`) === 'true';
  });

  // Fetch profile phone when user is available
  useEffect(() => {
    if (!user) {
      setProfilePhone(undefined);
      return;
    }

    // Skip check entirely for email signups — they already provided phone during registration
    if (!isOAuthUser) {
      setProfilePhone("skip");
      return;
    }

    let cancelled = false;
    setCheckingProfile(true);

    const fetchPhone = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setProfilePhone(data?.phone || null);
        setCheckingProfile(false);
      }
    };

    fetchPhone();
    return () => { cancelled = true; };
  }, [user?.id, isOAuthUser]);

  // No user — render children (public pages, not logged in)
  if (!user) return <>{children}</>;

  // User exists but profile phone status not yet determined — show spinner to prevent flash
  if (profilePhone === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Handle specific routes where we want to skip the phone prompt (like Checkout which has its own verification)
  const isCheckoutPath = location.pathname === "/checkout";

  if (!user || isPublicPath || isCheckoutPath || sessionPromptSkipped) return <>{children}</>;

  // Phone already set or email signup (already provided phone)
  if (profilePhone && profilePhone !== "null") return <>{children}</>;

  // profilePhone is null — OAuth user needs to add phone
  const handleSubmitPhone = async () => {
    const trimmed = phone.trim().replace(/[\s\-()]/g, "");
    if (!trimmed) {
      toast.error("Please enter your phone number");
      return;
    }

    if (!/^\+\d{7,15}$/.test(trimmed)) {
      toast.error("Phone must start with + and country code (e.g. +972501234567)");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone: trimmed })
        .eq("user_id", user.id);

      if (error) throw error;

      setProfilePhone(trimmed);
      toast.success("Phone number saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save phone number");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="glass rounded-xl p-8">
          <Phone className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            Phone Number Required
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            Please add your mobile phone number to complete your registration.
            This is required for account security and purchase verification.
          </p>

          <div className="space-y-4">
            <PhoneInputWithCountry
              value={phone}
              onChange={setPhone}
              autoFocus
            />
            <div className="flex flex-col gap-2">
              <Button
                variant="hero"
                className="w-full"
                disabled={submitting || !phone.trim()}
                onClick={handleSubmitPhone}
              >
                {submitting ? "Saving..." : "Save & Continue"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground hover:text-foreground"
                onClick={() => {
                  if (user?.id) {
                    sessionStorage.setItem(`phone_prompt_skipped_${user.id}`, 'true');
                    setSessionPromptSkipped(true);
                  }
                }}
              >
                Skip (I'll add it at checkout)
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneRequiredGuard;
