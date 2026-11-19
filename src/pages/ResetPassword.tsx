import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Check, Eye, EyeOff, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNoIndex } from "@/hooks/useNoIndex";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logoImg from "@/assets/logo.png";

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 4500): Promise<T> => {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("Password reset session timed out")), timeoutMs);
    }),
  ]);
};

const getHashParams = () => {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(hash);
};

const PasswordRequirements = ({ password }: { password: string }) => {
  const requirements = [
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One special character", met: /[^A-Za-z0-9]/.test(password) },
    { label: "8–20 characters", met: password.length >= 8 && password.length <= 20 },
  ];

  return (
    <ul className="mt-2 space-y-1">
      {requirements.map((r) => (
        <li key={r.label} className="flex items-center gap-1.5 text-xs">
          {r.met ? (
            <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <span className={r.met ? "text-green-500" : "text-muted-foreground"}>{r.label}</span>
        </li>
      ))}
    </ul>
  );
};

const ResetPassword = () => {
  useNoIndex();
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const hasRecoveryMarker = useMemo(() => {
    const hashParams = getHashParams();
    const searchParams = new URLSearchParams(window.location.search);
    return hashParams.get("type") === "recovery" || searchParams.get("reset") === "true";
  }, []);

  useEffect(() => {
    let active = true;
    // Tracks whether a recovery session has already been confirmed by either
    // signal below, so neither one can clobber success with a stale error.
    const recoveredRef = { current: false };
    const hashParams = getHashParams();
    const errorDescription = hashParams.get("error_description")?.replace(/\+/g, " ");
    const errorCode = hashParams.get("error_code");
    const error = hashParams.get("error");

    if (errorCode === "otp_expired") {
      setLinkError("This password reset link has expired. Please request a new reset email from your own account.");
      setAuthReady(true);
      return;
    }

    if (error || errorDescription) {
      setLinkError(errorDescription || "This password reset link is no longer valid. Please request a new reset email.");
      setAuthReady(true);
      return;
    }

    const markRecovered = () => {
      recoveredRef.current = true;
      setLinkError(null);
      setHasRecoverySession(true);
      setAuthReady(true);
    };

    const timeout = window.setTimeout(() => {
      if (!active || recoveredRef.current) return;
      setAuthReady(true);
      setLinkError("We could not verify this password reset link. Please request a new reset email from your own account.");
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        window.clearTimeout(timeout);
        markRecovered();
      }
    });

    withTimeout(supabase.auth.getSession())
      .then(({ data: { session } }) => {
        if (!active || recoveredRef.current) return;
        if (getHashParams().get("type") === "recovery" && session) {
          window.clearTimeout(timeout);
          markRecovered();
        } else if (!hasRecoveryMarker) {
          // No recovery token in the URL at all — nothing worth waiting for.
          window.clearTimeout(timeout);
          setLinkError("Open the password reset link from the email, or request a new reset link.");
          setAuthReady(true);
        }
        // Otherwise a recovery marker is present but the session from the
        // hash hasn't landed yet — let the PASSWORD_RECOVERY event (or the
        // timeout above) decide, instead of racing ahead with an error.
      })
      .catch(() => {
        if (!active || recoveredRef.current) return;
        if (!hasRecoveryMarker) {
          window.clearTimeout(timeout);
          setLinkError("We could not verify this password reset link. Please request a new reset email.");
          setAuthReady(true);
        }
      });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [hasRecoveryMarker]);

  const reqsMet =
    /[A-Z]/.test(newPassword) &&
    /[a-z]/.test(newPassword) &&
    /[^A-Za-z0-9]/.test(newPassword) &&
    newPassword.length >= 8 &&
    newPassword.length <= 20;
  const matches = newPassword === confirmNewPassword && confirmNewPassword.length > 0;

  const handleUpdatePassword = async () => {
    if (!reqsMet) { toast.error("Password does not meet requirements"); return; }
    if (!matches) { toast.error("Passwords do not match"); return; }
    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);
    if (error) {
      setLinkError(error.message || "This reset link is no longer valid. Please request a new one.");
      return;
    }
    toast.success("Password updated. Please sign in with your new password.");
    await supabase.auth.signOut();
    window.history.replaceState(null, "", "/auth");
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Link to="/" className="cursor-pointer">
            <img src={logoImg} alt="Agever's" className="h-24 object-contain bg-card rounded-2xl px-6 py-3" />
          </Link>
        </div>

        <div className="rounded-xl p-8 bg-card border border-border shadow-lg">
          {!authReady ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-primary mx-auto mb-4" />
              <h1 className="font-display text-xl font-bold mb-2">Checking reset link</h1>
              <p className="text-sm text-muted-foreground">Please wait while we verify the password reset session.</p>
            </div>
          ) : linkError || !hasRecoverySession ? (
            <div className="text-center py-4">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h1 className="font-display text-xl font-bold mb-2">Reset link unavailable</h1>
              <p className="text-sm text-muted-foreground mb-6">{linkError || "This password reset link is invalid or expired."}</p>
              <Button variant="hero" className="w-full" onClick={() => navigate("/auth", { replace: true })}>
                Request a New Link
              </Button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-xl font-bold text-center mb-2">Set a New Password</h1>
              <p className="text-sm text-muted-foreground text-center mb-6">Choose a new password for your account.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-body text-muted-foreground mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-10 pl-3 pr-10 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      maxLength={20}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <PasswordRequirements password={newPassword} />
                </div>

                <div>
                  <label className="block text-sm font-body text-muted-foreground mb-1">Confirm New Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    maxLength={20}
                  />
                  {confirmNewPassword.length > 0 && !matches && (
                    <p className="text-xs text-destructive font-semibold mt-1">Passwords do not match</p>
                  )}
                </div>

                <Button
                  variant="hero"
                  className="w-full"
                  disabled={updatingPassword || !reqsMet || !matches}
                  onClick={handleUpdatePassword}
                >
                  {updatingPassword ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;