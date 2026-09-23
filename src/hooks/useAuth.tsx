import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs = 4000): Promise<T> => {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error("Auth request timed out")), timeoutMs);
    }),
  ]);
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRestoredRef = useRef(false);
  const handoffProcessedRef = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (sessionRestoredRef.current) {
          setLoading(false);
        }
      }
    );

    const checkBlocked = async () => {
      try {
        const res: any = await withTimeout(Promise.resolve((supabase.rpc as any)("get_my_block_status")));
        const data = res?.data;
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.is_blocked) {
          await supabase.auth.signOut();
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    };

    const guardInterval = setInterval(async () => {
      try {
        const { data: { session: s } } = await withTimeout(supabase.auth.getSession());
        if (!s) return;

        const { error } = await withTimeout(supabase.auth.getUser());
        if (error) {
          await supabase.auth.signOut();
          return;
        }

        await checkBlocked();
      } catch {
        // Ignore preview/auth proxy failures so the app stays usable.
      }
    }, 30_000);

    const restoreSession = async () => {
      try {
        const handoffPrefix = "#session-handoff=";
        const hasHandoff = window.location.hash.startsWith(handoffPrefix);

        if (hasHandoff && !handoffProcessedRef.current) {
          handoffProcessedRef.current = true;
          const handoffPayload = decodeURIComponent(window.location.hash.slice(handoffPrefix.length));
          const params = new URLSearchParams(handoffPayload);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");

          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);

          if (access_token && refresh_token) {
            const { data, error } = await withTimeout(
              supabase.auth.setSession({
                access_token,
                refresh_token,
              })
            );
            
            console.log("[useAuth] setSession result:", { data, error });

            if (!error && data.session) {
              setUser(data.session.user);
              sessionRestoredRef.current = true;
              setLoading(false);
              return;
            }
          }
        }

        const { data: { session } } = await withTimeout(supabase.auth.getSession());
        setUser(session?.user ?? null);
        if (session?.user) {
          const blocked = await checkBlocked();
          if (blocked) setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        sessionRestoredRef.current = true;
        setLoading(false);
      }
    };

    void restoreSession();

    return () => {
      subscription.unsubscribe();
      clearInterval(guardInterval);
    };
  }, []); // Re-run effect only on mount

  // Watch for session changes in a separate effect that runs more reliably
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[useAuth] Auth state changed:", event, session?.user?.id);
      
      // Force immediate update of user state
      if (session?.user) {
        setUser({ ...session.user });
      } else {
        setUser(null);
      }
      
      // Also ensure loading is cleared
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      setUser(null);
    }
  };

  return { user, loading, signOut };
};
