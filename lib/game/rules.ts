import { MAX_MEETINGS } from "./setup";
import type { Character, GameState, Side } from "./types";

export const byId = (state: GameState, id: string): Character => {
  const c = state.characters.find((x) => x.id === id);
  if (!c) throw new Error(`no character ${id}`);
  return c;
};

export const player = (state: GameState) => byId(state, "you");

export const currentKiller = (state: GameState) => state.characters.find((c) => c.role === "killer");

/** Active pacts: not broken, and the partner is genuinely on the killer's side. */
export function activePacts(state: GameState) {
  return state.pacts.filter((p) => !p.broken && p.sincere);
}

/** Which side someone is really on right now. */
export function sideOf(state: GameState, id: string): Side {
  const c = byId(state, id);
  if (c.role === "killer" || c.role === "accomplice") return "killer";
  if (activePacts(state).some((p) => p.partner === id && p.kind === "vouch")) return "killer";
  return "crew";
}

/** Characters the killer must not harm: accomplices and anyone in an active pact with them. */
export function alliesOfKiller(state: GameState): Set<string> {
  const allies = new Set<string>();
  for (const c of state.characters) if (c.role === "accomplice") allies.add(c.id);
  for (const p of activePacts(state)) allies.add(p.partner);
  return allies;
}

export const aliveChars = (state: GameState) => state.characters.filter((c) => c.alive);

/** Sets winner/endReason when the game is decided. Returns true if it ended. */
export function checkWin(state: GameState, afterMeeting = false): boolean {
  if (state.winner) return true;
  const you = player(state);
  const killer = currentKiller(state);

  const end = (winner: Side, reason: string) => {
    state.winner = winner;
    state.endReason = reason;
    state.phase = "over";
    return true;
  };

  if (!you.alive && !you.ejected) return end("killer", "You were killed.");
  if (you.ejected) return end(sideOf(state, "you") === "crew" ? "killer" : "crew", "You were voted off the station.");
  if (!killer || !killer.alive) return end("crew", `${killer?.name ?? "The killer"} was caught and locked in the dive chamber.`);

  const alive = aliveChars(state);
  const killerSide = alive.filter((c) => sideOf(state, c.id) === "killer").length;
  const crewSide = alive.length - killerSide;
  if (killerSide >= crewSide) return end("killer", "The killer's side now outnumbers the crew.");

  if (afterMeeting && state.meetings.length >= MAX_MEETINGS) {
    return end("killer", "The storm cleared and the rescue sub arrived. The killer walked off with everyone else.");
  }
  return false;
}

export function playerWon(state: GameState): boolean {
  return state.winner !== undefined && state.winner === sideOf(state, "you");
}
