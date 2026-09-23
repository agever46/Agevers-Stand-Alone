import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Gamepad2 } from "lucide-react";

const PACK = { plays: 5, usd: "1.00" };
const SDK_ID = "paypal-sdk-buy-plays";

const loadPaypalSdk = (clientId: string): Promise<any> =>
  new Promise((resolve, reject) => {
    if ((window as any).paypal_buy_plays?.Buttons) {
      resolve((window as any).paypal_buy_plays);
      return;
    }
    const existing = document.getElementById(SDK_ID);
    if (existing) existing.remove();
    const s = document.createElement("script");
    s.id = SDK_ID;
    // Standard PayPal Smart Buttons only (no advanced/hosted card fields) —
    // same reasoning as Checkout.tsx: enable-funding=card explicitly requests
    // the card button under the Standard integration.
    s.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&components=buttons&enable-funding=card&disable-funding=credit,paylater`;
    s.setAttribute("data-namespace", "paypal_buy_plays");
    s.async = true;
    s.onload = () => resolve((window as any).paypal_buy_plays);
    s.onerror = () => reject(new Error("Failed to load PayPal SDK"));
    document.body.appendChild(s);
  });

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BuyPlaysPaypalModal = ({ open, onClose, onSuccess }: Props) => {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonsRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setLoading(true);

    (async () => {
      try {
        const { data } = await supabase.functions.invoke("paypal-config");
        const clientId = (data as any)?.clientId;
        if (!clientId) throw new Error("PayPal not configured");
        const paypal = await loadPaypalSdk(clientId);
        if (cancelled || !containerRef.current) return;

        // Wait a tick so the container is mounted
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled || !containerRef.current) return;

        const baseConfig: any = {
          // NOTE: style.color is overridden per funding source below — the
          // card button only accepts "black"/"white" (the SDK throws on "gold").
          createOrder: (_d: any, actions: any) =>
            actions.order.create({
              purchase_units: [
                {
                  amount: { value: PACK.usd, currency_code: "USD" },
                  description: `${PACK.plays} extra game plays`,
                  // Binds the payment to the buying account so the server can
                  // reject attempts to claim someone else's payment.
                  custom_id: user?.id,
                },
              ],
            }),
          onApprove: async (_d: any, actions: any) => {
            setProcessing(true);
            try {
              const details = await actions.order.capture();
              const { data: res, error: fnErr } = await supabase.functions.invoke("buy-plays-paypal", {
                body: { orderId: details.id },
              });
              if (fnErr || (res as any)?.error) {
                throw new Error((fnErr as any)?.message || (res as any)?.error || "Verification failed");
              }
              toast.success(`🎮 ${PACK.plays} extra plays added!`);
              onSuccess();
              onClose();
            } catch (e: any) {
              toast.error(e.message || "Payment failed");
              setError(e.message);
            } finally {
              setProcessing(false);
            }
          },
          onError: (err: any) => {
            console.error("PayPal error", err);
            setError("PayPal error. Please try again.");
          },
        };

        // Standard integration: render the yellow PayPal button and the black
        // Debit/Credit card button as two separate standard Smart Button
        // instances, matching Checkout.tsx.
        containerRef.current.innerHTML = "";
        const FUNDING = paypal.FUNDING || {};
        const sources = [FUNDING.PAYPAL, FUNDING.CARD].filter(Boolean);
        const instances: any[] = [];

        for (const fundingSource of sources) {
          const isCard = fundingSource === FUNDING.CARD;
          // Card buttons only accept black/white colors and no custom label
          // (the SDK throws on label: "pay" — PayPal renders its own).
          const style = isCard
            ? { layout: "vertical", color: "black", shape: "rect", height: 45 }
            : { layout: "vertical", color: "gold", shape: "rect", label: "pay", height: 45 };
          const btn = paypal.Buttons({ ...baseConfig, fundingSource, style });
          if (btn.isEligible && !btn.isEligible()) continue;
          const slot = document.createElement("div");
          slot.style.marginBottom = "8px";
          containerRef.current.appendChild(slot);
          instances.push(btn);
          btn.render(slot).catch((err: any) => {
            console.error("Failed to render PayPal Buttons:", err);
          });
        }

        buttonsRef.current = instances;
        if (instances.length === 0) setError("Could not render PayPal button.");
        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Failed to load PayPal");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const inst of buttonsRef.current || []) {
        try { inst.close?.(); } catch { /* ignore */ }
      }
      buttonsRef.current = null;
    };
  }, [open, onClose, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Gamepad2 className="h-5 w-5 text-primary" />
            Buy {PACK.plays} Extra Plays — ${PACK.usd}
          </DialogTitle>
          <DialogDescription>
            Pay securely with PayPal or any major credit card. Plays are added to your account instantly.
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-[180px]">
          {(loading || processing) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 z-10 rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {processing ? "Verifying payment..." : "Loading PayPal..."}
              </p>
            </div>
          )}
          {/* PayPal SDK container: kept mounted, hidden via display:none when not needed */}
          <div
            ref={containerRef}
            style={{ display: loading ? "none" : "block" }}
            className="pt-2"
          />
          {error && (
            <p className="text-sm text-destructive mt-3 text-center">{error}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BuyPlaysPaypalModal;