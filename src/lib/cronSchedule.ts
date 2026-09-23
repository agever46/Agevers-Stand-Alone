// Shared cron-schedule parsing/formatting so admin panels describe a job's
// real schedule (fetched live) instead of a hand-typed string that can drift
// out of sync the moment someone reschedules the job.

export const CRON_DAYS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export function describeSchedule(schedule: string): string {
  if (!schedule) return "—";
  if (/seconds?$/i.test(schedule)) return schedule;
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return schedule;
  const [m, h, dom, mon, dow] = parts;

  const everyMin = m.match(/^\*\/(\d+)$/);
  if (everyMin && h === "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${everyMin[1]} minutes`;
  }
  const everyHour = h.match(/^\*\/(\d+)$/);
  if (everyHour && dom === "*" && mon === "*" && dow === "*" && /^\d+$/.test(m)) {
    return `Every ${everyHour[1]} hours (at :${m.padStart(2, "0")})`;
  }
  if (m === "*" && h === "*") return "Every minute";
  if (h === "*" && dom === "*" && mon === "*" && dow === "*") return `Every hour at :${m.padStart(2, "0")}`;
  if (dom === "*" && mon === "*" && dow === "*" && /^\d+$/.test(h)) return `Daily at ${h.padStart(2, "0")}:${m.padStart(2, "0")} UTC`;
  if (dom === "*" && mon === "*" && dow !== "*" && /^\d+$/.test(h)) {
    const day = CRON_DAYS.find((d) => d.value === Number(dow))?.label ?? dow;
    return `Weekly (${day}) at ${h.padStart(2, "0")}:${m.padStart(2, "0")} UTC`;
  }
  const everyDom = dom.match(/^\*\/(\d+)$/);
  if (everyDom && mon === "*" && dow === "*" && /^\d+$/.test(h)) {
    return `Every ${everyDom[1]} days at ${h.padStart(2, "0")}:${m.padStart(2, "0")} UTC`;
  }
  return schedule;
}

/**
 * Seconds from `now` until this schedule next fires. Covers the patterns
 * actually used by this project's cron jobs (every-N-minutes, every-N-hours,
 * daily, weekly, every-N-days). Returns null for patterns it doesn't
 * recognize — callers should hide the countdown in that case rather than
 * show a wrong number.
 */
export function secondsUntilNextRun(schedule: string, now: Date = new Date()): number | null {
  if (!schedule) return null;
  if (/seconds?$/i.test(schedule)) return null;
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [mStr, hStr, dom, mon, dow] = parts;
  if (mon !== "*") return null;
  const nowMs = now.getTime();

  const everyMin = mStr.match(/^\*\/(\d+)$/);
  if (everyMin && hStr === "*" && dom === "*" && dow === "*") {
    const intervalMs = parseInt(everyMin[1], 10) * 60 * 1000;
    const next = Math.ceil((nowMs + 1000) / intervalMs) * intervalMs;
    return Math.round((next - nowMs) / 1000);
  }

  const everyHour = hStr.match(/^\*\/(\d+)$/);
  if (everyHour && dom === "*" && dow === "*" && /^\d+$/.test(mStr)) {
    const n = parseInt(everyHour[1], 10);
    const m = parseInt(mStr, 10);
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), m, 0, 0));
    while (next.getTime() <= nowMs || next.getUTCHours() % n !== 0) {
      next.setUTCHours(next.getUTCHours() + 1);
    }
    return Math.round((next.getTime() - nowMs) / 1000);
  }

  const everyDom = dom.match(/^\*\/(\d+)$/);
  if (everyDom && dow === "*" && /^\d+$/.test(mStr) && /^\d+$/.test(hStr)) {
    const n = parseInt(everyDom[1], 10);
    const m = parseInt(mStr, 10);
    const h = parseInt(hStr, 10);
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0, 0));
    while (next.getTime() <= nowMs || next.getUTCDate() % n !== 0) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return Math.round((next.getTime() - nowMs) / 1000);
  }

  if (mStr === "*" && hStr === "*" && dom === "*" && dow === "*") {
    const next = Math.ceil((nowMs + 1000) / 60000) * 60000;
    return Math.round((next - nowMs) / 1000);
  }

  if (/^\d+$/.test(mStr) && /^\d+$/.test(hStr) && dom === "*") {
    const m = parseInt(mStr, 10);
    const h = parseInt(hStr, 10);
    const targetDow = dow === "*" ? null : parseInt(dow, 10);
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0, 0));
    if (next.getTime() <= nowMs) next.setUTCDate(next.getUTCDate() + 1);
    if (targetDow !== null) {
      while (next.getUTCDay() !== targetDow) next.setUTCDate(next.getUTCDate() + 1);
    }
    return Math.round((next.getTime() - nowMs) / 1000);
  }

  return null;
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
