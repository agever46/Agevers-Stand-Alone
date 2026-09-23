import { Suspense, lazy, useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/hooks/useCart";
import { CurrencyProvider } from "@/hooks/useCurrency";
import { WishlistProvider } from "@/hooks/useWishlist";
import AgeversLoader from "@/components/AgeversLoader";
import EmailVerificationGuard from "@/components/EmailVerificationGuard";
import PhoneRequiredGuard from "@/components/PhoneRequiredGuard";
import ComingSoon from "@/components/ComingSoon";
import NewAccountLimitBanner from "@/components/NewAccountLimitBanner";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import usePageTracking from "@/hooks/usePageTracking";
import { useAchievementToasts } from "@/hooks/useAchievementToasts";
import { loadConsentedScripts } from "@/lib/consentScripts";

// Eagerly import the landing page so first paint doesn't wait for an extra chunk download
import Index from "./pages/Index.tsx";

// Retry wrapper for lazy imports — handles transient "Failed to fetch dynamically imported module"
// errors that happen when the dev server restarts or a chunk is briefly unavailable.
const lazyRetry = <T,>(factory: () => Promise<T>, retries = 2, delay = 500): Promise<T> =>
  factory().catch((err) => {
    if (retries <= 0) throw err;
    return new Promise((resolve) => setTimeout(resolve, delay)).then(() =>
      lazyRetry(factory, retries - 1, delay * 2)
    );
  });

// Defer non-critical chrome until after the first paint of the landing page
const CookieConsent = lazy(() => lazyRetry(() => import("@/components/CookieConsent")));
const PrivacyChoicesModal = lazy(() => lazyRetry(() => import("@/components/PrivacyChoicesModal")));
const HelpChatWidget = lazy(() => lazyRetry(() => import("@/components/HelpChatWidget")));
const ImportQueuePanel = lazy(() => lazyRetry(() => import("@/components/admin/ImportQueuePanel")));
const RecentPurchasePopup = lazy(() => lazyRetry(() => import("@/components/RecentPurchasePopup")));
const AdminLiveSupportNotifier = lazy(() => lazyRetry(() => import("@/components/AdminLiveSupportNotifier")));
const GiveawayPopup = lazy(() => lazyRetry(() => import("@/components/GiveawayPopup")));

const Auth = lazy(() => import("./pages/Auth.tsx"));
const VerifyOrder = lazy(() => import("./pages/VerifyOrder.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Account = lazy(() => import("./pages/Account.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const AdminSection = lazy(() => import("./pages/AdminSection.tsx"));

const Steam = lazy(() => import("./pages/Steam.tsx"));
const Gog = lazy(() => import("./pages/Gog.tsx"));
const EpicGames = lazy(() => import("./pages/EpicGames.tsx"));
const Blizzard = lazy(() => import("./pages/Blizzard.tsx"));
const EaGames = lazy(() => import("./pages/EaGames.tsx"));
const Rockstar = lazy(() => import("./pages/Rockstar.tsx"));
const Xbox = lazy(() => import("./pages/Xbox.tsx"));
const PlayStation = lazy(() => import("./pages/PlayStation.tsx"));
const Nintendo = lazy(() => import("./pages/Nintendo.tsx"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard.tsx"));
const Sell = lazy(() => import("./pages/Sell.tsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.tsx"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation.tsx"));
const ProductKeys = lazy(() => import("./pages/ProductKeys.tsx"));
const InGameItems = lazy(() => import("./pages/InGameItems.tsx"));
const Mobile = lazy(() => import("./pages/Mobile.tsx"));
const GiftCards = lazy(() => import("./pages/GiftCards.tsx"));
const MediaStreaming = lazy(() => import("./pages/MediaStreaming.tsx"));
const HelpCenter = lazy(() => import("./pages/HelpCenter.tsx"));
const OrderIssue = lazy(() => import("./pages/OrderIssue.tsx"));
const ContactUs = lazy(() => import("./pages/ContactUs.tsx"));
const FAQ = lazy(() => import("./pages/FAQ.tsx"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.tsx"));
const TermsOfService = lazy(() => import("./pages/TermsOfService.tsx"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy.tsx"));
const CookiePolicy = lazy(() => import("./pages/CookiePolicy.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const DynamicStorePage = lazy(() => import("./pages/DynamicStorePage.tsx"));
const Checkout = lazy(() => import("./pages/Checkout.tsx"));
const SearchResults = lazy(() => import("./pages/SearchResults.tsx"));
const Software = lazy(() => import("./pages/Software.tsx"));
const SoftwareWindows = lazy(() => import("./pages/SoftwareWindows.tsx"));
const SoftwareOffice = lazy(() => import("./pages/SoftwareOffice.tsx"));
const SoftwareAI = lazy(() => import("./pages/SoftwareAI.tsx"));
const SellerStore = lazy(() => import("./pages/SellerStore.tsx"));
const Games = lazy(() => import("./pages/Games.tsx"));
const GamePlay = lazy(() => import("./pages/GamePlay.tsx"));
const AboutUs = lazy(() => import("./pages/AboutUs.tsx"));
const PreOrder = lazy(() => import("./pages/PreOrder.tsx"));
const CollectionPage = lazy(() => import("./pages/CollectionPage.tsx"));
const PricingCalculator = lazy(() => import("./pages/PricingCalculator.tsx"));
const BusinessPortal = lazy(() => import("./pages/BusinessPortal.tsx"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe.tsx"));
const UnsubscribeMarketing = lazy(() => import("./pages/UnsubscribeMarketing.tsx"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail.tsx"));
const BlogHub = lazy(() => import("./pages/BlogHub.tsx"));
const BlogArticle = lazy(() => import("./pages/BlogArticle.tsx"));
const Guides = lazy(() => import("./pages/Guides.tsx"));
const GuideArticle = lazy(() => import("./pages/GuideArticle.tsx"));
const Bundles = lazy(() => import("./pages/Bundles.tsx"));
const Deals = lazy(() => import("./pages/Deals.tsx"));
const Suggestions = lazy(() => import("./pages/Suggestions.tsx"));
const News = lazy(() => import("./pages/News.tsx"));

const NewsCategory = lazy(() => import("./pages/NewsCategory.tsx"));
const NewsArticle = lazy(() => import("./pages/NewsArticle.tsx"));
const GameGroupPage = lazy(() => import("./pages/GameGroupPage.tsx"));
const Compare = lazy(() => import("./pages/Compare.tsx"));
const Giveaway = lazy(() => import("./pages/Giveaway.tsx"));
const AgeversVsG2A = lazy(() => import("./pages/compare/AgeversVsG2A.tsx"));
const AgeversVsCDKeys = lazy(() => import("./pages/compare/AgeversVsCDKeys.tsx"));
const AgeversVsEneba = lazy(() => import("./pages/compare/AgeversVsEneba.tsx"));
const AgeversVsDifmark = lazy(() => import("./pages/compare/AgeversVsDifmark.tsx"));
const FreeGift = lazy(() => import("./pages/FreeGift.tsx"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 minutes – avoid refetch on revisit
      gcTime: 10 * 60 * 1000,     // 10 minutes – keep in cache
      refetchOnWindowFocus: false, // don't refetch when tab regains focus
      retry: 1,                   // single retry on failure
    },
  },
});


const RouteFallback = () => (
  <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 gap-4">
    <AgeversLoader />
  </div>
);

const PageTracker = () => {
  usePageTracking();
  return null;
};

const AchievementToastListener = () => {
  useAchievementToasts();
  return null;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);
  return null;
};

// If the user lands anywhere with a password-recovery marker, redirect to the
// dedicated reset screen so /auth guards and existing sessions cannot hide it.
const RecoveryRedirect = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(window.location.search);
    const isRecoveryLink = hashParams.get("type") === "recovery" || searchParams.get("reset") === "true";
    if (isRecoveryLink && pathname !== "/reset-password") {
      window.location.replace(`/reset-password${window.location.search}${window.location.hash}`);
    }
  }, [pathname]);
  return null;
};

const AppInner = () => {
  const { maintenance, maintenanceUntil } = useMaintenanceMode();
  const [bypassed, setBypassed] = useState(false);
  // Bypass maintenance / loaders for crawlers and Lovable's preview screenshotter,
  // so workspace project tiles render a real screenshot instead of a blank page.
  const isCrawler = typeof navigator !== "undefined" && /bot|crawl|spider|lovable|headless|screenshot|preview|lighthouse|chrome-lighthouse|google|bing|facebookexternalhit|slurp|duckduck/i.test(navigator.userAgent || "");
  // Defer non-critical UI (chat widget, cookie banner, popups) until the browser is idle
  // so they don't compete with the first meaningful paint.
  const [showDeferredChrome, setShowDeferredChrome] = useState(false);

  useEffect(() => {
    const w = window as any;
    const schedule = w.requestIdleCallback || ((cb: () => void) => window.setTimeout(cb, 1500));
    const cancel = w.cancelIdleCallback || window.clearTimeout;
    const id = schedule(() => {
      setShowDeferredChrome(true);
      // Re-loads GA4/Reddit for a returning visitor who already chose
      // "Accept All" in a previous session — a no-op otherwise.
      loadConsentedScripts();
    });
    return () => cancel(id);
  }, []);

  // Don't block the initial render on the maintenance check — it almost always returns false.
  // If maintenance turns out to be enabled we'll swap to <ComingSoon /> on the next render.
  // Toaster/Sonner render even in this branch: ComingSoon's admin login form
  // calls toast.error/toast.success on every outcome, and without a mounted
  // toast portal those calls silently do nothing — an admin with a wrong
  // password (or a login rejected as non-admin) sees no feedback at all and
  // can't tell why nothing happened.
  if (maintenance === true && !bypassed && !isCrawler) {
    return (
      <>
        <Toaster />
        <Sonner />
        <ComingSoon onBypass={() => setBypassed(true)} until={maintenanceUntil} />
      </>
    );
  }

  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PageTracker />
        <AchievementToastListener />
        <ScrollToTop />
        <RecoveryRedirect />
        <a href="#main-content" className="skip-to-content">Skip to main content</a>
        <main id="main-content" className="relative">
          <NewAccountLimitBanner />
          <Suspense fallback={<RouteFallback />}>
            <EmailVerificationGuard>
            <PhoneRequiredGuard>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/callback" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/account" element={<Account />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/:section" element={<AdminSection />} />
              <Route path="/steam" element={<Steam />} />
              
              <Route path="/gog" element={<Gog />} />
              <Route path="/epic-games" element={<EpicGames />} />
              <Route path="/blizzard" element={<Blizzard />} />
              <Route path="/ea-games" element={<EaGames />} />
              <Route path="/rockstar" element={<Rockstar />} />
              <Route path="/xbox" element={<Xbox />} />
              <Route path="/playstation" element={<PlayStation />} />
              <Route path="/nintendo" element={<Nintendo />} />
              <Route path="/seller" element={<SellerDashboard />} />
              <Route path="/sell" element={<Sell />} />
              <Route path="/product/:id" element={<ProductDetail />} />
              <Route path="/order/:paypalOrderId" element={<OrderConfirmation />} />
              <Route path="/verify-order/:token" element={<VerifyOrder />} />
              <Route path="/product/:id/keys" element={<ProductKeys />} />
              <Route path="/in-game-items" element={<InGameItems />} />
              <Route path="/mobile" element={<Mobile />} />
              <Route path="/gift-cards" element={<GiftCards />} />
              <Route path="/media-streaming" element={<MediaStreaming />} />
              <Route path="/help-center" element={<HelpCenter />} />
              <Route path="/order-issue" element={<OrderIssue />} />
              <Route path="/contact" element={<ContactUs />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/software" element={<Software />} />
              <Route path="/software/windows" element={<SoftwareWindows />} />
              <Route path="/software/office" element={<SoftwareOffice />} />
              <Route path="/software/ai" element={<SoftwareAI />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/seller/:id" element={<SellerStore />} />
              <Route path="/games" element={<Games />} />
              <Route path="/games/:gameId" element={<GamePlay />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/pre-order" element={<PreOrder />} />
              <Route path="/collection/:slug" element={<CollectionPage />} />
              <Route path="/pricing-calculator" element={<PricingCalculator />} />
              <Route path="/business" element={<BusinessPortal />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/unsubscribe-marketing" element={<UnsubscribeMarketing />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/blog" element={<BlogHub />} />
              <Route path="/blog/:slug" element={<BlogArticle />} />

              <Route path="/guides" element={<Guides />} />
              <Route path="/guides/:slug" element={<GuideArticle />} />
              <Route path="/bundles" element={<Bundles />} />
              <Route path="/deals" element={<Deals />} />
              <Route path="/suggestions" element={<Suggestions />} />
              <Route path="/news" element={<News />} />
              <Route path="/news/category/:slug" element={<NewsCategory />} />
              <Route path="/news/:slug" element={<NewsArticle />} />
              <Route path="/game/:slug" element={<GameGroupPage />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/compare/agevers-vs-g2a" element={<AgeversVsG2A />} />
              <Route path="/compare/agevers-vs-cdkeys" element={<AgeversVsCDKeys />} />
              <Route path="/compare/agevers-vs-eneba" element={<AgeversVsEneba />} />
              <Route path="/compare/agevers-vs-difmark" element={<AgeversVsDifmark />} />
              <Route path="/giveaway" element={<Giveaway />} />
              <Route path="/free-gift" element={<FreeGift />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<DynamicStorePage />} />
            </Routes>
            </PhoneRequiredGuard>
            </EmailVerificationGuard>
          </Suspense>
          {showDeferredChrome && (
            <Suspense fallback={null}>
              <CookieConsent />
              <PrivacyChoicesModal />
              <HelpChatWidget />
              <RecentPurchasePopup />
              <AdminLiveSupportNotifier />
              <GiveawayPopup />
              <ImportQueuePanel />
            </Suspense>
          )}
        </main>
      </BrowserRouter>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CurrencyProvider>
        <CartProvider>
          <WishlistProvider>
            <AppInner />
          </WishlistProvider>
        </CartProvider>
      </CurrencyProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
