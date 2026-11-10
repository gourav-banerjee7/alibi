import { ROOM_BY_ID, ROOMS } from "./map";
import { CREW, PLAYER } from "./personas";
import { int, pick, shuffle } from "./rng";
import type { Character, GameState, MiniGameKind, PlayerTask, Role } from "./types";

export const MAX_MEETINGS = 3;
export const KILL_COOLDOWN = 30;
export const FIRST_KILL_COOLDOWN = 25;

interface TaskDef {
  label: string;
  game: MiniGameKind;
  theme: string;
}

export const TASK_DEFS: Record<string, TaskDef[]> = {
  dock: [
    { label: "Check sub ballast", game: "dial", theme: "ballast" },
    { label: "Log cargo seals", game: "match", theme: "seals" },
  ],
  comms: [
    { label: "Realign sonar", game: "timing", theme: "sonar" },
    { label: "Decode surface ping", game: "timing", theme: "ping" },
  ],
  lab: [
    { label: "Sample the vent culture", game: "match", theme: "culture" },
    { label: "Calibrate microscope", game: "dial", theme: "focus" },
  ],
  mess: [{ label: "Restart water purifier", game: "wires", theme: "purifier" }],
  reactor: [
    { label: "Vent coolant", game: "dial", theme: "coolant" },
    { label: "Read core temperature", game: "dial", theme: "core" },
  ],
  medbay: [
    { label: "Restock oxygen", game: "wires", theme: "oxygen" },
    { label: "Run crew vitals", game: "timing", theme: "vitals" },
  ],
  hydro: [
    { label: "Trim kelp beds", game: "timing", theme: "kelp" },
    { label: "Fix nutrient pump", game: "wires", theme: "pump" },
  ],
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
    camSessions: [],
    sabotageLog: [],
    sabotageReadyAt: 20,
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
  state.tasks = rooms.map((room, i): PlayerTask => {
    const def = pick(state, TASK_DEFS[room.id]!);
    return {
      id: `task-${i}`,
      label: def.label,
      game: def.game,
      theme: def.theme,
      room: room.id,
      pos: pick(state, ROOM_BY_ID[room.id].consoles),
      progress: 0,
      done: false,
    };
  });

  for (const c of state.characters) state.segments.push({ who: c.id, loc: "mess", from: 0, to: null });
  state.log.push(playerIsKiller ? "You are the killer." : "You are crew. One of the others is a killer.");
  return state;
}

/** Spread everyone around the mess table at the start of each round. */
export function seatInMess(i: number, n: number) {
  const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
  return { x: 1000 + Math.cos(angle) * 128, y: 650 + Math.sin(angle) * 82 };
}
