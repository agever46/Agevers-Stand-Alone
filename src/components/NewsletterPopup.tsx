import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STORAGE_KEY = "newsletter_popup_dismissed";

const NewsletterPopup = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const checkSubscribed = async () => {
      if (user) {
        const { data } = await (supabase
          .from("newsletter_subscribers" as any)
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle() as any);
        if (data || cancelled) return; // already subscribed
        setEmail(user.email || "");
      }
      if (!cancelled) {
        timer = setTimeout(() => setVisible(true), 5000);
      }
    };

    checkSubscribed();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [user]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  const handleSubscribe = async () => {
    if (!user) {
      dismiss();
      window.location.href = "/auth";
      return;
    }
    if (!email.trim()) return;
    setSubmitting(true);
    const { error } = await (supabase.from("newsletter_subscribers" as any).insert({
      user_id: user.id,
      email: email.trim(),
    }) as any);
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        toast.info("You're already subscribed!");
      } else {
        toast.error("Failed to subscribe. Please try again.");
      }
    } else {
      toast.success("Subscribed! Check your email for your 5% discount code.");
    }
    dismiss();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative glass rounded-2xl p-8 max-w-md w-full text-center border border-border/50 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <button
          onClick={dismiss}
          aria-label="Close newsletter dialog"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-2 text-4xl">🎮</div>
        <h2 className="font-display text-2xl font-bold gradient-text mb-2">
          Get 5% OFF your first order
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          Sign up for our deals newsletter and get an exclusive discount code delivered to your inbox.
          <span className="block mt-2 text-primary font-semibold">+1 BONUS entry to our free game key giveaway 🎁</span>
        </p>

        {user ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              aria-label="Your email address"
              className="flex-1 h-11 px-4 rounded-md border border-border bg-secondary text-foreground text-sm font-body focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleSubscribe}
              disabled={submitting || !email.trim()}
              className="h-11 px-6 rounded-md gradient-primary font-display text-sm font-semibold tracking-wider text-primary-foreground box-glow hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
            >
              {submitting ? "..." : "SUBSCRIBE"}
            </button>
          </div>
        ) : (
          <a
            href="/auth"
            onClick={dismiss}
            className="h-11 px-8 rounded-md gradient-primary font-display text-sm font-semibold tracking-wider text-primary-foreground box-glow hover:opacity-90 transition-opacity inline-flex items-center justify-center"
          >
            SIGN UP & GET 5% OFF
          </a>
        )}

        <p className="text-muted-foreground/60 text-xs mt-4">
          No spam, unsubscribe anytime. By subscribing you agree to our{" "}
          <a href="/privacy-policy" className="text-primary hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export default NewsletterPopup;
