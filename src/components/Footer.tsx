import { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Lock, Scale, ShieldCheck, Instagram } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import CurrencySelector from "@/components/CurrencySelector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";


interface ModalContent {
  title: string;
  body: string;
}

const modalContents: Record<string, ModalContent> = {
  ssl: {
    title: "SSL Encrypted Checkout",
    body: "All transactions on our platform are protected with industry-standard SSL/TLS encryption. Your payment details and personal information are encrypted end-to-end, ensuring that your data remains secure throughout the checkout process. We use 256-bit encryption — the same level of security used by major banks and financial institutions.",
  },
  paypal: {
    title: "PayPal Buyer Protection",
    body: "When you pay with PayPal on our platform, you're covered by PayPal's Buyer Protection program. If you don't receive your item or it's significantly not as described, PayPal may reimburse the full purchase price plus original shipping costs. This protection applies to eligible purchases and gives you an added layer of confidence when shopping with us.",
  },
  consumer: {
    title: "Consumer Rights Protected",
    body: "We are committed to upholding consumer rights in accordance with applicable international laws including EU Directive 2011/83/EU, the Israeli Consumer Protection Law, Australian Consumer Law, and FTC regulations. As a buyer, you have the right to accurate product descriptions, transparent pricing, and fair dispute resolution. For digital goods, the right of withdrawal may not apply once a key has been delivered with your prior consent.",
  },
  fraud: {
    title: "Advanced Fraud Prevention",
    body: "Your security is our top priority. We use a multi-layered fraud prevention system to protect every transaction:\n\n• IPQualityScore (IPQS) Integration — Every transaction is scored in real-time against a global fraud database, detecting VPNs, proxies, Tor connections, and suspicious IPs.\n\n• Cloudflare Protection — Our entire platform is protected by Cloudflare's enterprise-grade security, including DDoS mitigation, Web Application Firewall (WAF), and bot management.\n\n• Email Verification — All accounts require verified email addresses before any purchase can be made, preventing fraudulent account creation.\n\n• Device Verification (2FA) — Logins from unrecognized devices trigger a verification code sent to your email, ensuring only authorized users access your account.\n\n• Security Hold System — High-value transactions undergo an additional manual security review to prevent unauthorized purchases.\n\nThese layers work together to ensure 100% secure transactions for all our customers.",
  },
};

const Footer = () => {
  const { t } = useTranslation();
  const [openModal, setOpenModal] = useState<string | null>(null);
  const currentModal = openModal ? modalContents[openModal] : null;

  return (
    <>
      <footer className="border-t border-white/10 bg-background text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Support */}
            <div>
              <h4 className="text-sm font-semibold tracking-[0.15em] uppercase mb-4 text-white">
                {t("footer.support")}
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/help-center" className="text-gray-400 hover:text-white transition-colors">
                    {t("footer.helpCenter")}
                  </Link>
                </li>
                <li>
                  <Link to="/guides" className="text-gray-400 hover:text-white transition-colors">
                    {t("footer.helpGuides")}
                  </Link>
                </li>
                <li>
                  <Link to="/news" className="text-gray-400 hover:text-white transition-colors">
                    {t("footer.news")}
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="text-gray-400 hover:text-white transition-colors">
                    Blog
                  </Link>
                </li>

                <li>
                  <Link to="/contact" className="text-gray-400 hover:text-white transition-colors">
                    {t("footer.contact")}
                  </Link>
                </li>
                <li>
                  <Link to="/faq" className="text-gray-400 hover:text-white transition-colors">
                    {t("footer.faqs")}
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="text-gray-400 hover:text-white transition-colors">
                    {t("footer.about")}
                  </Link>
                </li>
                <li>
                  <Link to="/compare" className="text-gray-400 hover:text-white transition-colors">
                    {t("footer.compare")}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold tracking-[0.15em] uppercase mb-4 text-white">
                {t("footer.legal")}
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/privacy-policy" className="text-gray-400 hover:text-white transition-colors">
                    {t("footer.privacy")}
                  </Link>
                </li>
                <li>
                  <Link to="/terms-of-service" className="text-gray-400 hover:text-white transition-colors">
                    {t("footer.terms")}
                  </Link>
                </li>
                <li>
                  <Link to="/refund-policy" className="text-gray-400 hover:text-white transition-colors">
                    {t("footer.refund")}
                  </Link>
                </li>
                <li>
                  <Link to="/cookie-policy" className="text-gray-400 hover:text-white transition-colors">
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("agevers:open-cookie-settings"))}
                    className="text-gray-400 hover:text-white transition-colors text-left"
                  >
                    Cookie Settings
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    aria-label="Your privacy choices: do not sell or share my personal information"
                    onClick={() => window.dispatchEvent(new CustomEvent("agevers:open-privacy-choices"))}
                    className="text-gray-400 hover:text-white transition-colors text-left"
                  >
                    Do Not Sell or Share My Personal Information
                  </button>
                </li>
              </ul>
            </div>

            {/* Business */}
            <div>
              <h4 className="text-sm font-semibold tracking-[0.15em] uppercase mb-4 text-white">
                {t("footer.business")}
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/business?tab=wholesale" className="text-gray-400 hover:text-white transition-colors">
                    {t("footer.wholesale")}
                  </Link>
                </li>
                <li>
                  <Link to="/business?tab=affiliate" className="text-gray-400 hover:text-white transition-colors">
                    {t("footer.affiliate")}
                  </Link>
                </li>
                <li>
                  <Link to="/business?tab=partnership" className="text-gray-400 hover:text-white transition-colors">
                    {t("footer.partnerships")}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Secure Shopping */}
            <div>
              <h4 className="text-sm font-semibold tracking-[0.15em] uppercase mb-4 text-white">
                {t("footer.secureShopping")}
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button
                    onClick={() => setOpenModal("ssl")}
                    className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5 text-green-500" />
                    {t("footer.ssl")}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setOpenModal("paypal")}
                    className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    {t("footer.paypal")}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setOpenModal("consumer")}
                    className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Scale className="w-3.5 h-3.5 text-yellow-500" />
                    {t("footer.consumer")}
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setOpenModal("fraud")}
                    className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    {t("footer.fraud")}
                  </button>
                </li>
              </ul>
            </div>
          </div>


          {/* Social Icons - Centered */}
          <div className="border-t border-white/10 mt-6 pt-6 flex justify-center items-center gap-6">
            <a
              href="https://discord.gg/cSW3uyhkG"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Join Agevers Discord"
              className="hover:opacity-80 transition-opacity"
            >
              <svg viewBox="0 0 71 55" className="h-10 w-auto" fill="#5865F2" aria-label="Discord">
                <path d="M60.1 4.9A55.3 55.3 0 0 0 45.7.4a.2.2 0 0 0-.2.1 40.5 40.5 0 0 0-2 3.8c-5.5-.8-11-.8-16.3 0a37.3 37.3 0 0 0-2-3.8.2.2 0 0 0-.2-.1A55.2 55.2 0 0 0 10.9 5a.2.2 0 0 0-.1.2 57.4 57.4 0 0 0-9.5 47.2.2.2 0 0 0 0 .2 55.7 55.7 0 0 0 17.8 9 .2.2 0 0 0 .3-.1c1.4-1.9 2.6-3.9 3.6-6 .2-.1.1-.3 0-.3-2-1-3.8-2.3-5.4-3.8a.2.2 0 0 1 0-.3 12.8 12.8 0 0 0 1-.8.2.2 0 0 1 .3 0 40 40 0 0 0 34 0 .2.2 0 0 1 .2 0c3.3 2 6.9 3.3 10.6 4a.2.2 0 0 0 .2-.1 57.3 57.3 0 0 0-9.6-47.2.2.2 0 0 0-.1-.2zM23.7 37.3c-3.2 0-5.8-3-5.8-6.6 0-3.7 2.5-6.7 5.8-6.7s5.9 3 5.8 6.7c0 3.6-2.5 6.6-5.8 6.6zm23.6 0c-3.2 0-5.8-3-5.8-6.6 0-3.7 2.5-6.7 5.8-6.7s5.9 3 5.8 6.7c0 3.6-2.6 6.6-5.8 6.6z" />
              </svg>
            </a>
            <a
              href="https://x.com/agevers"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Agevers on X / Twitter"
              className="hover:opacity-80 transition-opacity"
            >
              <svg viewBox="0 0 24 24" className="h-8 w-auto" fill="#1DA1F2" aria-label="Twitter / X">
                <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05A4.28 4.28 0 0 0 15.5 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.99C7.69 9.11 4.07 7.38 1.64 4.75c-.37.64-.58 1.38-.58 2.17 0 1.49.76 2.81 1.91 3.58-.7-.02-1.36-.21-1.94-.53v.05c0 2.08 1.48 3.82 3.44 4.21a4.3 4.3 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.58 8.58 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06A12.13 12.13 0 0 0 6.95 21c7.88 0 12.21-6.54 12.21-12.21 0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.13-2.23z" />
              </svg>
            </a>
            <a
              href="https://instagram.com/agevers"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Agevers on Instagram"
              className="hover:opacity-80 transition-opacity text-white"
            >
              <Instagram className="h-9 w-auto" strokeWidth={1.75} style={{ color: "#E1306C" }} />
            </a>
          </div>

          {/* Entity Details & Payment Icons */}
          <div className="border-t border-white/10 mt-6 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-500 text-center md:text-left space-y-1">
              <p className="font-medium text-gray-400">Agever's</p>
              <p>Hativat HaNegev 11, Eilat, Israel</p>
              <p>
                Phone:{" "}
                <a href="tel:+972086367502" className="text-gray-400 hover:text-white transition-colors">
                  +972-08-636-7502
                </a>
              </p>
              <p>
                Support:{" "}
                <a href="mailto:support@agevers.com" className="text-gray-400 hover:text-white transition-colors">
                  support@agevers.com
                </a>
              </p>
            </div>

            {/* Payment Icons */}
            <div className="flex items-center gap-3">
              {/* Visa */}
              <svg viewBox="0 0 48 32" className="h-7 w-auto" aria-label="Visa">
                <rect width="48" height="32" rx="4" fill="#1A1F71" />
                <text x="24" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial">VISA</text>
              </svg>
              {/* Mastercard */}
              <svg viewBox="0 0 48 32" className="h-7 w-auto" aria-label="Mastercard">
                <rect width="48" height="32" rx="4" fill="#2D2D2D" />
                <circle cx="19" cy="16" r="8" fill="#EB001B" opacity="0.9" />
                <circle cx="29" cy="16" r="8" fill="#F79E1B" opacity="0.9" />
              </svg>
              {/* PayPal */}
              <svg viewBox="0 0 48 32" className="h-7 w-auto" aria-label="PayPal">
                <rect width="48" height="32" rx="4" fill="#003087" />
                <text x="24" y="20" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">PayPal</text>
              </svg>
            </div>
          </div>

          {/* Language/Currency + Copyright */}
          <div className="border-t border-white/10 mt-4 pt-4 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <CurrencySelector />
            </div>
            <p className="text-xs text-gray-500 text-center">
              We only email you with your consent — you can unsubscribe at any time using the link in
              every email.
            </p>
            <p className="text-xs text-gray-500">
              &copy; {new Date().getFullYear()} Agever's. {t("footer.rights")}
            </p>
          </div>
        </div>
      </footer>

      {/* Modal */}
      <Dialog open={!!openModal} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{currentModal?.title}</DialogTitle>
            <DialogDescription className="text-gray-400 leading-relaxed pt-2 whitespace-pre-line">
              {currentModal?.body}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Footer;
