import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { HelpCircle, Search, MessageCircle, LifeBuoy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type Faq = { q: string; a: string; cat: string };

const faqs: Faq[] = [
  // ---------- Orders & Delivery ----------
  { cat: "Orders & Delivery", q: "How do I receive my game key?", a: "Keys are delivered digitally. After your payment is approved, open the order confirmation page (or My Account → Orders) and click \"Reveal Code\". The key appears on screen and is also stored permanently in your order history." },
  { cat: "Orders & Delivery", q: "How long does delivery take?", a: "Most orders are ready within seconds. Some orders pass a short automatic security review (usually up to 10 minutes) before the code can be revealed. Pre-orders are delivered on the official release date." },
  { cat: "Orders & Delivery", q: "Why does my order say \"Awaiting reveal\"?", a: "That means payment succeeded and the key is reserved for you, but you haven't clicked \"Reveal Code\" yet. Nothing is lost — log in and reveal it whenever you're ready." },
  { cat: "Orders & Delivery", q: "Why is my order on hold?", a: "Orders can be held automatically for a manual check — for example large first-time purchases, a mismatch between your account email and payment email, or an unusual risk score. Our team reviews holds quickly and you'll get an email as soon as your code is ready." },
  { cat: "Orders & Delivery", q: "I paid but I don't see the order in my account", a: "Make sure you're logged into the same account you used at checkout. If you paid and no order appears within 15 minutes, contact support with your PayPal transaction ID and we'll locate it." },
  { cat: "Orders & Delivery", q: "Do I need an account to buy?", a: "Yes. Guest checkout is disabled. A free account is required so your keys stay securely attached to you and can always be recovered." },
  { cat: "Orders & Delivery", q: "Where can I find my past orders and keys?", a: "My Account → Orders. Every key you ever purchased stays there." },
  { cat: "Orders & Delivery", q: "Can I buy several copies of the same game?", a: "Yes, as long as stock allows. Some higher-priced items have per-order quantity limits as a fraud-prevention measure." },
  { cat: "Orders & Delivery", q: "What is a pre-order and when is it delivered?", a: "A pre-order locks today's price for a game that hasn't launched yet. The key is delivered automatically on the official release date, and you'll receive an email the moment it's available." },
  { cat: "Orders & Delivery", q: "Can I cancel an order?", a: "You can cancel before the code is revealed. Once the key has been revealed, the sale is final — see the refund section below." },

  // ---------- Payments & Pricing ----------
  { cat: "Payments & Pricing", q: "What payment methods do you accept?", a: "PayPal and all major credit/debit cards through our secure payment provider. Card payments are protected by 3-D Secure." },
  { cat: "Payments & Pricing", q: "Is my payment information stored on your site?", a: "No. Card and PayPal details are handled entirely by the payment provider. We never see or store card numbers." },
  { cat: "Payments & Pricing", q: "Which currencies can I pay in?", a: "You can switch currency using the switcher in the navigation bar. Rates are updated in real time and you are charged in the currency you selected." },
  { cat: "Payments & Pricing", q: "What is the \"Digital Fee\" at checkout?", a: "It's the payment-processing cost applied to digital goods. Physical items don't carry this fee. It is always shown before you pay — no hidden charges." },
  { cat: "Payments & Pricing", q: "Why was my payment declined?", a: "The most common reasons are 3-D Secure verification being cancelled, insufficient funds, or your bank blocking international digital purchases. Try another card or PayPal, or contact your bank." },
  { cat: "Payments & Pricing", q: "Why does my order need email or SMS verification?", a: "For your protection we verify ownership of the account before revealing a key. You'll receive a one-time code by SMS; if SMS doesn't arrive, an email fallback option appears shortly after." },
  { cat: "Payments & Pricing", q: "Do you charge VAT?", a: "Prices shown are final. Receipts are issued for every completed purchase and can be requested from support." },
  { cat: "Payments & Pricing", q: "Can I get an invoice or receipt?", a: "Yes. Contact support with your order number and we'll issue an official receipt." },
  { cat: "Payments & Pricing", q: "Why is the price different from another store?", a: "Prices follow live supplier costs and currency rates, so they change frequently. Many products also show a price-comparison indicator so you can see how our price ranks." },
  { cat: "Payments & Pricing", q: "Why did the price change between adding to cart and checkout?", a: "Cart items are re-priced against live stock at checkout. If a supplier offer expired, the system picks the next active offer, which may cost slightly more or less." },

  // ---------- Activation ----------
  { cat: "Activation", q: "How do I activate a Steam key?", a: "Open Steam → Games menu → \"Activate a Product on Steam\" → paste the key. The game is then added to your library permanently." },
  { cat: "Activation", q: "How do I activate an Xbox / Microsoft key?", a: "Go to redeem.microsoft.com (or Microsoft Store → Redeem code on your console), sign in, and enter the 25-character code." },
  { cat: "Activation", q: "How do I redeem a PlayStation code?", a: "PlayStation Store → Redeem Codes → enter your 12-digit code. The code must match your account's store region." },
  { cat: "Activation", q: "How do I redeem a Nintendo eShop code?", a: "Nintendo eShop → Enter Code (left menu) → type the 16-character code. Region must match your Nintendo account country." },
  { cat: "Activation", q: "What does \"region\" mean on a product?", a: "Some keys only activate in specific countries or regions. The region is always stated on the product page, and we show a warning if your detected location doesn't match." },
  { cat: "Activation", q: "I get \"invalid code\" — what should I do?", a: "First check for typos, confirm you're on the correct platform and region, and make sure the code isn't for a different store. If it still fails, contact support immediately with a screenshot — we'll replace it." },
  { cat: "Activation", q: "Do I need a VPN?", a: "Only for region-restricted products where the product page says so. Never use a VPN to activate a key from a region the product doesn't allow — the platform may block the activation." },
  { cat: "Activation", q: "Can I activate my key on more than one account?", a: "No. Each key can be redeemed once, on a single account." },
  { cat: "Activation", q: "Where do I find activation instructions?", a: "Every product page has an activation section for that exact platform, and our Guides section has step-by-step walkthroughs." },

  // ---------- Gift Cards & Top-Ups ----------
  { cat: "Gift Cards & Top-Ups", q: "How do gift cards work?", a: "You receive a code that you redeem in the relevant store (Steam, PlayStation, Xbox, Nintendo, Roblox, Razer Gold, and more) to add balance to your wallet." },
  { cat: "Gift Cards & Top-Ups", q: "Are gift cards region-locked?", a: "Yes, almost always. A US gift card only works on a US store account. Always pick the region that matches your account." },
  { cat: "Gift Cards & Top-Ups", q: "Do gift cards expire?", a: "Most platform gift cards do not expire once redeemed to your wallet, but rules vary by platform and region. Check the product page." },
  { cat: "Gift Cards & Top-Ups", q: "Can I combine several gift cards?", a: "Yes — most stores let you stack multiple gift cards into the same wallet balance." },
  { cat: "Gift Cards & Top-Ups", q: "Why can't I find a specific brand?", a: "Gift cards are grouped by brand into tiles. Open the brand tile to see every denomination and region we carry, or use the search bar at the top of the site." },

  // ---------- Refunds & Problems ----------
  { cat: "Refunds & Problems", q: "Can I get a refund?", a: "Yes — as long as the code has not been revealed. Once a key is revealed it cannot be returned, because the code is permanently exposed. This is standard practice for digital goods." },
  { cat: "Refunds & Problems", q: "My key doesn't work — what now?", a: "Contact support right away with your order number and a screenshot of the error. If the key is faulty we replace it, or refund you in full." },
  { cat: "Refunds & Problems", q: "How long does a refund take?", a: "Approved refunds are sent back to the original payment method, typically within 3–10 business days depending on your bank or PayPal." },
  { cat: "Refunds & Problems", q: "I bought the wrong region / platform by mistake", a: "Contact support before revealing the code and we'll cancel or swap the order. After reveal we can't reverse it." },
  { cat: "Refunds & Problems", q: "What if the item is out of stock after I paid?", a: "If we can't source your key, the order is refunded in full automatically and you'll receive an email confirming it." },
  { cat: "Refunds & Problems", q: "How do I open a support ticket?", a: "Use the Contact page or the Order Issue link inside your order. Attach screenshots — it speeds things up a lot." },

  // ---------- Account & Security ----------
  { cat: "Account & Security", q: "Why can't my new account purchase more than €20 in the first 24 hours?", a: "It's an automatic safety rule that protects both sides against misuse of brand-new accounts. The limit lifts by itself after 24 hours. Need a bigger purchase now? Contact us and we'll review and approve it manually, usually within minutes." },
  { cat: "Account & Security", q: "What is the difference between username and display name?", a: "Your username is your real first and last name, used for billing and support. The display name is the public gamer-style name shown around the site — you can change it in your account settings." },
  { cat: "Account & Security", q: "I signed up with email but can't log in", a: "Make sure your email is verified — check your inbox and spam folder. If you originally registered with Google, use the \"Continue with Google\" button instead of a password." },
  { cat: "Account & Security", q: "Why do I need to verify my email?", a: "Verification protects your keys and lets us send order confirmations and delivery links. Unverified accounts get reminders and may be suspended after 72 hours." },
  { cat: "Account & Security", q: "Why was I asked for a code when logging in from a new device?", a: "We use device recognition. Logging in from an unrecognised browser or device triggers a 6-digit email code to make sure it's really you." },
  { cat: "Account & Security", q: "How do I reset my password?", a: "Click \"Forgot password\" on the login page and follow the emailed link. Google-registered accounts don't use a password at all." },
  { cat: "Account & Security", q: "How do I delete my account?", a: "Contact support and we'll remove your account and personal data, keeping only what tax and fraud-prevention law requires." },
  { cat: "Account & Security", q: "Is it safe to buy from Agever's?", a: "Yes. Keys come from authorised distributors, every order passes automated fraud checks, payments are handled by certified providers, and each purchase is backed by our replace-or-refund guarantee." },

  // ---------- Rewards & Extras ----------
  { cat: "Rewards & Extras", q: "How does the referral program work?", a: "Share your personal referral link from your account. When a referred friend makes their first purchase, you receive a reward." },
  { cat: "Rewards & Extras", q: "How do I use a discount code?", a: "Enter it in the promo field at checkout. Codes may have expiry dates, minimum order values, and usage limits." },
  { cat: "Rewards & Extras", q: "Can I be notified when a sold-out product returns?", a: "Yes — click \"Notify me\" on any out-of-stock product and we'll email you the moment it's back." },
  { cat: "Rewards & Extras", q: "Do you offer bundles or bulk discounts?", a: "Yes. Check the Bundles page for curated packs, and quantity discounts apply automatically on eligible products." },
  { cat: "Rewards & Extras", q: "Do you work with businesses or affiliates?", a: "Yes — visit our Business Portal to apply for wholesale or affiliate partnerships." },
];

const CATEGORIES = ["All", ...Array.from(new Set(faqs.map((f) => f.cat)))];

const FAQ = () => {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");

  useEffect(() => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
    document.getElementById("faq-jsonld")?.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "faq-jsonld";
    script.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(script);

    const prevTitle = document.title;
    document.title = "FAQ — Delivery, Payments, Refunds & Activation | Agever's";
    const desc = document.querySelector('meta[name="description"]');
    const prevDesc = desc?.getAttribute("content") ?? "";
    desc?.setAttribute(
      "content",
      "Answers to 50+ common questions about game key delivery, payments, refunds, activation, gift cards, accounts and rewards at Agever's."
    );
    return () => {
      document.getElementById("faq-jsonld")?.remove();
      document.title = prevTitle;
      desc?.setAttribute("content", prevDesc);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter(
      (f) =>
        (cat === "All" || f.cat === cat) &&
        (!q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))
    );
  }, [query, cat]);

  const grouped = useMemo(() => {
    const map = new Map<string, Faq[]>();
    filtered.forEach((f) => map.set(f.cat, [...(map.get(f.cat) ?? []), f]));
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-4">
              <HelpCircle className="h-8 w-8 text-primary" />
              <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground">
                Frequently Asked Questions
              </h1>
            </div>
            <p className="text-muted-foreground mb-8 text-lg">
              Everything about delivery, payments, refunds, activation, gift cards, accounts and
              rewards — answered directly, no chatbot needed.
            </p>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions… e.g. refund, Steam key, region"
                className="pl-9 h-12 glass border-border/50"
                aria-label="Search frequently asked questions"
              />
            </div>

            <div className="flex flex-wrap gap-2 mb-10">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    cat === c
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {grouped.length === 0 && (
              <div className="glass rounded-xl border border-border/50 p-8 text-center">
                <p className="text-muted-foreground mb-4">
                  No answer matched “{query}”. Our team can help directly.
                </p>
                <Button asChild>
                  <Link to="/contact">Contact support</Link>
                </Button>
              </div>
            )}

            <div className="space-y-10">
              {grouped.map(([category, items]) => (
                <div key={category}>
                  <h2 className="font-display text-xl font-bold text-foreground mb-4 tracking-wide">
                    {category}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({items.length})
                    </span>
                  </h2>
                  <Accordion type="single" collapsible className="space-y-3">
                    {items.map((faq, i) => (
                      <AccordionItem
                        key={faq.q}
                        value={`${category}-${i}`}
                        className="glass rounded-xl border border-border/50 px-6"
                      >
                        <AccordionTrigger className="font-display font-semibold text-foreground hover:text-primary py-4 text-left">
                          {faq.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                          {faq.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </div>

            <div className="glass mt-14 rounded-2xl border border-border/50 p-8 text-center">
              <LifeBuoy className="mx-auto mb-3 h-8 w-8 text-primary" />
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                Still need help?
              </h2>
              <p className="text-muted-foreground mb-6">
                Browse our step-by-step guides or reach a human — we usually reply fast.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/contact">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Contact support
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/guides">Activation guides</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/help-center">Help center</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default FAQ;
