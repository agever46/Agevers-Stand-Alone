import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface PurchaseOtpModalProps {
  open: boolean;
  onVerified: () => void;
  onCancel: () => void;
}

const PurchaseOtpModal = ({ open, onVerified, onCancel }: PurchaseOtpModalProps) => {
  const [step, setStep] = useState<"sending" | "input" | "verifying">("sending");
  const [code, setCode] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [error, setError] = useState("");
  const { user } = useAuth();

  // Send OTP via SMS
  const sendOtp = async () => {
    setStep("sending");
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("purchase-otp", {
        body: { action: "send" },
      });
      if (fnError || !data?.sent) {
        setError(data?.error || "Failed to send verification code");
        setStep("input");
        return;
      }
      setMaskedPhone(data.maskedPhone || "");
      setStep("input");
    } catch {
      setError("Failed to send verification code");
      setStep("input");
    }
  };

  // Auto-send on open
  useEffect(() => {
    if (open) {
      setCode("");
      setError("");
      sendOtp();
    }
  }, [open]);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    setStep("verifying");
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("purchase-otp", {
        body: { action: "verify", code: code.trim() },
      });
      if (fnError || !data?.verified) {
        setError(data?.error || "Invalid or expired code");
        setStep("input");
        return;
      }
      toast.success("Purchase verified!");
      onVerified();
    } catch {
      setError("Verification failed");
      setStep("input");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-background rounded-xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
        <Smartphone className="h-12 w-12 text-primary mx-auto" />
        <h2 className="font-display text-xl font-bold text-foreground">Purchase Verification</h2>
        <p className="text-sm text-muted-foreground">
          {step === "sending"
            ? "Sending verification code via SMS..."
            : `We sent a 6-digit code to ${maskedPhone || "your phone"}`}
        </p>

        {step === "sending" && (
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        )}

        {(step === "input" || step === "verifying") && (
          <>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full h-14 text-center text-2xl font-display font-bold tracking-[0.5em] rounded-md bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="000000"
              autoFocus
              disabled={step === "verifying"}
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onCancel}
                disabled={step === "verifying"}
              >
                Cancel
              </Button>
              <Button
                variant="hero"
                className="flex-1"
                disabled={code.length !== 6 || step === "verifying"}
                onClick={handleVerify}
              >
                {step === "verifying" ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Verifying...</>
                ) : (
                  "Verify & Pay"
                )}
              </Button>
            </div>

            <button
              onClick={sendOtp}
              disabled={step === "verifying"}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Didn't receive a code? Resend
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PurchaseOtpModal;
