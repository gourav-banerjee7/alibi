/**
 * In-memory limits, per server instance. On Vercel each warm function instance keeps its own
 * counters, so treat these as a brake, not an exact quota. The hard money guard is using a
 * Gemini key on a project with no billing attached (free tier simply stops at its quota).
 */
export interface Limits {
  perIpPerMinute: number;
  perDay: number;
}

const ipHits = new Map<string, number[]>();
let day = "";
let dayCount = 0;

export function checkLimits(ip: string, limits: Limits, now = Date.now()): { ok: true } | { ok: false; reason: string } {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  if (dayCount >= limits.perDay) return { ok: false, reason: "daily limit reached" };

  const windowStart = now - 60_000;
  const hits = (ipHits.get(ip) ?? []).filter((t) => t > windowStart);
  if (hits.length >= limits.perIpPerMinute) {
    ipHits.set(ip, hits);
    return { ok: false, reason: "slow down" };
  }
  hits.push(now);
  ipHits.set(ip, hits);
  dayCount++;

  // Keep the map from growing forever on a long-lived instance.
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits) if (v.every((t) => t <= windowStart)) ipHits.delete(k);
  }
  return { ok: true };
}

export function resetLimitsForTests() {
  ipHits.clear();
  day = "";
  dayCount = 0;
}
