import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { NEW_ACCOUNT_LIMIT_REFRESH_EVENT, NEW_ACCOUNT_LIMIT_EUR } from "@/hooks/useNewAccountLimit";

const DISMISS_KEY = "agevers_new_account_banner_dismissed";

const NewAccountLimitBanner = () => {
  const { user } = useAuth();
  const bannerRef = useRef<HTMLDivElement>(null);
  const [hoursLeft, setHoursLeft] = useState<number | null>(null);
  const [minutesLeft, setMinutesLeft] = useState<number>(0);
  const [exempt, setExempt] = useState<boolean>(false);
  const [cap, setCap] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState(true);
  // ID of the user the exemption check has completed for. The banner is only
  // eligible to show once this matches the current user — prevents a one-frame
  // flash where state from the "no user yet" phase (check done, exempt=false)
  // briefly marks a logged-in user as limited before the fetch resolves.
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
  
  useEffect(() => {
    if (user?.id) {
      try { 
        setDismissed(sessionStorage.getItem(`${DISMISS_KEY}_${user.id}`) === "1"); 
      } catch { 
        setDismissed(false); 
      }
    }
  }, [user?.id]);

  // Track the effective user to handle async updates
  const [effectiveUser, setEffectiveUser] = useState(user);

  useEffect(() => {
    if (user) {
      setEffectiveUser(user);
      setAuthLoading(false);
    } else {
      // If no user after a small timeout, assume not logged in
      const timer = setTimeout(() => setAuthLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  useEffect(() => {
    if (!effectiveUser?.id) {
      setExempt(false);
      setCheckedFor(null);
      return;
    }

    const userId = effectiveUser.id;
    const checkExempt = async () => {
      const { data, error } = await supabase
        .from("fraud_scores")
        .select("new_account_limit_exempt, new_account_limit_cap")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        setExempt(!!(data as any).new_account_limit_exempt);
        setCap((data as any).new_account_limit_cap ?? null);
      }
      setCheckedFor(userId);
    };
    
    checkExempt();
    window.addEventListener(NEW_ACCOUNT_LIMIT_REFRESH_EVENT, checkExempt);
    return () => window.removeEventListener(NEW_ACCOUNT_LIMIT_REFRESH_EVENT, checkExempt);
  }, [effectiveUser?.id]);

  useEffect(() => {
    if (!effectiveUser) {
      setHoursLeft(null);
      setMinutesLeft(0);
      return;
    }

    const timestamp = effectiveUser.created_at || 
                      (effectiveUser as any).confirmed_at || 
                      effectiveUser.email_confirmed_at || 
                      effectiveUser.last_sign_in_at ||
                      (effectiveUser.user_metadata as any)?.email_verified_at;
    
    if (!timestamp) return;
    
    const update = () => {
      const createdTime = new Date(timestamp).getTime();
      const unlockAt = createdTime + 24 * 60 * 60 * 1000;
      const remainingMs = unlockAt - Date.now();
      
      if (remainingMs <= 0) {
        setHoursLeft(0);
        setMinutesLeft(0);
        return;
      }
      
      setHoursLeft(Math.floor(remainingMs / (60 * 60 * 1000)));
      setMinutesLeft(Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000)));
    };
    
    update();
    const interval = setInterval(update, 10_000);
    return () => clearInterval(interval);
  }, [effectiveUser]);

  // Only considered "within 24h" once the countdown has actually computed a
  // positive remaining time — a null countdown (not computed yet) must not
  // count as within the window, or the banner flashes on first paint.
  const isWithin24h = hoursLeft !== null && (hoursLeft > 0 || minutesLeft > 0);
  const isVisible = Boolean(
    !authLoading &&
    effectiveUser &&
    checkedFor === effectiveUser.id &&
    !dismissed &&
    !exempt &&
    isWithin24h
  );

  useEffect(() => {
    const root = document.documentElement;
    if (!isVisible || !bannerRef.current) {
      root.style.removeProperty("--new-account-banner-height");
      return;
    }

    const updateHeight = () => {
      if (bannerRef.current) {
        root.style.setProperty("--new-account-banner-height", `${bannerRef.current.offsetHeight}px`);
      }
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(bannerRef.current);

    return () => {
      observer.disconnect();
      root.style.removeProperty("--new-account-banner-height");
    };
  }, [isVisible]);

  const handleDismiss = () => {
    setDismissed(true);
    if (effectiveUser?.id) {
      try { sessionStorage.setItem(`${DISMISS_KEY}_${effectiveUser.id}`, "1"); } catch { return; }
    }
  };

  return (
    <div 
      ref={bannerRef} 
      style={{ display: isVisible ? 'block' : 'none' }}
      className="fixed top-0 left-0 right-0 z-[2147483647] bg-yellow-100 border-b border-yellow-200 text-yellow-900 shadow-xl"
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 text-xs sm:text-sm">
        <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-yellow-900 leading-tight">
            <strong className="font-display">Account Security Limit:</strong> As a new member, your cart is limited to a total of €{cap ?? NEW_ACCOUNT_LIMIT_EUR} for your first 24 hours to ensure account safety. Full access will be unlocked in{" "}
            <span className="underline decoration-2">
              {hoursLeft !== null && hoursLeft > 0 ? `${hoursLeft} hours and ${minutesLeft} minutes` : `${minutesLeft} minutes`}
            </span>
            .{" "}
            <Link to="/contact" className="underline font-black hover:text-yellow-700">Need help?</Link>
          </p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="shrink-0 p-2 rounded-full hover:bg-yellow-200 transition-colors"
        >
          <X className="h-5 w-5 text-yellow-600" />
        </button>
      </div>
    </div>
  );
};

export default NewAccountLimitBanner;
