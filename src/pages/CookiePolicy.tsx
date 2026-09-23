import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Cookie } from "lucide-react";

const CookiePolicy = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <section className="pt-32 pb-16">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <Cookie className="h-8 w-8 text-primary" />
            <h1 className="font-display text-3xl md:text-5xl font-black tracking-wider text-foreground">
              COOKIE POLICY
            </h1>
          </div>
          <p className="text-muted-foreground mb-12 text-sm">Last updated: September 2026</p>

          <div className="space-y-10 text-muted-foreground text-sm leading-relaxed">
            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">What Are Cookies?</h2>
              <p>
                Cookies are small text files placed on your device when you visit a website. They help the site
                function, remember your preferences, and — with your consent — help us understand how the site is
                used and measure our advertising.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Your Choice Comes First</h2>
              <p className="mb-3">
                When you first visit agevers.com, a consent banner lets you choose between:
              </p>
              <ul className="list-disc pl-5 space-y-1 mb-3">
                <li>
                  <strong className="text-foreground">Accept All</strong> — essential cookies plus analytics
                  (Google Analytics) and advertising measurement (Google Ads, Reddit Pixel).
                </li>
                <li>
                  <strong className="text-foreground">Necessary Only</strong> — only cookies required for the site
                  to function (login, cart, security). No analytics or advertising cookies are set.
                </li>
                <li>
                  <strong className="text-foreground">Decline All</strong> — same as "Necessary Only": no
                  non-essential cookies or tracking scripts are loaded.
                </li>
              </ul>
              <p className="mb-3">
                No analytics or advertising scripts load until you explicitly choose "Accept All". Your choice is
                stored on your device and a record of it is kept on our servers as proof of consent.
              </p>
              <p>
                You can change your choice at any time via the{" "}
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("agevers:open-cookie-settings"))}
                  className="text-primary hover:underline"
                >
                  Cookie Settings
                </button>{" "}
                link in the footer of every page.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Cookies We Use</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pr-4 text-foreground font-semibold">Cookie / Storage</th>
                      <th className="py-2 pr-4 text-foreground font-semibold">Provider</th>
                      <th className="py-2 pr-4 text-foreground font-semibold">Purpose</th>
                      <th className="py-2 text-foreground font-semibold">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    <tr>
                      <td className="py-2 pr-4">sb-*-auth-token</td>
                      <td className="py-2 pr-4">Agevers (auth)</td>
                      <td className="py-2 pr-4">Keeps you signed in securely</td>
                      <td className="py-2">Strictly necessary</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">agevers_cart</td>
                      <td className="py-2 pr-4">Agevers</td>
                      <td className="py-2 pr-4">Remembers your shopping cart</td>
                      <td className="py-2">Strictly necessary</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">agevers_cookie_consent</td>
                      <td className="py-2 pr-4">Agevers</td>
                      <td className="py-2 pr-4">Stores your cookie consent choice</td>
                      <td className="py-2">Strictly necessary</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">_ga, _ga_*</td>
                      <td className="py-2 pr-4">Google Analytics</td>
                      <td className="py-2 pr-4">Anonymous usage statistics</td>
                      <td className="py-2">Analytics (consent only)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">_gcl_*</td>
                      <td className="py-2 pr-4">Google Ads</td>
                      <td className="py-2 pr-4">Ad conversion measurement</td>
                      <td className="py-2">Advertising (consent only)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">_rdt_*</td>
                      <td className="py-2 pr-4">Reddit Ads</td>
                      <td className="py-2 pr-4">Ad conversion measurement</td>
                      <td className="py-2">Advertising (consent only)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">Managing Cookies in Your Browser</h2>
              <p>
                Most browsers let you block or delete cookies via their settings. Note that blocking strictly
                necessary cookies may prevent you from signing in or completing a purchase. Blocking analytics or
                advertising cookies does not affect your use of the site.
              </p>
            </section>

            <section>
              <h2 className="font-display text-lg font-bold text-foreground mb-3">More Information</h2>
              <p>
                For full details on how we handle personal data, see our{" "}
                <a href="/privacy-policy" className="text-primary hover:underline">
                  Privacy Policy
                </a>
                . Questions about this Cookie Policy can be sent to{" "}
                <a href="mailto:privacy@agevers.com" className="text-primary hover:underline">
                  privacy@agevers.com
                </a>
                .
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </section>
    <Footer />
  </div>
);

export default CookiePolicy;
