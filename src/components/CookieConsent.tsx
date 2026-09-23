import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COOKIE_CONSENT_KEY, applyConsentChoice, type CookieChoice } from "@/lib/consentScripts";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(COOKIE_CONSENT_KEY);
    } catch {
      /* ignore — localStorage unavailable (private mode / blocked); fall back to showing the banner */
    }
    if (!saved) {
      const timer = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Allows re-opening the banner from anywhere (e.g. the "Cookie Settings" footer link)
  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener("agevers:open-cookie-settings", handler);
    return () => window.removeEventListener("agevers:open-cookie-settings", handler);
  }, []);

  const handleChoice = (choice: CookieChoice) => {
    applyConsentChoice(choice);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:p-6"
        >
          <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl p-5 md:p-6">
            <div className="flex items-start gap-4">
              <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Cookie className="h-5 w-5 text-primary" />
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-foreground">
                    🍪 We Use Cookies
                  </h3>
                  <button
                    onClick={() => handleChoice("none")}
                    aria-label="Decline all cookies and close"
                    className="text-muted-foreground hover:text-foreground transition-colors sm:hidden"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
                  You can choose to accept all cookies, only essential ones, or decline non-essential cookies.{" "}
                  <a href="/privacy-policy" className="text-primary hover:underline">
                    Learn more
                  </a>
                </p>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button
                    onClick={() => handleChoice("all")}
                    className="w-full sm:w-auto"
                    size="sm"
                  >
                    Accept All
                  </Button>
                  <Button
                    onClick={() => handleChoice("necessary")}
                    variant="secondary"
                    className="w-full sm:w-auto"
                    size="sm"
                  >
                    Necessary Only
                  </Button>
                  <Button
                    onClick={() => handleChoice("none")}
                    variant="outline"
                    className="w-full sm:w-auto"
                    size="sm"
                  >
                    Decline All
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsent;
