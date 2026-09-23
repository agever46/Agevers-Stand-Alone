// Loads/gates non-essential tracking scripts (GA4 + Google Ads + Reddit Pixel)
// behind the visitor's cookie-consent choice, instead of loading them
// unconditionally from index.html regardless of what CookieConsent.tsx
// records. Default is denied — nothing loads until the visitor explicitly
// picks "Accept All".
export const COOKIE_CONSENT_KEY = "agevers_cookie_consent";
export type CookieChoice = "all" | "necessary" | "none";

const GA_MEASUREMENT_ID = "G-FXG3SYBJ7Y";
const GA_ADS_ID = "AW-961504033";
const REDDIT_PIXEL_ID = "a2_jiuswg63rg7s";

let scriptsLoaded = false;

function injectGoogleTag() {
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);

  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  // MUST push the `arguments` object, not a real array — gtag.js ignores
  // plain arrays, which silently stopped every hit from being sent to GA4.
  function gtag(...args: any[]) {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments as unknown as any[]);
  }
  w.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID);
  gtag("config", GA_ADS_ID);
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
  if (scriptsLoaded || !hasTrackingConsent()) return;
  scriptsLoaded = true;
  injectGoogleTag();
  injectRedditPixel();
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
  if (choice === "all") loadConsentedScripts();
  // "necessary"/"none": scripts were never loaded (default-denied), so
  // there's nothing to tear down — reloading the page is what fully
  // reflects a downgrade from a previous "all" choice, same as any site
  // using this pattern.
}
