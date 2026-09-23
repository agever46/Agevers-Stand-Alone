import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// Recognizable crawlers only. Never match on a plain browser UA string —
// stock Chrome/Windows signatures are shared by millions of real visitors.
const BOT_UA_PATTERN = /bot|crawl|spider|slurp|headless|python-requests|Go-http-client|curl\/|Scrapy|facebookexternalhit|PhantomJS/i;

/**
 * Tracks every route navigation as a page view in the `page_views` table.
 * Skips admin routes (we don't want to pollute the analytics with our own clicks).
 */
const usePageTracking = () => {
  const location = useLocation();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    const fullPath = location.pathname + location.search;

    // Avoid duplicate logs for the same path (e.g., re-renders)
    if (lastPathRef.current === fullPath) return;
    lastPathRef.current = fullPath;

    // Skip admin & internal pages
    if (
      location.pathname.startsWith("/admin") ||
      location.pathname.startsWith("/seller") ||
      location.pathname === "/auth"
    ) {
      return;
    }

    const ua = navigator.userAgent;
    if (BOT_UA_PATTERN.test(ua)) {
      return;
    }

    // Fire-and-forget; never block UI
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await (supabase.from("page_views") as any).insert({
          page_path: fullPath,
          user_id: user?.id ?? null,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent.slice(0, 500),
        });
      } catch (e) {
        // Silent failure — analytics should never break the app
      }
    })();
  }, [location.pathname, location.search]);
};

export default usePageTracking;
