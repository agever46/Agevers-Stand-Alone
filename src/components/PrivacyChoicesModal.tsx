import { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const PRIVACY_CHOICES_EVENT = "agevers:open-privacy-choices";

const emailSchema = z
  .string()
  .trim()
  .email({ message: "Please enter a valid email address" })
  .max(255, { message: "Email must be less than 255 characters" });

const PrivacyChoicesModal = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const handler = () => {
      setDone(false);
      setError(null);
      setOpen(true);
    };
    window.addEventListener(PRIVACY_CHOICES_EVENT, handler);
    return () => window.removeEventListener(PRIVACY_CHOICES_EVENT, handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: dbError } = await (supabase
      .from("privacy_opt_out" as never)
      .insert({ email: parsed.data.toLowerCase(), source: "footer" } as never) as never);
    setSubmitting(false);
    if (dbError && (dbError as { code?: string }).code !== "23505") {
      setError("We couldn't record your request. Please try again or email support@agevers.com.");
      return;
    }
    setDone(true);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-primary" aria-hidden="true" />
            Your Privacy Choices
          </DialogTitle>
          <DialogDescription className="leading-relaxed pt-2">
            Under the California Consumer Privacy Act (CCPA/CPRA) and similar privacy laws, you have
            the right to opt out of the sale or sharing of your personal information with third
            parties, including advertising and analytics partners. Submit your email below and we
            will stop sharing data linked to it.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <p role="status" aria-live="polite" className="text-sm text-foreground py-2">
            Your opt-out request has been recorded.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="privacy-optout-email">Email address</Label>
              <Input
                id="privacy-optout-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-describedby={error ? "privacy-optout-error" : undefined}
                aria-invalid={!!error}
              />
              {error && (
                <p id="privacy-optout-error" role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Submitting..." : "Submit Opt-Out Request"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Read more in our{" "}
              <a href="/privacy-policy" className="text-primary hover:underline">
                Privacy Policy
              </a>
              .
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PrivacyChoicesModal;
