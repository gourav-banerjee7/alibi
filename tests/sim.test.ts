import { describe, expect, it } from "vitest";
import { finishMeeting, resolvePact } from "@/lib/game/actions";
import { contradictionsFor, placesMentioned, statementIsConsistent } from "@/lib/game/judge";
import { locationAt, walkable, findPath, NODES, straightWalkable } from "@/lib/game/map";
import { claimIsTrue, claimsOf, coverStory, recollect } from "@/lib/game/memory";
import { byId, checkWin, currentKiller, sideOf } from "@/lib/game/rules";
import { newGame } from "@/lib/game/setup";
import { STEP, tick, kill } from "@/lib/game/sim";
import type { GameState } from "@/lib/game/types";

const idle = { dir: null, use: false };

/** Run until the sim asks the UI for something (meeting or pact), or a time limit. */
function runUntilPending(state: GameState, maxMinutes = 300) {
  const end = state.t + maxMinutes;
  while (state.phase === "roam" && state.t < end) tick(state, idle);
  return state.pending;
}

describe("map", () => {
  it("every waypoint is walkable and every room is reachable from the mess", () => {
    for (const [id, p] of Object.entries(NODES)) expect(walkable(p), id).toBe(true);
    for (const room of ["dock", "comms", "lab", "reactor", "medbay", "hydro"]) {
      const path = findPath(NODES.mess!, NODES[room]!);
      let prev = NODES.mess!;
      for (const p of path) {
        expect(straightWalkable(prev, p), `${room}: segment to ${p.x},${p.y}`).toBe(true);
        prev = p;
      }
      expect(locationAt(path[path.length - 1]!)).toBe(room);
    }
  });
});

describe("simulation", () => {
  it("is deterministic for a seed", () => {
    const a = newGame(42);
    const b = newGame(42);
    runUntilPending(a, 120);
    runUntilPending(b, 120);
    expect(a.characters.map((c) => [c.pos, c.alive])).toEqual(b.characters.map((c) => [c.pos, c.alive]));
    expect(a.kills).toEqual(b.kills);
  });

  it("keeps everyone on walkable ground and eventually something happens, across 40 seeds", () => {
    let kills = 0;
    let pacts = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = newGame(seed);
      const pending = runUntilPending(s);
      for (const c of s.characters) {
        expect(Number.isFinite(c.pos.x) && Number.isFinite(c.pos.y)).toBe(true);
        expect(walkable(c.pos), `seed ${seed} ${c.id} at ${c.pos.x},${c.pos.y}`).toBe(true);
      }
      expect(pending, `seed ${seed} stalled`).toBeDefined();
      kills += s.kills.length;
      if (pending?.kind === "pact") pacts++;
    }
    expect(kills).toBeGreaterThan(10);
    expect(pacts).toBeGreaterThan(0);
  });

  it("the AI killer never kills in front of a witness", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = newGame(seed);
      runUntilPending(s);
      for (const k of s.kills) {
        const present = s.segments.filter((g) => g.loc === k.loc && g.from <= k.t && (g.to ?? s.t) > k.t && g.who !== k.killer && g.who !== k.victim);
        expect(present.map((p) => p.who), `seed ${seed}`).toEqual([]);
      }
    }
  });
});

describe("memory and judging", () => {
  function playedGame() {
    for (let seed = 1; seed < 200; seed++) {
      const s = newGame(seed);
      const pending = runUntilPending(s);
      if (pending?.kind === "meeting" && s.kills.length > 0) return s;
    }
    throw new Error("no seed produced a meeting");
  }

  it("a crew member's true claims check out", () => {
    const s = playedGame();
    const crew = s.characters.find((c) => c.role === "crew" && c.alive && !c.isPlayer)!;
    for (const r of recollect(s, crew.id, 0, s.t)) {
      if (r.to - r.from >= 1) expect(claimIsTrue(s, crew.id, { loc: r.loc, from: r.from, to: r.to })).toBe(true);
    }
  });

  it("the killer's cover story hides where the kill happened", () => {
    const s = playedGame();
    const kill = s.kills[0]!;
    const story = coverStory(s, kill.killer, 0, s.t);
    const atKill = story.find((c) => c.from <= kill.t && c.to >= kill.t);
    if (atKill) expect(atKill.loc).not.toBe(kill.loc);
  });

  it("someone who was in a room notices a false claim about it", () => {
    const s = playedGame();
    let checked = 0;
    for (const witness of s.characters.filter((c) => c.alive && !c.isPlayer)) {
      for (const where of recollect(s, witness.id, 0, s.t).filter((r) => r.to - r.from >= 3)) {
        const liar = s.characters.find((c) => c.alive && c.id !== witness.id && !where.saw.includes(c.id) && !c.isPlayer);
        if (!liar) continue;
        const found = contradictionsFor(s, witness.id, liar.id, [{ loc: where.loc, from: where.from, to: where.to }]);
        expect(found.length, `${witness.id} vs ${liar.id} in ${where.loc}`).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("never flags a true alibi as a contradiction, for anyone, across 40 seeds", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = newGame(seed);
      runUntilPending(s);
      for (const speaker of s.characters.filter((c) => c.alive)) {
        const truth = claimsOf(recollect(s, speaker.id, s.roundStart, s.t));
        for (const observer of s.characters.filter((c) => c.alive && c.id !== speaker.id)) {
          expect(contradictionsFor(s, observer.id, speaker.id, truth), `seed ${seed}: ${observer.id} on ${speaker.id}`).toEqual([]);
        }
      }
    }
  });

  it("the killer's cover story keeps the round's opening stretch in the mess", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = newGame(seed);
      runUntilPending(s);
      const k = s.kills[0];
      if (!k || k.t < 10) continue;
      const story = coverStory(s, k.killer, s.roundStart, s.t);
      if (story[0] && story[0].from < 1) expect(story[0].loc, `seed ${seed}`).toBe("mess");
    }
  });

  it("flags places an innocent never visited", () => {
    const s = playedGame();
    const crew = s.characters.find((c) => c.role === "crew" && c.alive && !c.isPlayer)!;
    const visited = new Set(recollect(s, crew.id, 0, s.t).map((r) => r.loc));
    const never = (["dock", "comms", "lab", "reactor", "medbay", "hydro"] as const).find((l) => !visited.has(l));
    if (never) expect(statementIsConsistent(s, crew.id, `I was in the ${never} all night.`, [])).toBe(false);
    expect(placesMentioned("Went from the Bio Lab to hydroponics")).toEqual(["lab", "hydro"]);
  });
});

describe("pacts and winning", () => {
  it("a swap makes the player the killer and the old killer an accomplice", () => {
    const s = newGame(7);
    const killer = currentKiller(s)!;
    resolvePact(s, killer.id, "you", "swap");
    expect(byId(s, "you").role).toBe("killer");
    expect(byId(s, killer.id).role).toBe("accomplice");
    expect(sideOf(s, "you")).toBe("killer");
  });

  it("a vouch pact puts the player on the killer's side until they vote against them", () => {
    const s = newGame(7);
    const killer = currentKiller(s)!;
    resolvePact(s, killer.id, "you", "vouch");
    expect(sideOf(s, "you")).toBe("killer");
    finishMeeting(s, { round: 1, t: s.t, calledBy: "you", reason: "emergency", transcript: [], votes: { you: killer.id } });
    expect(sideOf(s, "you")).toBe("crew");
  });

  it("ejecting the killer wins it for the crew", () => {
    const s = newGame(3);
    const killer = currentKiller(s)!;
    const votes = Object.fromEntries(s.characters.map((c) => [c.id, killer.id]));
    finishMeeting(s, { round: 1, t: s.t, calledBy: "you", reason: "emergency", transcript: [], votes });
    expect(s.winner).toBe("crew");
  });

  it("a tie ejects nobody", () => {
    const s = newGame(3);
    finishMeeting(s, { round: 1, t: s.t, calledBy: "you", reason: "emergency", transcript: [], votes: { you: "mara", juno: "tobias" } });
    expect(s.characters.every((c) => !c.ejected)).toBe(true);
    expect(s.round).toBe(2);
  });

  it("the killer wins at parity", () => {
    const s = newGame(5, "killer");
    const you = byId(s, "you");
    const crew = s.characters.filter((c) => !c.isPlayer);
    for (const c of crew.slice(0, 4)) kill(s, you, c);
    expect(s.winner).toBe("killer");
    expect(checkWin(s)).toBe(true);
  });

  it("STEP is small enough for smooth movement", () => {
    expect(STEP).toBeLessThanOrEqual(0.05);
  });
});
