// Gates non-essential tracking behind the visitor's cookie-consent choice:
// Google tag runs in Consent Mode v2 (default denied); Reddit Pixel loads only after "Accept All".
export const COOKIE_CONSENT_KEY = "agevers_cookie_consent";
export type CookieChoice = "all" | "necessary" | "none";

const GA_MEASUREMENT_ID = "G-FXG3SYBJ7Y";
const GA_ADS_ID = "AW-961504033";
const REDDIT_PIXEL_ID = "a2_jiuswg63rg7s";

let googleTagInjected = false;
let redditLoaded = false;

function gtagFn() {
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  if (!w.gtag) {
    // MUST push the `arguments` object, not a real array — gtag.js ignores
    // plain arrays, which silently stopped every hit from being sent to GA4.
    w.gtag = function gtag(..._args: any[]) {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer.push(arguments as unknown as any[]);
    };
  }
  return w.gtag as (...args: any[]) => void;
}

// Google Consent Mode v2: the tag always loads, but with every storage type
// denied until the visitor accepts. While denied, Google receives only
// cookieless pings (no identifiers), which GA4/Ads use for modeled data.
// Previously the tag only loaded after "Accept All", so every visitor who
// picked "Necessary Only"/"Decline" or ignored the banner was invisible.
function injectGoogleTag() {
  if (googleTagInjected) return;
  googleTagInjected = true;
  const gtag = gtagFn();
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500,
  });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID);
  gtag("config", GA_ADS_ID);
}

function updateGoogleConsent(granted: boolean) {
  const v = granted ? "granted" : "denied";
  gtagFn()("consent", "update", {
    ad_storage: v,
    ad_user_data: v,
    ad_personalization: v,
    analytics_storage: v,
  });
}

function injectRedditPixel() {
  // Same snippet previously hardcoded in index.html — only the loading
  // condition changed, not the pixel ID or tracking behavior itself.
  const s = document.createElement("script");
  s.text = `!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js?pixel_id=${REDDIT_PIXEL_ID}",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);rdt('init','${REDDIT_PIXEL_ID}');rdt('track', 'PageVisit');`;
  document.head.appendChild(s);
}

export function hasTrackingConsent(): boolean {
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY) === "all";
  } catch {
    return false;
  }
}

// Call on every app load — a no-op unless the visitor previously chose
// "Accept All", in which case it re-loads the scripts for this page view.
export function loadConsentedScripts() {
  injectGoogleTag(); // always, default-denied (Consent Mode v2)
  if (!hasTrackingConsent()) return;
  updateGoogleConsent(true);
  if (!redditLoaded) {
    redditLoaded = true;
    injectRedditPixel();
  }
}

// GDPR proof-of-consent log: fire-and-forget insert, never blocks the UI.
function logConsentChoice(choice: CookieChoice) {
  import("@/integrations/supabase/client")
    .then(({ supabase }) =>
      supabase.from("cookie_consent_logs" as never).insert({
        choice,
        user_agent: navigator.userAgent.slice(0, 300),
      } as never)
    )
    .catch(() => {
      /* logging must never break consent handling */
    });
}

// Call when the visitor makes (or changes) a choice in the cookie banner.
export function applyConsentChoice(choice: CookieChoice) {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice);
  } catch {
    /* ignore */
  }
  logConsentChoice(choice);
  injectGoogleTag();
  updateGoogleConsent(choice === "all");
  if (choice === "all") loadConsentedScripts();
  // "necessary"/"none": scripts were never loaded (default-denied), so
  // there's nothing to tear down — reloading the page is what fully
  // reflects a downgrade from a previous "all" choice, same as any site
  // using this pattern.
}
