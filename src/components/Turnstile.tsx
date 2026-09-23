import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TURNSTILE_SITE_KEY = "0x4AAAAAAC0o-III3Bkww0L5";

declare global {
  interface Window {
    turnstile?: any;
    onTurnstileLoad?: () => void;
  }
}

interface TurnstileProps {
  onToken: (token: string | null) => void;
  theme?: "light" | "dark" | "auto";
  className?: string;
}

export const TurnstileWidget = ({ onToken, theme = "light", className }: TurnstileProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const render = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;
    if (widgetId.current) {
      try { window.turnstile.remove(widgetId.current); } catch {}
      widgetId.current = null;
    }
    widgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => onToken(token),
      "expired-callback": () => onToken(null),
      "error-callback": () => onToken(null),
      theme,
      size: "flexible",
    });
  }, [onToken, theme]);

  useEffect(() => {
    if (!document.getElementById("cf-turnstile-script")) {
      const script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
      script.async = true;
      document.head.appendChild(script);
    }
    const tryRender = () => { if (window.turnstile) render(); };
    const prevOnload = window.onTurnstileLoad;
    window.onTurnstileLoad = () => { prevOnload?.(); tryRender(); };
    tryRender();
    return () => {
      if (widgetId.current) {
        try { window.turnstile?.remove(widgetId.current); } catch {}
        widgetId.current = null;
      }
    };
  }, [render]);

  return <div ref={containerRef} className={className} />;
};

/** Verifies a Turnstile token server-side via the turnstile-verify edge function. */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("turnstile-verify", {
      body: { token },
    });
    return !error && !!data?.success;
  } catch {
    return false;
  }
}
