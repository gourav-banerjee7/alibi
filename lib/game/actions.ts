import { clock } from "./clock";
import { byId, checkWin, player } from "./rules";
import { startNextRound } from "./sim";
import type { GameState, MeetingRecord, PactKind } from "./types";

export type PactDecision = PactKind | "refused";

/** Resolve a pact conversation. `from` offered it to `to`. */
export function resolvePact(state: GameState, from: string, to: string, decision: PactDecision, sincere = true) {
  const offerer = byId(state, from);
  const partner = byId(state, to);
  state.pactOffers.push({
    from,
    to,
    t: state.t,
    outcome: decision === "refused" ? "refused" : decision === "vouch" ? "accepted-vouch" : "accepted-swap",
  });

  if (decision === "vouch") {
    state.pacts.push({ kind: "vouch", killer: offerer.id, partner: partner.id, t: state.t, sincere, broken: false });
    state.log.push(`${clock(state.t)} ${partner.name} agreed to vouch for ${offerer.name}.`);
  } else if (decision === "swap") {
    state.pacts.push({ kind: "swap", killer: offerer.id, partner: partner.id, t: state.t, sincere, broken: false });
    if (sincere) {
      offerer.role = "accomplice";
      partner.role = "killer";
      partner.killCooldownUntil = state.t + 8;
      offerer.huntTarget = undefined;
      state.log.push(`${clock(state.t)} ${partner.name} took over as the killer. ${offerer.name} is now their accomplice.`);
    } else {
      state.log.push(`${clock(state.t)} ${partner.name} pretended to take the knife from ${offerer.name}.`);
    }
  } else {
    state.log.push(`${clock(state.t)} ${partner.name} refused ${offerer.name}'s pact.`);
  }

  // The offering AI killer resets its kill timer so it doesn't strike the instant the dialog closes.
  if (!offerer.isPlayer && offerer.role === "killer") offerer.killCooldownUntil = Math.max(offerer.killCooldownUntil, state.t + 6);
  state.pending = undefined;
  state.phase = "roam";
}

/** Apply votes, eject, check for a winner, and start the next round if the game goes on. */
/** Plurality wins; a tie or a skip majority ejects no one. */
export function tallyVotes(votes: Record<string, string>): { counts: Array<[string, number]>; ejected?: string } {
  const tally = new Map<string, number>();
  for (const v of Object.values(votes)) tally.set(v, (tally.get(v) ?? 0) + 1);
  const counts = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const [top, second] = counts;
  const ejected = top && top[0] !== "skip" && (!second || top[1] > second[1]) ? top[0] : undefined;
  return { counts, ejected };
}

export function finishMeeting(state: GameState, record: MeetingRecord) {
  const { ejected } = tallyVotes(record.votes);
  if (ejected) {
    record.ejected = ejected;
    const c = byId(state, ejected);
    c.alive = false;
    c.ejected = true;
  }

  // Voting against your own pact partner breaks the pact.
  const yourVote = record.votes["you"];
  for (const p of state.pacts) {
    if (!p.broken && p.partner === "you" && yourVote === p.killer) p.broken = true;
    if (!p.broken && p.killer === "you" && record.votes[p.partner] === "you") p.broken = true;
  }

  state.meetings.push(record);
  state.pending = undefined;
  if (!checkWin(state, true)) startNextRound(state);
}

export function playerRoleLine(state: GameState): string {
  const you = player(state);
  if (you.role === "killer") {
    const partners = state.pacts.filter((p) => p.killer === "you" && !p.broken).map((p) => byId(state, p.partner).name);
    return partners.length > 0 ? `Killer. ${partners.join(" and ")} agreed to cover for you.` : "Killer. Don't get caught.";
  }
  if (you.role === "accomplice") {
    const k = state.characters.find((c) => c.role === "killer");
    return `Accomplice. ${k?.name ?? "The killer"} holds the knife now. Keep them safe.`;
  }
  const pact = state.pacts.find((p) => p.partner === "you" && p.kind === "vouch" && !p.broken);
  if (pact) return `Crew, in a secret pact with ${byId(state, pact.killer).name}. You win if they get away.`;
  return "Crew. Find the killer before the storm clears.";
}
