import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Mail, MessageCircle, MapPin, Phone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TurnstileWidget, verifyTurnstileToken } from "@/components/Turnstile";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ContactUs = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanMessage = message.trim();
    if (!cleanName || !cleanEmail || !cleanMessage || !consent) return;
    if (cleanName.length < 2 || cleanName.length > 100) {
      toast.error("Please enter your full name (at least 2 characters).");
      return;
    }
    if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 255) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (cleanMessage.length < 10 || cleanMessage.length > 2000) {
      toast.error("Your message must be at least 10 characters long.");
      return;
    }
    if (!turnstileToken) {
      toast.error("Please complete the security check.");
      return;
    }
    setSubmitting(true);
    try {
      const human = await verifyTurnstileToken(turnstileToken);
      if (!human) {
        toast.error("Security verification failed. Please try again.");
        setTurnstileToken(null);
        return;
      }
      const { error } = await supabase.from("contact_messages" as any).insert({
        name: cleanName,
        email: cleanEmail,
        message: cleanMessage,
      } as any);
      if (error) throw error;
      toast.success("Message sent! We'll get back to you within 24 hours.");
      setName("");
      setEmail("");
      setMessage("");
      setConsent(false);
      setTurnstileToken(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
  <div className="min-h-screen bg-background">
    <Navbar />
    <section className="pt-32 pb-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <MessageCircle className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground">
              CONTACT US
            </h1>
          </div>
          <p className="text-muted-foreground mb-12 text-lg">
            We're here to help. Get in touch with our support team.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="glass rounded-xl p-6 border border-border/50">
              <Mail className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-display text-lg font-bold text-foreground mb-2">Email Support</h3>
              <p className="text-muted-foreground text-sm mb-3">Get a response within 24 hours.</p>
              <a href="mailto:support@agevers.com" className="text-primary hover:underline text-sm">support@agevers.com</a>
            </div>
            <div className="glass rounded-xl p-6 border border-border/50">
              <Phone className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-display text-lg font-bold text-foreground mb-2">Phone</h3>
              <p className="text-muted-foreground text-sm mb-3">Call us during business hours.</p>
              <a href="tel:+972086367502" className="text-primary hover:underline text-sm">+972-08-636-7502</a>
            </div>
            <div className="glass rounded-xl p-6 border border-border/50">
              <MessageCircle className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-display text-lg font-bold text-foreground mb-2">Live Chat</h3>
              <p className="text-muted-foreground text-sm mb-3">Available Mon–Fri, 9AM–6PM UTC.</p>
              <span className="text-primary text-sm font-semibold">Online Now</span>
            </div>
            <div className="glass rounded-xl p-6 border border-border/50">
              <MapPin className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-display text-lg font-bold text-foreground mb-2">Business Address</h3>
              <p className="text-muted-foreground text-sm mb-1">Agever's</p>
              <p className="text-muted-foreground text-sm mb-1">Hativat HaNegev 11, Eilat, Israel</p>
              <a href="mailto:business@agevers.com" className="text-primary hover:underline text-sm">business@agevers.com</a>
            </div>
          </div>

          <div className="glass rounded-xl p-8 border border-border/50">
            <h3 className="font-display text-lg font-bold text-foreground mb-2">Send us a message</h3>
            <p className="text-muted-foreground text-xs mb-4">
              We collect your name, email, and message solely to respond to your inquiry. Your data will not be used for marketing purposes. See our{" "}
              <a href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</a> for details.
            </p>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="contact-name" className="block text-sm font-body text-muted-foreground mb-1">Your Name <span className="text-destructive">*</span></label>
                <input id="contact-name" type="text" placeholder="Your Name" required aria-required="true" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-body text-muted-foreground mb-1">Your Email <span className="text-destructive">*</span></label>
                <input id="contact-email" type="email" placeholder="Your Email" required aria-required="true" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label htmlFor="contact-message" className="block text-sm font-body text-muted-foreground mb-1">Your Message <span className="text-destructive">*</span></label>
                <textarea id="contact-message" placeholder="Your Message" rows={5} required aria-required="true" value={message} onChange={(e) => setMessage(e.target.value)} disabled={submitting} className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
              </div>
              <div className="flex items-start gap-2">
                <input id="contact-consent" type="checkbox" required aria-required="true" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={submitting} className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                <label htmlFor="contact-consent" className="text-xs text-muted-foreground">
                  I consent to Agevers processing my personal data to respond to this inquiry, in accordance with the{" "}
                  <a href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</a>. <span className="text-destructive">*</span>
                </label>
              </div>
              <TurnstileWidget onToken={setTurnstileToken} />
              <button type="submit" disabled={submitting || !turnstileToken} className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-display font-semibold tracking-wider uppercase hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </section>
    <Footer />
  </div>
  );
};

export default ContactUs;
