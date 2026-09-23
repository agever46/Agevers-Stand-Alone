import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, Package, Bug, Lightbulb, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";

type SuggestionType = "product_request" | "bug_report" | "feature_request" | "other";

const TYPES: { id: SuggestionType; label: string; icon: typeof Mail; desc: string }[] = [
  { id: "product_request", label: "Request a Product", icon: Package, desc: "A game, key or item we don't list yet" },
  { id: "feature_request", label: "Suggest a Feature", icon: Lightbulb, desc: "Something new you'd love to see" },
  { id: "bug_report", label: "Report a Bug", icon: Bug, desc: "Something on the site isn't working" },
  { id: "other", label: "Something Else", icon: Sparkles, desc: "Anything else on your mind" },
];

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  subject: z.string().trim().min(3, "Subject is too short").max(150),
  message: z.string().trim().min(10, "Tell us a little more").max(2000),
});

const Suggestions = () => {
  const { user } = useAuth();
  const [type, setType] = useState<SuggestionType>("product_request");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, subject, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Please check the form");
      return;
    }
    setSubmitting(true);
    const { data, error } = await (supabase.from("customer_suggestions" as any).insert({
      user_id: user?.id ?? null,
      email: parsed.data.email,
      type,
      subject: parsed.data.subject,
      message: parsed.data.message,
    }).select("id").single() as any);
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't send your suggestion. Please try again.");
      return;
    }
    // Fire-and-forget Telegram alert to admins
    supabase.functions.invoke("notify-suggestion", {
      body: {
        suggestionId: data?.id,
      },
    }).catch(() => {});
    setSubmitted(true);
    setSubject("");
    setMessage("");
    toast.success("Thanks! We received your message.");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-32 pb-20 container mx-auto px-4 max-w-5xl">
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-xs md:text-sm font-bold text-primary uppercase tracking-[0.2em] mb-3">
            <Mail className="h-4 w-4" /> Suggestion Mailbox
          </div>
          <h1 className="font-display text-3xl md:text-5xl font-black mb-4 gradient-text">
            Help Us Build A Better Agever's
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base md:text-lg">
            We currently list <span className="text-primary font-bold">13,500+ products</span> across games, keys, gift cards and software —
            and we're connected to a catalog of over <span className="text-primary font-bold">100,000 products</span>.
            If something you need isn't here, just ask and we'll do our best to bring it in.
            You can also report a bug or suggest a new feature you'd love to see.
          </p>
        </header>

        <section className="grid md:grid-cols-3 gap-4 mb-10">
          <div className="glass rounded-xl p-5 text-center">
            <Package className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="font-display font-bold mb-1">Missing a product?</div>
            <p className="text-sm text-muted-foreground">Request any game, key or item we don't have yet.</p>
          </div>
          <div className="glass rounded-xl p-5 text-center">
            <Bug className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="font-display font-bold mb-1">Spotted a bug?</div>
            <p className="text-sm text-muted-foreground">Let us know what broke so we can fix it fast.</p>
          </div>
          <div className="glass rounded-xl p-5 text-center">
            <Lightbulb className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="font-display font-bold mb-1">Got an idea?</div>
            <p className="text-sm text-muted-foreground">Suggest a feature or improvement you'd love to see.</p>
          </div>
        </section>

        {submitted ? (
          <div className="glass rounded-2xl p-10 text-center max-w-2xl mx-auto">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold mb-2">Message received!</h2>
            <p className="text-muted-foreground mb-6">
              Thanks for helping us improve Agever's. Our team will review your message and get back to you if needed.
            </p>
            <Button onClick={() => setSubmitted(false)} variant="outline">Send another</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 md:p-8 max-w-3xl mx-auto space-y-6">
            <div>
              <Label className="mb-3 block">What's this about?</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = type === t.id;
                  return (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setType(t.id)}
                      className={`rounded-xl border-2 p-3 text-left transition-all ${active ? "border-primary bg-primary/10 shadow-md shadow-primary/20" : "border-border hover:border-primary/50"}`}
                    >
                      <Icon className={`h-5 w-5 mb-2 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-sm font-bold">{t.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="email">Your email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required maxLength={255} className="mt-2" />
            </div>

            <div>
              <Label htmlFor="subject">
                {type === "product_request" ? "Which product?" : type === "bug_report" ? "What broke?" : "Subject"}
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={
                  type === "product_request" ? "e.g. EA Sports FC 26 — Xbox" :
                  type === "bug_report" ? "e.g. Checkout button doesn't respond on mobile" :
                  type === "feature_request" ? "e.g. Add wishlist sharing" :
                  "Short summary"
                }
                required
                maxLength={150}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="message">Tell us more</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add any details that help — platform, region, screenshots links, etc."
                rows={6}
                required
                maxLength={2000}
                className="mt-2"
              />
              <div className="text-xs text-muted-foreground text-right mt-1">{message.length}/2000</div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full h-12 font-display tracking-wider text-base">
              {submitting ? "SENDING..." : "DROP IT IN THE MAILBOX"}
            </Button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Suggestions;