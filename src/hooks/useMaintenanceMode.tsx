import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useMaintenanceMode = () => {
  const [maintenance, setMaintenance] = useState<boolean | null>(null);
  const [maintenanceUntil, setMaintenanceUntil] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const res = await (supabase.rpc("get_public_site_flags" as any) as any);
      const { data } = res;
      if (!active) return;
      // 402 = Supabase has restricted the project (quota). The whole backend is
      // unavailable, so show the maintenance screen instead of a broken shop.
      if (res.status === 402 || /restricted due to/i.test(res.error?.message || "")) {
        setMaintenanceUntil(null);
        setMaintenance(true);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      const until: string | null = row?.maintenance_until ?? null;
      const expired = !!until && new Date(until).getTime() <= Date.now();
      setMaintenanceUntil(expired ? null : until);
      setMaintenance((row?.maintenance_mode ?? false) && !expired);
    };
    load();
    const interval = setInterval(load, 60000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  // durationMinutes: optional planned duration when turning maintenance ON
  const toggle = async (durationMinutes?: number | null) => {
    const newVal = !maintenance;
    const until =
      newVal && durationMinutes
        ? new Date(Date.now() + durationMinutes * 60_000).toISOString()
        : null;
    await (supabase
      .from("site_settings" as any)
      .update({ maintenance_mode: newVal, maintenance_until: until, updated_at: new Date().toISOString() })
      .eq("id", 1) as any);
    setMaintenance(newVal);
    setMaintenanceUntil(until);
    return newVal;
  };

  return { maintenance, maintenanceUntil, toggle };
};
