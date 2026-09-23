// Post-payment verification gate.
// Shown on the OrderConfirmation page BEFORE digital codes are revealed.
// Combines email verification reminder + SMS OTP verification.
// Once verified (in-memory for this session), the gate calls onVerified() and unmounts.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Smartphone, Loader2, Mail, CheckCircle2 } from "lucide-react";
import PhoneInputWithCountry from "@/components/PhoneInputWithCountry";
import { toast } from "sonner";

interface Props {
  orderId: string; // paypal order id, used as a session cache key
  onVerified: () => void | Promise<void>;
}

const sessionKeyFor = (orderId: string) => `agevers_order_verified_${orderId}`;

const PostPurchaseVerifyGate = ({ orderId, onVerified }: Props) => {
  const { user } = useAuth();
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [otpStep, setOtpStep] = useState<"idle" | "sending" | "input" | "verifying">("idle");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendingEmail, setResendingEmail] = useState(false);
  const [submittingPhone, setSubmittingPhone] = useState(false);
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [smsFailed, setSmsFailed] = useState(false);
  const [emailFallbackVisible, setEmailFallbackVisible] = useState(false);

  // Already verified in this session? skip.
  useEffect(() => {
    if (sessionStorage.getItem(sessionKeyFor(orderId)) === "1") {
      onVerified();
    }
  }, [orderId, onVerified]);

  // Check email verification status.
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("email_verified")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setEmailVerified(data?.email_verified ?? false));
  }, [user]);

  const sendOtp = async (viaEmail = false) => {
    setOtpStep("sending");
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("purchase-otp", {
        body: { action: "send", channel: viaEmail ? "email" : "sms" },
      });
      if (fnError || !data?.sent) {
        // If the error indicates missing phone, we should show a prompt to add it right here
        if (data?.error?.includes("No phone number is linked")) {
          setError("missing_phone");
        } else {
          setError(data?.error || "Failed to send verification code");
        }
        
        if (!viaEmail) {
          // SMS delivery failed — only now expose the email fallback.
          setSmsFailed(true);
          setEmailFallbackVisible(true);
        }
        setOtpStep("idle");
        return;
      }
      setChannel(data.channel === "email" ? "email" : "sms");
      setMaskedPhone(data.maskedPhone || "");
      setOtpStep("input");
      if (data.channel !== "email") {
        // SMS went out — reveal the email fallback only if the code never arrives.
        setEmailFallbackVisible(false);
        setTimeout(() => setEmailFallbackVisible(true), 60000);
      }
      toast.success(data.channel === "email" ? "Email sent — valid for 10 minutes" : "SMS sent — valid for 10 minutes", {
        description: `Code sent to ${data.maskedPhone || (data.channel === "email" ? "your email" : "your phone")}. Check your inbox/messages (including spam).`,
      });
    } catch {
      setError("Failed to send verification code");
      if (!viaEmail) {
        setSmsFailed(true);
        setEmailFallbackVisible(true);
      }
      setOtpStep("idle");
    }
  };

  const verifyOtp = async () => {
    if (code.length !== 6) return;
    setOtpStep("verifying");
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("purchase-otp", {
        body: { action: "verify", code: code.trim() },
      });
      if (fnError || !data?.verified) {
        setError(data?.error || "Invalid or expired code");
        setOtpStep("input");
        return;
      }
      sessionStorage.setItem(sessionKeyFor(orderId), "1");
      toast.success("Identity verified — your code is unlocked!");
      onVerified();
    } catch {
      setError("Verification failed. Please try again.");
      setOtpStep("input");
    }
  };

  const resendVerificationEmail = async () => {
    if (!user?.email) return;
    setResendingEmail(true);
    try {
      await supabase.functions.invoke("send-verification-email", {
        body: { email: user.email },
      });
      toast.success("Verification email sent! Check your inbox.");
    } catch {
      toast.error("Failed to send verification email");
    } finally {
      setResendingEmail(false);
    }
  };

  const emailOk = emailVerified === true;

  return (
    <div className="glass rounded-xl p-4 sm:p-5 space-y-4 border border-primary/30">
      {/* Compact header — keeps the SMS button above the fold */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 shrink-0 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-base sm:text-lg font-bold tracking-wider text-foreground leading-tight">
            Verify to reveal your code 🎉
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            One quick SMS check and you're in.
          </p>
        </div>
      </div>

      {/* SMS step — shown FIRST so the action button is immediately visible */}
      <div className="rounded-lg p-4 border border-primary/40 bg-primary/5">
        <div className="flex items-start gap-3 mb-3">
          <Smartphone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-display font-bold text-foreground text-sm">SMS Verification</p>
            <p className="text-xs text-muted-foreground mt-1">
              {otpStep === "input" || otpStep === "verifying"
                ? `We sent a 6-digit code to ${maskedPhone || "your phone"}. Valid for 10 minutes — check your SMS inbox (and spam folder).`
                : "We'll send a one-time code to the phone number on your account."}
            </p>
          </div>
        </div>

        {otpStep === "idle" && error !== "missing_phone" && (
          <Button variant="hero" className="w-full" onClick={() => sendOtp(false)}>
            Send SMS Code
          </Button>
        )}

        {otpStep === "idle" && error === "missing_phone" && (
          <div className="space-y-3">
            <p className="text-xs text-destructive text-center font-medium bg-destructive/10 p-2 rounded border border-destructive/20">
              No phone number linked to your account.
            </p>
            <div className="space-y-3">
              <PhoneInputWithCountry
                value={code} // Re-using code state temporarily for phone input
                onChange={setCode}
                autoFocus
              />
              <Button 
                variant="hero" 
                className="w-full" 
                disabled={submittingPhone}
                onClick={async () => {
                  if (!code.trim().startsWith('+')) {
                    toast.error("Phone must start with + and country code");
                    return;
                  }
                  setSubmittingPhone(true);
                  const { error: upError } = await supabase
                    .from("profiles")
                    .update({ phone: code.trim() })
                    .eq("user_id", user?.id);
                  
                  if (upError) {
                    toast.error("Failed to update phone");
                  } else {
                    toast.success("Phone updated!");
                    setError("");
                    setCode(""); // clear for OTP
                    sendOtp(false);
                  }
                  setSubmittingPhone(false);
                }}
              >
                {submittingPhone ? "Saving..." : "Save Phone & Send SMS"}
              </Button>
            </div>
          </div>
        )}

        {otpStep === "idle" && emailFallbackVisible && (
          <button
            onClick={() => sendOtp(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center mt-2 underline"
          >
            {smsFailed
              ? "SMS couldn't be delivered — send the code to my email instead"
              : "Still no SMS? Send the code to my email instead"}
          </button>
        )}

        {otpStep === "sending" && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {(otpStep === "input" || otpStep === "verifying") && (
          <div className="space-y-3">
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full h-14 text-center text-2xl font-display font-bold tracking-[0.5em] rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="000000"
              autoFocus
              disabled={otpStep === "verifying"}
            />
            <Button
              variant="hero"
              className="w-full"
              disabled={code.length !== 6 || otpStep === "verifying"}
              onClick={verifyOtp}
            >
              {otpStep === "verifying" ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Verifying...</>
              ) : (
                "Verify & Unlock Code"
              )}
            </Button>
            <button
              onClick={() => sendOtp(channel === "email")}
              disabled={otpStep === "verifying"}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
            >
              Didn't receive a code? Resend
            </button>
            {(channel === "email" || emailFallbackVisible) && (
              <button
                onClick={() => sendOtp(channel !== "email")}
                disabled={otpStep === "verifying"}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center underline"
              >
                {channel === "email" ? "Send by SMS instead" : "Still no SMS? Send the code to my email instead"}
              </button>
            )}
          </div>
        )}

        {error && error !== "missing_phone" && <p className="text-xs text-destructive mt-2 text-center">{error}</p>}
        <p className="text-[11px] text-muted-foreground/80 mt-3 text-center">
          You can leave this page anytime — return to your code from <span className="text-foreground">My Account → Orders</span> and click your order.
        </p>
      </div>

      {/* Email step — shown BELOW so the SMS CTA stays above the fold */}
      <div className={`rounded-lg p-4 border ${emailOk ? "bg-primary/5 border-primary/30" : "bg-yellow-500/10 border-yellow-500/30"}`}>
        <div className="flex items-start gap-3">
          {emailOk ? (
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          ) : (
            <Mail className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-display font-bold text-foreground text-sm">
              {emailOk ? "Email verified" : "Confirm your email (within 3 days)"}
            </p>
            {!emailOk && (
              <>
                <p className="text-xs text-muted-foreground mt-1">
                  We need to confirm <span className="text-foreground">{user?.email}</span> to send your receipt and protect against fraud.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={resendingEmail}
                  onClick={resendVerificationEmail}
                >
                  {resendingEmail ? <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Sending...</> : "Send verification email"}
                </Button>
                <p className="text-[11px] text-muted-foreground/80 mt-2">
                  After clicking the link, refresh this page. You can still complete SMS verification above.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostPurchaseVerifyGate;
