import { describe, expect, it } from "vitest";
import { scriptedStatement, scriptedVote } from "@/lib/ai/scripted";
import { contradictionsFor } from "@/lib/game/judge";
import { CAMERA_DESK, CAMERA_MOUNTS, CAMERA_ROOMS, locationAt, walkable } from "@/lib/game/map";
import { killsSeenOnCamera } from "@/lib/game/memory";
import { currentKiller } from "@/lib/game/rules";
import { newGame } from "@/lib/game/setup";
import { canUseCameras, isWatching, kill, startWatching, tick } from "@/lib/game/sim";
import type { Character, GameState, MeetingRecord, Point } from "@/lib/game/types";

/** Teleport someone and keep the ground-truth timeline consistent. */
function place(state: GameState, c: Character, pos: Point) {
  const open = state.segments.find((s) => s.who === c.id && s.to === null);
  if (open) open.to = state.t;
  c.pos = { ...pos };
  c.path = [];
  c.loc = locationAt(pos)!;
  state.segments.push({ who: c.id, loc: c.loc, from: state.t, to: null });
}

const meeting = (state: GameState): MeetingRecord => ({ round: 1, t: state.t, calledBy: "you", reason: "emergency", transcript: [], votes: {} });

describe("camera geometry", () => {
  it("the desk is standable in Comms, and each camera hangs inside its room", () => {
    expect(walkable(CAMERA_DESK)).toBe(true);
    expect(locationAt(CAMERA_DESK)).toBe("comms");
    for (const room of CAMERA_ROOMS) expect(locationAt(CAMERA_MOUNTS[room]!)).toBe(room);
  });
});

describe("watching", () => {
  it("you can only watch from the desk, and walking away ends it", () => {
    const s = newGame(3);
    const you = s.characters[0]!;
    startWatching(s);
    expect(isWatching(s, "you")).toBe(false); // still in the mess
    place(s, you, CAMERA_DESK);
    expect(canUseCameras(s)).toBe(true);
    startWatching(s);
    expect(isWatching(s, "you")).toBe(true);
    tick(s, { dir: { x: 1, y: 0 }, use: false });
    expect(isWatching(s, "you")).toBe(false);
  });

  it("the AI killer never kills in a watched room, across 40 seeds", () => {
    let watchedKills = 0;
    let sessions = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = newGame(seed);
      while (s.phase === "roam" && s.t < 300) tick(s, { dir: null, use: false });
      sessions += s.camSessions.length;
      for (const k of s.kills) {
        if (!CAMERA_ROOMS.includes(k.loc as (typeof CAMERA_ROOMS)[number])) continue;
        const watched = s.camSessions.some((w) => w.who !== k.killer && w.from <= k.t && (w.to ?? s.t) >= k.t);
        if (watched) watchedKills++;
      }
    }
    expect(sessions).toBeGreaterThan(0); // the crew do use the cameras
    expect(watchedKills).toBe(0);
  });
});

describe("what the cameras prove", () => {
  function setup() {
    const s = newGame(9);
    const killer = currentKiller(s)!;
    const crew = s.characters.filter((c) => !c.isPlayer && c.role === "crew");
    const [watcher, victim] = [crew[0]!, crew[1]!];
    s.t = 5;
    place(s, watcher, CAMERA_DESK);
    s.camSessions.push({ who: watcher.id, from: s.t, to: null });
    place(s, killer, { x: 1660, y: 600 });
    place(s, victim, { x: 1680, y: 620 });
    s.t = 7;
    return { s, killer, watcher, victim };
  }

  it("a murder seen on camera is named at the meeting, and the watcher votes for the killer", () => {
    const { s, killer, watcher, victim } = setup();
    kill(s, killer, victim);
    expect(killsSeenOnCamera(s, watcher.id).map((k) => k.killer)).toEqual([killer.id]);
    const m = meeting(s);
    expect(scriptedStatement(s, watcher.id, m).say).toContain(`watched ${killer.name} kill ${victim.name}`);
    expect(scriptedVote(s, watcher.id, m).vote).toBe(killer.id);
  });

  it("a false alibi about a camera room is caught by whoever watched it", () => {
    const { s, killer, watcher } = setup();
    // The killer was in the Reactor on camera from 5 to 7, but claims the Bio Lab.
    s.t = 9;
    const found = contradictionsFor(s, watcher.id, killer.id, [{ loc: "lab", from: 5, to: 7 }]);
    expect(found.join(" ")).toMatch(/camera/);
  });
});
