import { ROOM_BY_ID, ROOMS } from "./map";
import { CREW, PLAYER } from "./personas";
import { int, pick, shuffle } from "./rng";
import type { Character, GameState, PlayerTask, Role } from "./types";

export const MAX_MEETINGS = 3;
export const KILL_COOLDOWN = 30;
export const FIRST_KILL_COOLDOWN = 25;

const TASK_LABELS: Record<string, string[]> = {
  dock: ["Check sub ballast", "Log cargo seals"],
  comms: ["Realign sonar", "Decode surface ping"],
  lab: ["Sample the vent culture", "Calibrate microscope"],
  mess: ["Restart water purifier"],
  reactor: ["Vent coolant", "Read core temperature"],
  medbay: ["Restock oxygen", "Run crew vitals"],
  hydro: ["Trim kelp beds", "Fix nutrient pump"],
};

export type StartRole = "crew" | "killer" | "random";

export function newGame(seed: number, startRole: StartRole = "crew"): GameState {
  const state: GameState = {
    seed,
    rng: seed >>> 0,
    t: 0,
    round: 1,
    roundStart: 0,
    phase: "roam",
    characters: [],
    segments: [],
    kills: [],
    bodies: [],
    pacts: [],
    pactOffers: [],
    meetings: [],
    tasks: [],
    clues: [],
    emergencyUsed: false,
    log: [],
  };

  const playerIsKiller = startRole === "killer" || (startRole === "random" && int(state, CREW.length + 1) === 0);
  const killerId = playerIsKiller ? PLAYER.id : pick(state, CREW).id;

  const base = (id: string): Role => (id === killerId ? "killer" : "crew");
  const everyone = [PLAYER, ...CREW];
  state.characters = everyone.map(
    (p, i): Character => ({
      ...p,
      isPlayer: p.id === PLAYER.id,
      role: base(p.id),
      alive: true,
      ejected: false,
      pos: seatInMess(i, everyone.length),
      loc: "mess",
      path: [],
      busyUntil: 0,
      killCooldownUntil: FIRST_KILL_COOLDOWN,
    }),
  );

  // Three tasks in three different rooms, never the mess.
  const rooms = shuffle(state, ROOMS.filter((r) => r.id !== "mess")).slice(0, 3);
  state.tasks = rooms.map(
    (room, i): PlayerTask => ({
      id: `task-${i}`,
      label: pick(state, TASK_LABELS[room.id]!),
      room: room.id,
      pos: pick(state, ROOM_BY_ID[room.id].consoles),
      progress: 0,
      done: false,
    }),
  );

  for (const c of state.characters) state.segments.push({ who: c.id, loc: "mess", from: 0, to: null });
  state.log.push(playerIsKiller ? "You are the killer." : "You are crew. One of the others is a killer.");
  return state;
}

/** Spread everyone around the mess table at the start of each round. */
export function seatInMess(i: number, n: number) {
  const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
  return { x: 500 + Math.cos(angle) * 60, y: 320 + Math.sin(angle) * 42 };
}
