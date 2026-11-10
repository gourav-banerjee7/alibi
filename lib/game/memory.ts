import { clock } from "./clock";
import { CAMERA_ROOMS, isRoom, locationName } from "./map";
import { byId } from "./rules";
import type { Claim, GameState, LocationId, Segment } from "./types";

/** One stretch of time someone spent in one place, and who they saw there. */
export interface Recollection {
  loc: LocationId;
  from: number;
  to: number;
  saw: string[];
  /** Seen on a security camera feed rather than in person. */
  camera?: boolean;
}

const MIN_SIGHTING = 0.4; // minutes of overlap before you "saw" someone

function clip(s: Segment, from: number, to: number, now: number) {
  const a = Math.max(s.from, from);
  const b = Math.min(s.to ?? now, to);
  return b > a ? { a, b } : undefined;
}

/** What `who` actually experienced between from..to: places, and the people present. */
export function recollect(state: GameState, who: string, from: number, to: number): Recollection[] {
  const mine = state.segments.filter((s) => s.who === who);
  const out: Recollection[] = [];
  for (const s of mine) {
    const w = clip(s, from, to, state.t);
    if (!w) continue;
    const saw = new Set<string>();
    for (const o of state.segments) {
      if (o.who === who || o.loc !== s.loc) continue;
      const ow = clip(o, w.a, w.b, state.t);
      if (ow && ow.b - ow.a >= MIN_SIGHTING) saw.add(o.who);
    }
    out.push({ loc: s.loc, from: w.a, to: w.b, saw: [...saw] });
  }
  return mergeShortHops(out);
}

/** Fold quick corridor transits into the surrounding rooms so memories read naturally. */
function mergeShortHops(items: Recollection[]): Recollection[] {
  const out: Recollection[] = [];
  for (const r of items) {
    if (!isRoom(r.loc) && r.to - r.from < 1.5 && r.saw.length === 0) continue;
    const last = out[out.length - 1];
    if (last && last.loc === r.loc) {
      last.to = r.to;
      last.saw = [...new Set([...last.saw, ...r.saw])];
    } else out.push({ ...r, saw: [...r.saw] });
  }
  return out;
}

/** What `who` saw on the camera feeds between from..to: one recollection per camera room per sitting. */
/** Stretches of time when the cameras were dark because of a blackout. */
function darkWindows(state: GameState): Array<[number, number]> {
  return state.sabotageLog.filter((r) => r.kind === "blackout").map((r) => [r.from, r.to ?? state.t]);
}

/** [a,b] with the blackout windows cut out. */
function litPieces(state: GameState, a: number, b: number): Array<[number, number]> {
  let pieces: Array<[number, number]> = [[a, b]];
  for (const [da, db] of darkWindows(state)) {
    pieces = pieces.flatMap(([x, y]): Array<[number, number]> => {
      if (db <= x || da >= y) return [[x, y]];
      const out: Array<[number, number]> = [];
      if (da > x) out.push([x, da]);
      if (db < y) out.push([db, y]);
      return out;
    });
  }
  return pieces;
}

export function cameraRecollections(state: GameState, who: string, from: number, to: number): Recollection[] {
  const out: Recollection[] = [];
  for (const sess of state.camSessions) {
    if (sess.who !== who) continue;
    const a0 = Math.max(sess.from, from);
    const b0 = Math.min(sess.to ?? state.t, to);
    for (const [a, b] of litPieces(state, a0, b0)) {
    if (b - a < 0.3) continue;
    for (const room of CAMERA_ROOMS) {
      const saw = new Set<string>();
      for (const o of state.segments) {
        if (o.who === who || o.loc !== room) continue;
        const ow = clip(o, a, b, state.t);
        if (ow && ow.b - ow.a >= MIN_SIGHTING) saw.add(o.who);
      }
      out.push({ loc: room, from: a, to: b, saw: [...saw], camera: true });
    }
    }
  }
  return out;
}

/** Everything `who` could vouch for: what they saw in person plus what they saw on camera. */
export function observe(state: GameState, who: string, from: number, to: number): Recollection[] {
  return [...recollect(state, who, from, to), ...cameraRecollections(state, who, from, to)];
}

/** Kills that `who` watched happen on a camera feed. */
export function killsSeenOnCamera(state: GameState, who: string) {
  return state.kills.filter(
    (k) =>
      k.killer !== who &&
      CAMERA_ROOMS.includes(k.loc as (typeof CAMERA_ROOMS)[number]) &&
      !darkWindows(state).some(([a, b]) => k.t >= a && k.t <= b) &&
      state.camSessions.some((s) => s.who === who && s.from <= k.t && (s.to ?? state.t) >= k.t),
  );
}

export function describeRecollection(state: GameState, r: Recollection): string {
  const names = r.saw.map((id) => byId(state, id).name);
  const company = names.length > 0 ? `saw ${names.join(", ")}` : "alone";
  return `${clock(r.from)}–${clock(r.to)} ${locationName(r.loc)} (${company})`;
}

export function claimsOf(recs: Recollection[]): Claim[] {
  return recs.filter((r) => isRoom(r.loc) && r.to - r.from >= 1).map((r) => ({ loc: r.loc, from: r.from, to: r.to }));
}

/** Was `who` really in `loc` for most of the claimed window? */
export function claimIsTrue(state: GameState, who: string, c: Claim): boolean {
  const span = Math.max(0.5, c.to - c.from);
  let inside = 0;
  for (const s of state.segments) {
    if (s.who !== who || s.loc !== c.loc) continue;
    const w = clip(s, c.from, c.to, state.t);
    if (w) inside += w.b - w.a;
  }
  return inside / span >= 0.5;
}

/** The latest moment `observer` saw `target` alive before time t, if any. */
export function lastSighting(state: GameState, observer: string, target: string, before: number) {
  let best: { loc: LocationId; t: number } | undefined;
  for (const r of recollect(state, observer, state.roundStart, before)) {
    if (!r.saw.includes(target)) continue;
    // The moment they were last together: the end of the target's overlapping stay, not the observer's.
    for (const s of state.segments) {
      if (s.who !== target || s.loc !== r.loc) continue;
      const w = clip(s, r.from, r.to, state.t);
      if (w && w.b - w.a >= MIN_SIGHTING && (!best || w.b > best.t)) best = { loc: r.loc, t: w.b };
    }
  }
  return best;
}

/**
 * A cover story for the killer: the true path, but with the stretch around each kill
 * moved to a room where nobody else was at the time, so no one can contradict it.
 */
export function coverStory(state: GameState, killer: string, from: number, to: number): Claim[] {
  const kills = state.kills.filter((k) => k.killer === killer && k.t >= from && k.t <= to);
  const truth = recollect(state, killer, from, to);
  const story: Claim[] = [];
  for (const r of truth) {
    // Hide where the killer was around each kill, including following the victim just before.
    const tainted = kills.some((k) => (k.t >= r.from - 1 && k.t <= r.to + 1) || (r.saw.includes(k.victim) && r.to >= k.t - 4 && r.from <= k.t));
    if (!tainted) {
      if (isRoom(r.loc) && r.to - r.from >= 1) story.push({ loc: r.loc, from: r.from, to: r.to });
      continue;
    }
    const empty = emptyRoomDuring(state, r.from, r.to, killer);
    if (empty) story.push({ loc: empty, from: r.from, to: r.to });
  }
  return mergeClaims(story);
}

function emptyRoomDuring(state: GameState, from: number, to: number, except: string): LocationId | undefined {
  const rooms: LocationId[] = ["hydro", "medbay", "comms", "lab", "dock", "reactor"];
  return rooms.find((loc) =>
    state.segments.every((s) => s.who === except || s.loc !== loc || !clip(s, from, to, state.t)),
  );
}

function mergeClaims(claims: Claim[]): Claim[] {
  const out: Claim[] = [];
  for (const c of claims) {
    const last = out[out.length - 1];
    if (last && last.loc === c.loc && c.from - last.to < 2) last.to = c.to;
    else out.push({ ...c });
  }
  return out;
}

export function describeClaim(c: Claim): string {
  return `${locationName(c.loc)} ${clock(c.from)}–${clock(c.to)}`;
}
