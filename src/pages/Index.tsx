import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";
import HowItWorks from "@/components/HowItWorks";
import WhyChooseUs from "@/components/WhyChooseUs";
import BestsellersSection from "@/components/BestsellersSection";
import PreOrdersSection from "@/components/PreOrdersSection";
import CustomerReviews from "@/components/CustomerReviews";
import { BundlesSection } from "@/components/BundlesSection";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import NewsletterPopup from "@/components/NewsletterPopup";
import GiveawayBanner from "@/components/GiveawayBanner";
import DealOfTheDayBanner, { useTopDailyDeal } from "@/components/DealOfTheDayBanner";

import PlatformSection from "@/components/PlatformSection";
import SuggestionMailbox from "@/components/SuggestionMailbox";
import FreeGiftBanner from "@/components/FreeGiftBanner";
import { Trans, useTranslation } from "react-i18next";

const GiveawayBannerWithDealAwareness = () => {
  const { data: deals, isLoading } = useTopDailyDeal();
  // Wait for the deals query before rendering — otherwise the winner banner
  // flashes for a second and then vanishes once hideWinner flips to true.
  if (isLoading) return null;
  return <GiveawayBanner hideWinner={!!(deals && deals.length > 0)} />;
};

const homepageFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is Agever's a legitimate place to buy game keys?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Agever's is a direct-sales digital storefront operating since 2018, with 50,000+ codes delivered worldwide. Every key is sourced from authorised B2B distributors and verified suppliers — never from anonymous third-party resellers. All orders are protected by PayPal Buyer Protection and a 14-day refund guarantee on undelivered keys.",
      },
    },
    {
      "@type": "Question",
      name: "How fast is delivery?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "In-stock keys are delivered instantly to your account immediately after payment is confirmed — usually within 30 seconds. Pre-orders are auto-fulfilled the moment the publisher releases the key.",
      },
    },
    {
      "@type": "Question",
      name: "What payment methods does Agever's accept?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PayPal with full Buyer Protection, plus all major credit and debit cards processed through PayPal's secure checkout. Prices are displayed in your local currency including USD, EUR, GBP and ILS using real-time FX rates.",
      },
    },
    {
      "@type": "Question",
      name: "What if my key doesn't work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Open a support ticket within 14 days of purchase and we will either replace the key or issue a full refund. Because we source from authorised distributors, replacements are usually issued the same day.",
      },
    },
    {
      "@type": "Question",
      name: "Will my key work in my country?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every product page lists the regional compatibility, and our checkout automatically warns you if a key is not compatible with your detected location. This prevents the most common cause of activation failures.",
      },
    },
  ],
};

const Index = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setNewsletterEmail(user.email || "");
      (supabase.from("newsletter_subscribers" as any).select("id").eq("user_id", user.id).maybeSingle() as any)
        .then(({ data }: any) => {
          if (data) setIsSubscribed(true);
        });
    }
  }, [user]);

  const handleNewsletterRegister = async () => {
    if (!user || !newsletterEmail.trim()) return;
    setSubmitting(true);
    const { error } = await (supabase.from("newsletter_subscribers" as any).insert({
      user_id: user.id,
      email: newsletterEmail.trim(),
    }) as any);
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        toast.info("You're already subscribed!");
        setIsSubscribed(true);
      } else {
        toast.error("Failed to subscribe. Please try again.");
      }
    } else {
      toast.success("Successfully subscribed to the newsletter!");
      setIsSubscribed(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageFaqJsonLd) }} />

      <NewsletterPopup />
      <h1 className="sr-only">Agever's — Instant Digital Game Keys & Software</h1>
      <div className="pt-32">
        <FreeGiftBanner />
        <GiveawayBannerWithDealAwareness />
        <PlatformSection />
        <DealOfTheDayBanner />
        <HeroSection />
      </div>

      <HowItWorks />
      <WhyChooseUs />
      <BundlesSection />
      <SuggestionMailbox />

      {/* CTA Banner */}
      <div>
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="glass rounded-2xl p-8 md:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 gradient-primary opacity-5" />
            <h2 className="font-display text-2xl md:text-4xl font-bold gradient-text mb-4 relative z-10">
              {t("home.community.title")}
            </h2>

            {!user ? (
              <>
                <p className="text-muted-foreground max-w-md mx-auto mb-6 relative z-10">
                  <Trans i18nKey="home.community.guestText" components={{ 1: <span className="text-primary font-semibold" /> }} />
                </p>
                <div className="flex justify-center relative z-10">
                  <a
                    href="/auth"
                    className="h-11 px-8 rounded-md gradient-primary font-display text-sm font-semibold tracking-wider text-primary-foreground box-glow hover:opacity-90 transition-opacity inline-flex items-center"
                  >
                    {t("home.community.createAccount")}
                  </a>
                </div>
              </>
            ) : isSubscribed ? (
              <p className="text-muted-foreground max-w-md mx-auto relative z-10">
                {t("home.community.subscribed")}
              </p>
            ) : (
              <>
                <p className="text-muted-foreground max-w-md mx-auto mb-6 relative z-10">
                  <Trans i18nKey="home.community.userText" components={{ 1: <span className="text-primary font-semibold" />, 3: <span className="text-primary font-semibold" /> }} />
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center relative z-10 max-w-md mx-auto">
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder={t("home.community.emailPlaceholder")}
                    className="w-full sm:flex-1 h-11 px-4 rounded-md border border-border bg-secondary text-foreground text-sm font-body focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={handleNewsletterRegister}
                    disabled={submitting || !newsletterEmail.trim()}
                    className="h-11 px-8 rounded-md gradient-primary font-display text-sm font-semibold tracking-wider text-primary-foreground box-glow hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {submitting ? t("home.community.subscribing") : t("home.community.subscribe")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
      </div>

      <Footer />
    </div>
  );
};

export default Index;
