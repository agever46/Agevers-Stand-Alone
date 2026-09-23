import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CronJob = {
  jobid: number;
  jobname: string;
  schedule: string;
  command: string;
  active: boolean;
};

/**
 * Live view of cron.job, via the same admin_list_cron_jobs() RPC the Cron
 * Schedule Manager uses. Lets other admin panels describe a job's real
 * current schedule/active state instead of a hardcoded string that can
 * silently go stale the moment someone reschedules it.
 */
export function useCronJobs(pollMs = 30000) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_cron_jobs" as any);
    if (!error) setJobs((data ?? []) as CronJob[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  // Match by command text (the target function's URL) rather than jobname —
  // jobnames get a fresh suffix/jobid whenever a job is rescheduled, but the
  // function it calls doesn't change.
  const findByCommand = useCallback(
    (pattern: string) => jobs.find((j) => j.command.includes(pattern)),
    [jobs],
  );

  return { jobs, loading, load, findByCommand };
}
