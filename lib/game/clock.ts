/** The shift starts at 02:00. One real second of play is one minute on the station clock. */
export const SHIFT_START_MINUTES = 2 * 60;

export function clock(t: number): string {
  const total = Math.floor(SHIFT_START_MINUTES + t);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Parse "02:14" back to game minutes; undefined if it isn't a time. */
export function parseClock(s: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return undefined;
  return Number(m[1]) * 60 + Number(m[2]) - SHIFT_START_MINUTES;
}
