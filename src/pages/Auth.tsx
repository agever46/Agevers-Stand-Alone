import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Mail, Eye, EyeOff, ShieldCheck, Check, X } from "lucide-react";
import PhoneInputWithCountry from "@/components/PhoneInputWithCountry";
import logoImg from "@/assets/logo.png";
import mascotImg from "@/assets/agevers-mascot.png";
import { useAuth } from "@/hooks/useAuth";
import { useNoIndex } from "@/hooks/useNoIndex";
import { toast } from "sonner";
import { getDeviceFingerprint } from "@/lib/deviceFingerprint";
import { NEW_ACCOUNT_LIMIT_REFRESH_EVENT } from "@/hooks/useNewAccountLimit";
import { motion } from "framer-motion";
import AppealForm from "@/components/AppealForm";
import { ShieldAlert } from "lucide-react";

const TURNSTILE_SITE_KEY = "0x4AAAAAAC0o-III3Bkww0L5";
const IS_PRODUCTION = window.location.hostname === "agevers.com" || window.location.hostname === "www.agevers.com";
const SKIP_TURNSTILE = !IS_PRODUCTION;

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

const Auth = () => {
  useNoIndex();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirectReason = searchParams.get("reason");
  const initialMode = (location.state as any)?.mode;
  const [isLogin, setIsLogin] = useState(initialMode !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifyStep, setVerifyStep] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [checkingDevice, setCheckingDevice] = useState(false);
  const [emailVerifyStep, setEmailVerifyStep] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [passwordError, setPasswordError] = useState("");
  const [blockedStep, setBlockedStep] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string>("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [recoveryStep, setRecoveryStep] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "true") return true;
    // Detect Supabase recovery tokens in the URL hash (#access_token=...&type=recovery)
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    if (hashParams.get("type") === "recovery") return true;
    // Also handle the error case where the recovery link expired — still show the reset screen with a message
    if (hashParams.get("error_code") === "otp_expired" || hashParams.get("error") === "access_denied") {
      return false;
    }
    return false;
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  // Where to send the user once authenticated: honours ?redirect= and ?next=
  // (the OAuth consent screen uses the latter), falling back to the homepage.
  const postAuthTarget = () => {
    const params = new URLSearchParams(window.location.search);
    const dest = params.get("redirect") || params.get("next");
    return dest && dest.startsWith("/") && !dest.startsWith("//") && dest !== "/auth" ? dest : "/";
  };

  // Capture referral code from URL
  const [refCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("ref") || "";
  });

  // Dynamic product count (rounded down to nearest 500)
  const [productCount, setProductCount] = useState<number>(10000);
  useEffect(() => {
    supabase
      .from("allowed_products")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => {
        if (count !== null && count !== undefined) {
          setProductCount(Math.floor(count / 500) * 500);
        }
      });
  }, []);

  // Load Turnstile script once
  useEffect(() => {
    if (SKIP_TURNSTILE) { setTurnstileToken("bypass"); return; }
    if (document.getElementById("cf-turnstile-script")) return;
    const script = document.createElement("script");
    script.id = "cf-turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const renderTurnstile = useCallback(() => {
    if (!turnstileRef.current || !(window as any).turnstile) return;
    if (turnstileWidgetId.current) {
      try { (window as any).turnstile.remove(turnstileWidgetId.current); } catch {}
      turnstileWidgetId.current = null;
    }
    turnstileWidgetId.current = (window as any).turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(null),
      "error-callback": () => setTurnstileToken(null),
      theme: "light",
      size: "flexible",
    });
  }, []);

  useEffect(() => {
    if (verifyStep) return;
    const tryRender = () => {
      if ((window as any).turnstile) {
        renderTurnstile();
      }
    };
    (window as any).onTurnstileLoad = tryRender;
    tryRender();
    return () => {
      if (turnstileWidgetId.current) {
        try { (window as any).turnstile.remove(turnstileWidgetId.current); } catch {}
        turnstileWidgetId.current = null;
      }
    };
  }, [isLogin, verifyStep, renderTurnstile]);

  useEffect(() => {
    // If the user lands on /auth/callback (Supabase default) or /auth (OAuth redirect),
    // and they have a session, move them to the final destination.
    if (loading) return;
    
    const checkRedirect = async () => {
      // Small delay to allow useAuth to sync if we just landed from a handoff
      if (window.location.hash.includes("session-handoff=")) {
        await new Promise(r => setTimeout(r, 100));
      }

      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = user || session?.user;
      
      console.log("[Auth] Redirect check. User:", currentUser?.id, "Handoff present:", window.location.hash.includes("session-handoff="));

      if (currentUser && !verifyStep && !checkingDevice && !emailVerifyStep && !blockedStep && !recoveryStep) {
        console.log("[Auth] Active session found, navigating to home/redirect...");
        // Covers Google/Apple OAuth and any other path that lands back on
        // /auth with a session already established (e.g. trusted-device
        // login skips the OTP screen entirely) — the email/password OTP
        // flow below already covers itself separately.
        await runNewAccountPrecheck();
        const target = postAuthTarget();

        // If coming from checkout, preserve any state like 'reason' or other params if needed
        // but primarily we just want to go back to where we were.
        console.log("[Auth] Navigating to target:", target);
        navigate(target, { replace: true });
      }
    };
    
    checkRedirect();
  }, [user, loading, verifyStep, checkingDevice, emailVerifyStep, blockedStep, recoveryStep, navigate, location.hash, location.search]);

  // Listen for Supabase PASSWORD_RECOVERY event (fires when user lands from reset link)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryStep(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const verifyTurnstile = async (): Promise<boolean> => {
    if (SKIP_TURNSTILE) return true;
    if (!turnstileToken) {
      toast.error("Please complete the security check");
      return false;
    }
    try {
      const { data, error } = await supabase.functions.invoke("turnstile-verify", {
        body: { token: turnstileToken },
      });
      if (error || !data?.success) {
        toast.error("Security verification failed. Please try again.");
        setTurnstileToken(null);
        if (turnstileWidgetId.current && (window as any).turnstile) {
          (window as any).turnstile.reset(turnstileWidgetId.current);
        }
        return false;
      }
      return true;
    } catch {
      toast.error("Security check failed");
      return false;
    }
  };

  const requestEmailOtp = async (targetEmail: string, targetUserId?: string | null) => {
    const { error } = await supabase.functions.invoke("send-verification-email", {
      body: { email: targetEmail.trim().toLowerCase(), userId: targetUserId },
    });
    if (error) throw error;
  };

  // Best-effort: see if this brand-new account (email/password OR OAuth) can
  // be auto-cleared from the €20/24h new-account limit based on clean
  // IP/email signals. Fails silently and safely — the account just stays on
  // the default restricted path if this doesn't succeed. Awaited by callers
  // (rather than fire-and-forget) so the fraud_scores write is committed
  // before we navigate away, and the refresh event on completion catches
  // already-mounted consumers like the top-level yellow banner. Guarded so
  // it only ever fires once per page load, however many times a caller
  // triggers it.
  const precheckFiredRef = useRef(false);
  const runNewAccountPrecheck = async () => {
    if (precheckFiredRef.current) return;
    precheckFiredRef.current = true;
    try {
      await supabase.functions.invoke("fraud-check", { body: { action: "auto_precheck_new_account" } });
    } catch {
      // best-effort — account just stays on the default restricted path
    } finally {
      window.dispatchEvent(new Event(NEW_ACCOUNT_LIMIT_REFRESH_EVENT));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // For signup, the token is verified server-side by `secure-signup`.
      // Turnstile tokens are single-use, so we must NOT pre-verify here.
      if (isLogin) {
        const passed = await verifyTurnstile();
        if (!passed) { setSubmitting(false); return; }
      } else {
        if (!SKIP_TURNSTILE && !turnstileToken) {
          toast.error("Please complete the security check");
          setSubmitting(false);
          return;
        }
      }

      if (isLogin) {
        setCheckingDevice(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const authMsg = (error.message || "").toLowerCase();
          const needsEmailVerification = authMsg.includes("email not confirmed") || authMsg.includes("not confirmed") || authMsg.includes("not verified");
          if (needsEmailVerification) {
            setPendingEmail(email);
            setEmailVerifyStep(true);
            setCheckingDevice(false);
            await requestEmailOtp(email);
            setResendCooldown(120);
            toast.info("📧 Please verify your email to continue. We sent you a 6-digit code.");
            setSubmitting(false);
            return;
          }
          setCheckingDevice(false);
          throw error;
        }

        const userId = data.user?.id;
        if (!userId) { setCheckingDevice(false); throw new Error("Login failed"); }

        // Block check: if fraud_scores marks the user as blocked, halt login and show appeal screen
        const blockRes: any = await (supabase.rpc as any)("get_my_block_status");
        const blockRows = blockRes?.data;
        const blockRow = Array.isArray(blockRows) ? blockRows[0] : blockRows;
        console.log("[Auth] block check result:", { blockRows, blockRow, error: blockRes?.error });

        if (blockRow?.is_blocked) {
          setPendingUserId(userId);
          setPendingEmail(email);
          setBlockedReason(blockRow.reason || "Your account has been flagged for suspicious activity.");
          setBlockedStep(true);
          setCheckingDevice(false);
          setSubmitting(false);
          toast.error("Your account is blocked. Please submit an appeal below.");
          return;
        }

        // Check if email is verified — if not, show OTP screen instead of erroring out
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("email_verified")
          .eq("user_id", userId)
          .maybeSingle();

        if (profileRow && profileRow.email_verified === false) {
          setPendingUserId(userId);
          setPendingEmail(email);
          setEmailVerifyStep(true);
          setCheckingDevice(false);
          await requestEmailOtp(email, userId);
          setResendCooldown(120);
          toast.info("📧 Please verify your email to continue. We sent you a 6-digit code.");
          setSubmitting(false);
          return;
        }

        const fingerprint = getDeviceFingerprint();
        const { data: deviceData, error: deviceError } = await supabase.functions.invoke("device-verify", {
          body: {
            action: "check",
            userId,
            email,
            deviceFingerprint: fingerprint,
          },
        });

        if (deviceError && !deviceData) {
          // The device-check service is unreachable — don't lock the user out of
          // their own account over an infrastructure hiccup.
          console.error("[Auth] device-verify unavailable:", deviceError);
          setCheckingDevice(false);
          toast.success("Welcome back!");
        } else if (deviceData?.trusted) {
          setCheckingDevice(false);
          toast.success("Welcome back!");
        } else {
          setPendingUserId(userId);
          setPendingEmail(email);
          setVerifyStep(true);
          await supabase.auth.signOut();
          setCheckingDevice(false);
          toast.info("📧 Verification code sent to your email");
        }
      } else {
        setPasswordError("");

        // Client-side password validation
        if (!firstName.trim() || !lastName.trim()) {
          toast.error("Please enter your first and last name");
          setSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          setSubmitting(false);
          return;
        }
        if (password.length < 8 || password.length > 20) {
          setPasswordError("Password must be 8–20 characters");
          setSubmitting(false);
          return;
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
          setPasswordError("Password must include uppercase, lowercase, and a special character");
          setSubmitting(false);
          return;
        }

        // Server-side signup: validates Turnstile on the backend and blocks
        // disposable email providers. This prevents bots from bypassing the
        // frontend CAPTCHA by calling /auth/v1/signup directly.
        const { data: secureData, error: secureErr } = await supabase.functions.invoke("secure-signup", {
          body: {
            email,
            password,
            turnstileToken,
            metadata: {
              phone: phone.trim() || undefined,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              full_name: `${firstName.trim()} ${lastName.trim()}`,
              username: `${firstName.trim()} ${lastName.trim()}`,
            },
          },
        });
        if (secureErr || !secureData?.userId) {
          const code = (secureData as any)?.error;
          const message = (secureData as any)?.message;
          if (code === "email_taken") {
            throw new Error("This email is already registered. Try signing in instead.");
          }
          if (code === "disposable_email") {
            throw new Error(message || "Please use a permanent email address.");
          }
          if (code === "captcha_failed" || code === "captcha_required") {
            throw new Error("Security check failed. Please refresh and try again.");
          }
          if (code === "maintenance") {
            throw new Error("Signups are temporarily disabled.");
          }
          throw new Error(message || secureErr?.message || "Signup failed");
        }

        const signUpData = { user: { id: secureData.userId, email } } as any;

        // Send verification email. Admin new-signup notification (email +
        // Telegram) is sent by a database trigger on profile creation —
        // it fires reliably even if this client call never runs, and also
        // covers Google/Apple sign-ups that skip this code path entirely.
        // Do not also invoke notify-admin-signup here, or the admin gets
        // duplicate emails/Telegram pings for a single signup.
        if (signUpData.user) {
          await requestEmailOtp(email, signUpData.user.id);
          // Save referral code to profile if present
          if (refCode) {
            // Direct profile updates of referred_by_code are blocked by RLS
            // (sensitive column). Use the SECURITY DEFINER RPC, which sets it
            // once on a freshly created account only.
            (supabase.rpc as any)("attach_referral_code", {
              _user_id: signUpData.user.id,
              _code: refCode,
            }).then(({ error }: any) => {
              if (error) console.error("attach_referral_code failed", error);
            });
            // Award 3 giveaway entries to the referrer for the active giveaway
            (async () => {
              try {
                const { data: rc } = await supabase
                  .from("referral_codes")
                  .select("user_id")
                  .eq("code", refCode)
                  .maybeSingle();
                if (rc?.user_id && signUpData.user) {
                  await (supabase.rpc as any)("award_referral_giveaway_entries", {
                    _referrer_id: rc.user_id,
                    _referred_user_id: signUpData.user.id,
                    _entries: 3,
                  });
                }
              } catch (_) { /* best-effort */ }
            })();
          }
        }

        // Move to OTP screen immediately so the user enters the code from email
        if (signUpData.user) {
          setPendingUserId(signUpData.user.id);
          setPendingEmail(email);
          setEmailVerifyStep(true);
          setResendCooldown(120);
          toast.success("Account created! Check your email for a 6-digit code.", { duration: 8000 });
        } else {
          toast.success("Welcome! Please verify your email to unlock purchases.", { duration: 8000 });
          navigate(postAuthTarget());
        }
      }
    } catch (err: any) {
      const msg = err.message || "An error occurred";
      const isPasswordError = /password/i.test(msg) || /weak/i.test(msg) || /short/i.test(msg) || /character/i.test(msg) || /hibp/i.test(msg) || /breached/i.test(msg) || /pwned/i.test(msg);
      if (isPasswordError && !isLogin) {
        setPasswordError(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!pendingUserId || !verifyCode) return;
    setSubmitting(true);
    try {
      const fingerprint = getDeviceFingerprint();
      const { data, error } = await supabase.functions.invoke("device-verify", {
        body: {
          action: "verify",
          userId: pendingUserId,
          code: verifyCode.trim(),
          deviceFingerprint: fingerprint,
        },
      });

      if (error || !data?.verified) {
        toast.error(data?.error || "Invalid or expired code");
        setSubmitting(false);
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: pendingEmail!,
        password,
      });

      if (loginError) throw loginError;

      toast.success("Device verified! Welcome back!");
      setVerifyStep(false);
      setPendingUserId(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth${window.location.search}` },
    });
    if (error) {
      toast.error(`Google sign-in failed: ${error.message}`);
    }
  };





  // Account blocked screen — shown after login when fraud_scores.is_blocked = true
  if (blockedStep) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-2xl glass rounded-2xl p-8 space-y-6 border border-red-500/30">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
              <ShieldAlert className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black tracking-wider text-foreground">
                Account Blocked
              </h1>
              <p className="text-sm text-muted-foreground">
                Your account has been restricted from making purchases.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-xs font-display font-bold tracking-wider uppercase text-red-300 mb-1">
              Reason
            </p>
            <p className="text-sm text-foreground">{blockedReason}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            If you believe this is a mistake, please submit an appeal below and our team will review your account.
          </p>
          <AppealForm
            blockedReason={blockedReason}
            isNewAccountLimit={false}
            userEmail={pendingEmail || undefined}
            userId={pendingUserId || undefined}
          />
          <div className="flex justify-end pt-2 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                setBlockedStep(false);
                setBlockedReason("");
                setPendingUserId(null);
                setPendingEmail(null);
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Email verification (OTP) screen — shown after signup or when login attempted with unverified email
  if (emailVerifyStep) {
    const handleVerifyEmailOtp = async () => {
      if (emailOtpCode.length !== 6) return;
      setSubmitting(true);
      try {
        const { data, error } = await supabase.functions.invoke("verify-email-otp", {
          body: { email: pendingEmail, code: emailOtpCode.trim() },
        });
        if (error || !data?.success) {
          toast.error(data?.error || "Invalid or expired code");
          setSubmitting(false);
          return;
        }
        toast.success("✅ Email verified! Welcome to Agever's");
        setEmailVerifyStep(false);
        setEmailOtpCode("");
        // If user is already signed in, navigate home; otherwise sign them in
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session && pendingEmail && password) {
          await supabase.auth.signInWithPassword({ email: pendingEmail, password });
        }
        await runNewAccountPrecheck();
        navigate(postAuthTarget());
      } catch (err: any) {
        toast.error(err.message || "Verification failed");
      } finally {
        setSubmitting(false);
      }
    };

    const handleResendOtp = async () => {
      if (resendCooldown > 0) return;
      try {
        await requestEmailOtp(pendingEmail || email, pendingUserId);
        toast.success("📧 New code sent to your email");
        setResendCooldown(120);
      } catch {
        toast.error("Please wait before requesting another code");
      }
    };

    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-8">
            <a href="/" className="cursor-pointer">
              <img src={logoImg} alt="Agever's" className="h-32 object-contain" />
            </a>
          </div>
          <div className="rounded-xl p-8 text-center bg-white border border-slate-200 shadow-lg text-slate-900">
            <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="font-display text-xl font-bold mb-2">Verify Your Email</h1>
            <p className="text-sm text-slate-600 mb-6">
              We sent a 6-digit code to <strong className="text-slate-900">{pendingEmail}</strong>. Enter it below to verify your email and unlock your account.
            </p>

            <input
              type="text"
              maxLength={6}
              inputMode="numeric"
              value={emailOtpCode}
              onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ""))}
              className="w-full h-14 text-center text-2xl font-display font-bold tracking-[0.5em] rounded-md bg-white border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              placeholder="000000"
              autoFocus
            />

            <Button
              variant="hero"
              className="w-full mb-3"
              disabled={submitting || emailOtpCode.length !== 6}
              onClick={handleVerifyEmailOtp}
            >
              {submitting ? "Verifying..." : "Verify Email"}
            </Button>

            <button
              onClick={handleResendOtp}
              disabled={resendCooldown > 0}
              className="text-sm text-primary hover:underline font-semibold disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed block w-full mb-3"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "📨 Resend code"}
            </button>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setEmailVerifyStep(false);
                setEmailOtpCode("");
                setPendingEmail(null);
                setPendingUserId(null);
              }}
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (verifyStep) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-8">
            <a href="/" className="cursor-pointer">
              <img src={logoImg} alt="Agever's" className="h-32 object-contain" />
            </a>
          </div>
          <div className="glass rounded-xl p-8 text-center">
            <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="font-display text-xl font-bold text-foreground mb-2">Device Verification</h1>
            <p className="text-sm text-muted-foreground mb-6">
              We sent a 6-digit code to <strong className="text-foreground">{pendingEmail}</strong>. Enter it below to verify this device.
            </p>

            <input
              type="text"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              className="w-full h-14 text-center text-2xl font-display font-bold tracking-[0.5em] rounded-md bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              placeholder="000000"
              autoFocus
            />

            <Button
              variant="hero"
              className="w-full mb-3"
              disabled={submitting || verifyCode.length !== 6}
              onClick={handleVerifyCode}
            >
              {submitting ? "Verifying..." : "Verify Device"}
            </Button>

            <button
              onClick={() => {
                setVerifyStep(false);
                setPendingUserId(null);
                setVerifyCode("");
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allPasswordReqsMet =
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[^A-Za-z0-9]/.test(password) &&
    password.length >= 8 &&
    password.length <= 20;

  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  if (recoveryStep) {
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
      if (error) { toast.error(error.message); return; }
      toast.success("Password updated. Please sign in with your new password.");
      await supabase.auth.signOut();
      setRecoveryStep(false);
      setNewPassword("");
      setConfirmNewPassword("");
      window.history.replaceState(null, "", "/auth");
      navigate("/auth", { replace: true });
    };

    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-8">
            <a href="/" className="cursor-pointer">
              <img src={logoImg} alt="Agever's" className="h-24 object-contain" />
            </a>
          </div>
          <div className="rounded-xl p-8 bg-white border border-slate-200">
            <h1 className="font-display text-xl font-bold text-center mb-2 text-slate-900">Set a New Password</h1>
            <p className="text-sm text-slate-600 text-center mb-6">Choose a new password for your account.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-body text-slate-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-10 pl-3 pr-10 rounded-md bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary"
                    maxLength={20}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordRequirements password={newPassword} />
              </div>

              <div>
                <label className="block text-sm font-body text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary"
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

              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setRecoveryStep(false);
                  window.history.replaceState(null, "", "/auth");
                  navigate("/auth", { replace: true });
                }}
                className="w-full text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* LEFT: Form panel */}
      <div className="auth-light-panel w-full lg:w-[480px] xl:w-[560px] flex items-center justify-center px-4 py-8 bg-white text-slate-900 relative z-10 [&_.text-muted-foreground]:!text-slate-900 [&_.text-foreground]:!text-slate-900 [&_.bg-secondary]:!bg-white [&_.border-border]:!border-slate-300 [&_.bg-border]:!bg-slate-300">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-8">
            <a href="/" className="cursor-pointer">
              <img src={logoImg} alt="Agever's" className="h-24 object-contain bg-white rounded-2xl px-6 py-3" />
            </a>
          </div>

        <div className="rounded-xl p-8 bg-white">
          {redirectReason === "checkout_required" && (
            <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm font-medium flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <p>Please sign in or create an account to complete your purchase. An account is required to access your digital keys after payment.</p>
            </div>
          )}
          <h1 className="font-display text-xl font-bold text-center mb-6">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label htmlFor="signup-first-name" className="block text-sm font-body mb-1">First Name <span className="text-destructive">*</span></label>
                    <input
                      id="signup-first-name"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      maxLength={40}
                      autoComplete="given-name"
                      className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-last-name" className="block text-sm font-body mb-1">Last Name <span className="text-destructive">*</span></label>
                    <input
                      id="signup-last-name"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      maxLength={40}
                      autoComplete="family-name"
                      className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <label className="block text-sm font-body mb-1">Phone Number <span className="text-destructive">*</span></label>
                <PhoneInputWithCountry
                  value={phone}
                  onChange={setPhone}
                  required={!isLogin}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-body text-muted-foreground mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 pl-10 pr-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder=""
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-body text-muted-foreground mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
                  className={`w-full h-10 pl-3 pr-10 rounded-md bg-secondary border text-sm text-foreground placeholder:text-muted-foreground font-body focus:outline-none focus:ring-1 ${passwordError ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"}`}
                  placeholder=""
                  maxLength={20}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-destructive font-semibold mt-1">{passwordError}</p>
              )}
              {isLogin && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!email) { toast.error("Please enter your email first"); return; }
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    if (error) toast.error(error.message);
                    else toast.success("If this email is registered, we'll send you a reset link.");
                  }}
                  className="text-sm text-destructive hover:underline font-semibold mt-1"
                >
                  Forgot password?
                </button>
              )}
            </div>

            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-body text-muted-foreground mb-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full h-10 pl-3 pr-10 rounded-md bg-secondary border text-sm text-foreground placeholder:text-muted-foreground font-body focus:outline-none focus:ring-1 appearance-none ${confirmPassword && !passwordsMatch ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"}`}
                      placeholder=""
                      maxLength={20}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-xs text-destructive font-semibold mt-1">Passwords do not match</p>
                  )}
                </div>

                <PasswordRequirements password={password} />
              </>
            )}

            {!isLogin && (
              <div className="flex items-start gap-2">
                <input id="signup-consent" type="checkbox" required aria-required="true" className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                <label htmlFor="signup-consent" className="text-xs text-muted-foreground">
                  I agree to the{" "}
                  <a href="/terms-of-service" className="text-primary hover:underline" target="_blank">Terms of Service</a>{" "}
                  and{" "}
                  <a href="/privacy-policy" className="text-primary hover:underline" target="_blank">Privacy Policy</a>.{" "}
                  <span className="text-destructive">*</span>
                </label>
              </div>
            )}

            {!isLogin && (
              <div className="rounded-xl border-2 border-yellow-500 bg-yellow-500/10 p-3">
                <p className="text-xs md:text-sm text-foreground font-semibold leading-relaxed">
                  ⚠️ Planning to pay with PayPal? Use the <span className="underline">same email, phone, full name and country</span> as on your PayPal account. Mismatched details trigger a manual security review and delay delivery of your code.
                </p>
              </div>
            )}

            <div ref={turnstileRef} className="flex justify-center" />

            <Button
              type="submit"
              variant="hero"
              className="w-full"
              disabled={submitting || !turnstileToken || (!isLogin && (!allPasswordReqsMet || !passwordsMatch))}
            >
              {submitting ? "Loading..." : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-body">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="space-y-3">
            <Button variant="outline" className="w-full gap-2 !bg-white !text-slate-900 !border-slate-300 hover:!bg-slate-50 hover:!text-slate-900 hover:!border-slate-400" onClick={handleGoogleSignIn}>
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>
          </div>


          <p className="text-center text-base text-muted-foreground font-body mt-6">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-500 hover:underline font-bold text-lg"
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
        </div>
      </div>

      {/* RIGHT: Animated neon panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-[hsl(240,40%,8%)] via-[hsl(270,50%,12%)] to-[hsl(220,45%,10%)]">
        {/* Animated neon orbs */}
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(280, 100%, 60%) 0%, transparent 70%)" }}
          animate={{ x: [0, 100, -50, 0], y: [0, -80, 60, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-0 top-1/3 w-[400px] h-[400px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(190, 100%, 55%) 0%, transparent 70%)" }}
          animate={{ x: [0, -120, 80, 0], y: [0, 100, -70, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-10 left-1/4 w-[350px] h-[350px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(330, 100%, 60%) 0%, transparent 70%)" }}
          animate={{ x: [0, 80, -60, 0], y: [0, -100, 50, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Floating neon rings */}
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border-2"
            style={{
              width: `${200 + i * 80}px`,
              height: `${200 + i * 80}px`,
              left: `${20 + i * 10}%`,
              top: `${15 + i * 15}%`,
              borderColor: ["hsl(280, 100%, 65%)", "hsl(190, 100%, 60%)", "hsl(330, 100%, 65%)", "hsl(150, 100%, 55%)"][i],
              opacity: 0.15,
            }}
            animate={{ rotate: 360, scale: [1, 1.1, 1] }}
            transition={{ rotate: { duration: 30 + i * 10, repeat: Infinity, ease: "linear" }, scale: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
          />
        ))}

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col justify-center items-start px-16 py-12 w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Agevers Mascot */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.9, type: "spring", bounce: 0.5 }}
              className="mb-6 -ml-4"
            >
              <motion.img
                src={mascotImg}
                alt="Agevers mascot - friendly gamer robot"
                width={180}
                height={180}
                loading="lazy"
                className="w-44 h-44 xl:w-52 xl:h-52 object-contain drop-shadow-[0_0_30px_hsl(280,100%,65%,0.5)]"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
            <h2 className="font-display text-5xl xl:text-6xl font-black text-white leading-tight mb-6 tracking-tight">
              Level Up
              <br />
              <span className="bg-gradient-to-r from-[hsl(280,100%,75%)] via-[hsl(330,100%,70%)] to-[hsl(190,100%,65%)] bg-clip-text text-transparent">
                Your Game
              </span>
            </h2>
            <p className="text-lg text-white/70 font-body max-w-md mb-10 leading-relaxed">
              Instant digital codes for Steam, PlayStation, Xbox, Nintendo & more. Trusted by gamers worldwide.
            </p>

            <div className="space-y-4">
              {[
                { icon: "⚡", text: "Instant delivery" },
                { icon: "🔒", text: "Secure transactions" },
                { icon: "🎮", text: `${productCount.toLocaleString()}+ games & top-ups` },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="text-white/90 font-display tracking-wide">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
