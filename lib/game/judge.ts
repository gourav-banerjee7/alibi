import { clock } from "./clock";
import { locationName, PLACE_WORDS } from "./map";
import { claimIsTrue, recollect } from "./memory";
import { byId } from "./rules";
import type { Claim, GameState, LocationId, TranscriptLine } from "./types";

/**
 * Things `observer` can prove are wrong about `speaker`'s claims, from their own memory.
 * This is what makes accusations grounded: the sim knows who was where, so agents only
 * "notice" contradictions they could actually have seen.
 */
export interface Contradiction {
  kind: "absent" | "elsewhere";
  claim: Claim;
  /** Overlap window where the observer could check. */
  from: number;
  to: number;
  /** Where the observer actually saw the speaker ("elsewhere"). */
  seenIn?: LocationId;
}

/** How many minutes `who` really spent in `loc` between from..to. */
export function minutesIn(state: GameState, who: string, loc: LocationId, from: number, to: number): number {
  let total = 0;
  for (const s of state.segments) {
    if (s.who !== who || s.loc !== loc) continue;
    const a = Math.max(s.from, from);
    const b = Math.min(s.to ?? state.t, to);
    if (b > a) total += b - a;
  }
  return total;
}

export function findContradictions(state: GameState, observer: string, speaker: string, claims: Claim[]): Contradiction[] {
  if (observer === speaker) return [];
  const mem = recollect(state, observer, state.roundStart, state.t);
  const out: Contradiction[] = [];
  const seen = new Set<string>();
  for (const c of claims) {
    for (const r of mem) {
      const a = Math.max(c.from, r.from);
      const b = Math.min(c.to, r.to);
      if (b - a < 1.5) continue;
      // Check presence inside the overlapping minutes only, not anywhere in the observer's stay.
      const speakerHere = minutesIn(state, speaker, r.loc, a, b);
      let found: Contradiction | undefined;
      if (r.loc === c.loc && speakerHere < 0.4) found = { kind: "absent", claim: c, from: a, to: b };
      else if (r.loc !== c.loc && speakerHere >= 1 && minutesIn(state, speaker, c.loc, a, b) < 0.4) {
        found = { kind: "elsewhere", claim: c, from: a, to: b, seenIn: r.loc };
      }
      const key = found && `${found.kind}${found.claim.loc}${found.seenIn}`;
      if (found && key && !seen.has(key)) {
        seen.add(key);
        out.push(found);
      }
    }
  }
  return out;
}

/** Third-person phrasing, for the model's "things you noticed". */
export function contradictionsFor(state: GameState, observer: string, speaker: string, claims: Claim[]): string[] {
  const name = byId(state, speaker).name;
  return findContradictions(state, observer, speaker, claims).map((x) =>
    x.kind === "absent"
      ? `${name} says they were in ${locationName(x.claim.loc)} ${clock(x.claim.from)}–${clock(x.claim.to)}, but you were there ${clock(x.from)}–${clock(x.to)} and did not see them.`
      : `${name} says they were in ${locationName(x.claim.loc)} around ${clock(x.from)}, but you saw them in ${locationName(x.seenIn!)} then.`,
  );
}

/** First-person challenge, for the scripted voice: "Mara, you said ... but I ...". */
export function confront(state: GameState, observer: string, speaker: string, claims: Claim[]): string | undefined {
  const x = findContradictions(state, observer, speaker, claims)[0];
  if (!x) return undefined;
  const name = byId(state, speaker).name;
  return x.kind === "absent"
    ? `${name}, you said you were in ${locationName(x.claim.loc)}, but I was there from ${clock(x.from)} to ${clock(x.to)} and never saw you.`
    : `${name}, you said ${locationName(x.claim.loc)}, but I saw you in ${locationName(x.seenIn!)} around ${clock(x.from)}.`;
}

/** Places a piece of text mentions, by any of their names. */
export function placesMentioned(text: string): LocationId[] {
  const lower = text.toLowerCase();
  const found: LocationId[] = [];
  for (const { loc, words } of PLACE_WORDS) {
    if (words.some((w) => new RegExp(`\\b${w}\\b`).test(lower))) found.push(loc);
  }
  return found;
}

/**
 * An innocent crew member's opening statement must only place them where they really were.
 * Returns false when the model invented a location, so the caller can fall back.
 */
export function statementIsConsistent(state: GameState, speaker: string, text: string, allowed: LocationId[]): boolean {
  const visited = new Set(recollect(state, speaker, state.roundStart, state.t).map((r) => r.loc));
  for (const a of allowed) visited.add(a);
  return placesMentioned(text).every((loc) => visited.has(loc));
}

/** For the end screen: which claimed alibis were lies. */
export function auditTranscript(state: GameState, lines: TranscriptLine[]) {
  return lines.map((line) => ({
    line,
    lies: (line.claims ?? []).filter((c) => !claimIsTrue(state, line.speaker, c)),
  }));
}
