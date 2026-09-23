import { useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StorePage from "@/components/StorePage";
import AgeversLoader from "@/components/AgeversLoader";

/**
 * Catches any route not explicitly defined and checks if a matching
 * nav_menu_item exists in the database. If found, renders a StorePage
 * with the item's name. Otherwise redirects to 404.
 */
const DynamicStorePage = () => {
  const location = useLocation();
  const [state, setState] = useState<"loading" | "found" | "not-found">("loading");
  const [storeName, setStoreName] = useState("");

  useEffect(() => {
    const path = location.pathname; // e.g. "/microsoft-store"
    let cancelled = false;
    (async () => {
      setState("loading");
      // Retry transient network/backend failures before showing a 404 —
      // a failed request must not look like "page does not exist".
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await supabase
          .from("nav_menu_items")
          .select("name")
          .eq("href", path)
          .eq("is_visible", true)
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (data) {
          setStoreName(data.name);
          setState("found");
          return;
        }
        if (!error) {
          setState("not-found");
          return;
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
      if (!cancelled) setState("not-found");
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AgeversLoader />
      </div>
    );
  }

  if (state === "not-found") {
    return <Navigate to="/404" replace />;
  }

  const PHYSICAL_CATEGORIES = ["Gaming Accessories"];
  const isPhysical = PHYSICAL_CATEGORIES.some(
    (c) => storeName.toLowerCase() === c.toLowerCase()
  );

  return (
    <StorePage
      storeName={storeName}
      description={
        isPhysical
          ? `Browse ${storeName} – controllers, headsets, and more`
          : `Browse ${storeName} game codes, keys, and gift cards`
      }
      autoTabs={!isPhysical}
      categories={isPhysical ? [] : undefined}
      autoGroupPage={isPhysical ? storeName : undefined}
    />
  );
};

export default DynamicStorePage;
