import { describe, expect, it } from "vitest";
import { buildCtx } from "@/lib/ai/context";
import { CAMERA_DESK, locationAt } from "@/lib/game/map";
import { cameraRecollections, killsSeenOnCamera } from "@/lib/game/memory";
import { currentKiller } from "@/lib/game/rules";
import { newGame } from "@/lib/game/setup";
import { BREACH_SECONDS, callMeeting, canCallEmergency, canSabotage, kill, startSabotage, tick } from "@/lib/game/sim";
import type { Character, GameState, Point } from "@/lib/game/types";

const idle = { dir: null, use: false };

function place(state: GameState, c: Character, pos: Point) {
  const open = state.segments.find((s) => s.who === c.id && s.to === null);
  if (open) open.to = state.t;
  c.pos = { ...pos };
  c.path = [];
  c.loc = locationAt(pos)!;
  state.segments.push({ who: c.id, loc: c.loc, from: state.t, to: null });
}

/** A game where the AI killer won't interfere, so we can watch the crew respond. */
function calmGame(seed: number) {
  const s = newGame(seed);
  const killer = currentKiller(s)!;
  killer.killCooldownUntil = 1e9;
  s.t = 25;
  s.sabotageReadyAt = 0;
  return { s, killer };
}

describe("sabotage rules", () => {
  it("only the killer can sabotage, one at a time, with a cooldown", () => {
    const { s, killer } = calmGame(2);
    const innocent = s.characters.find((c) => c.role === "crew")!;
    expect(canSabotage(s, innocent.id)).toBe(false);
    expect(startSabotage(s, "blackout", killer.id)).toBe(true);
    expect(startSabotage(s, "breach", killer.id)).toBe(false);
    expect(canCallEmergency(s)).toBe(false); // no emergency button mid-sabotage
  });

  it("the AI crew restore power after a blackout", () => {
    let fixed = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const { s, killer } = calmGame(seed);
      startSabotage(s, "blackout", killer.id);
      const end = s.t + 90;
      while (s.phase === "roam" && s.sabotage && s.t < end) tick(s, idle);
      if (!s.sabotage) fixed++;
      expect(s.sabotageReadyAt).toBeGreaterThan(s.t - 1); // cooldown starts after
    }
    expect(fixed).toBe(15);
  });

  it("the AI crew seal a hull breach before the deadline", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const { s, killer } = calmGame(seed);
      startSabotage(s, "breach", killer.id);
      while (s.phase === "roam" && s.sabotage) tick(s, idle);
      expect(s.winner, `seed ${seed}`).toBeUndefined();
      expect(s.sabotage).toBeUndefined();
    }
  });

  it("an unsealed breach drowns the station: the killer wins", () => {
    const { s, killer } = calmGame(4);
    for (const c of s.characters) if (c.role === "crew" && !c.isPlayer) c.alive = false; // nobody left to fix it
    startSabotage(s, "breach", killer.id);
    for (let i = 0; i < (BREACH_SECONDS + 2) / 0.05 && s.phase === "roam"; i++) tick(s, idle);
    expect(s.winner).toBe("killer");
    expect(s.endReason).toMatch(/breach/);
  });

  it("a meeting clears the sabotage", () => {
    const { s, killer } = calmGame(6);
    startSabotage(s, "blackout", killer.id);
    callMeeting(s, "you", "emergency");
    expect(s.sabotage).toBeUndefined();
    expect(s.sabotageLog.at(-1)!.to).toBe(s.t);
  });
});

describe("blackout and evidence", () => {
  it("the cameras record nothing in the dark, so a murder then isn't caught on tape", () => {
    const { s, killer } = calmGame(9);
    const crew = s.characters.filter((c) => !c.isPlayer && c.role === "crew");
    const [watcher, victim] = [crew[0]!, crew[1]!];
    place(s, watcher, CAMERA_DESK);
    s.camSessions.push({ who: watcher.id, from: s.t, to: null });
    place(s, killer, { x: 1660, y: 600 });
    place(s, victim, { x: 1680, y: 620 });
    s.t += 2;
    startSabotage(s, "blackout", killer.id);
    s.t += 2;
    kill(s, killer, victim);
    s.t += 1;
    expect(killsSeenOnCamera(s, watcher.id)).toEqual([]);
    // what they saw before the lights went out still counts
    expect(cameraRecollections(s, watcher.id, 0, s.t).every((r) => r.to <= s.sabotageLog[0]!.from + 1e-9)).toBe(true);
  });

  it("everyone hears about the blackout at the meeting; only the killer knows who did it", () => {
    const { s, killer } = calmGame(3);
    startSabotage(s, "blackout", killer.id);
    s.t += 3;
    callMeeting(s, "you", "emergency");
    const m = { round: 1, t: s.t, calledBy: "you", reason: "emergency" as const, transcript: [], votes: {} };
    const innocent = s.characters.find((c) => c.role === "crew" && !c.isPlayer)!;
    expect(buildCtx(s, innocent.id, "statement", { meeting: m }).situation).toMatch(/power failed/);
    expect(buildCtx(s, innocent.id, "statement", { meeting: m }).secrets.join(" ")).not.toMatch(/blackout/);
    expect(buildCtx(s, killer.id, "statement", { meeting: m }).secrets.join(" ")).toMatch(/You caused the blackout/);
  });
});

describe("fixing it yourself", () => {
  it("holding Use at the breaker restores the power", async () => {
    const { FIX_STATIONS } = await import("@/lib/game/map");
    const { s, killer } = calmGame(12);
    // keep the AI crew away so it's down to you
    for (const c of s.characters) if (c.role === "crew" && !c.isPlayer) c.alive = false;
    startSabotage(s, "blackout", killer.id);
    place(s, s.characters[0]!, FIX_STATIONS.breaker.pos);
    for (let i = 0; i < 50 && s.sabotage; i++) tick(s, { dir: null, use: true });
    expect(s.sabotage).toBeUndefined();
    expect(s.log.at(-1)).toMatch(/Power restored/);
  });
});
