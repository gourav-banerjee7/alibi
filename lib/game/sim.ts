import { clock } from "./clock";
import { CAMERA_DESK, CAMERA_ROOMS, findPath, isRoom, locationAt, locationName, ROOMS, spotInRoom, walkable } from "./map";
import { next, pick } from "./rng";
import { alliesOfKiller, aliveChars, byId, checkWin, currentKiller, player, sideOf } from "./rules";
import { KILL_COOLDOWN, seatInMess } from "./setup";
import type { Body, Character, GameState, LocationId, Point, RoomId } from "./types";

export const STEP = 0.05; // fixed sim step in real seconds (= game minutes)
const PLAYER_SPEED = 150;
const AI_SPEED = 116;
const KILL_RANGE = 62;
const USE_RANGE = 44;
const TALK_RANGE = 240;
const TASK_SECONDS = 2.5;

export interface Input {
  /** Keyboard direction, already normalised, or null. */
  dir: Point | null;
  /** Holding the use key or button. */
  use: boolean;
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function othersInLoc(state: GameState, c: Character): Character[] {
  return state.characters.filter((o) => o.alive && o.id !== c.id && o.loc === c.loc);
}

// ---- Movement -----------------------------------------------------------------------------

function moveBy(c: Character, dx: number, dy: number) {
  // Slide along walls: try both axes, then each axis alone.
  const tryPos = (p: Point) => (walkable(p) ? p : null);
  c.pos = tryPos({ x: c.pos.x + dx, y: c.pos.y + dy }) ?? tryPos({ x: c.pos.x + dx, y: c.pos.y }) ?? tryPos({ x: c.pos.x, y: c.pos.y + dy }) ?? c.pos;
}

function followPath(c: Character, speed: number, dt: number) {
  let budget = speed * dt;
  while (budget > 0 && c.path.length > 0) {
    const target = c.path[0]!;
    const d = dist(c.pos, target);
    if (d <= budget) {
      c.pos = { ...target };
      c.path.shift();
      budget -= d;
    } else {
      c.pos = { x: c.pos.x + ((target.x - c.pos.x) / d) * budget, y: c.pos.y + ((target.y - c.pos.y) / d) * budget };
      budget = 0;
    }
  }
}

export function walkTo(c: Character, to: Point) {
  c.path = findPath(c.pos, to);
}

function updateLocation(state: GameState, c: Character) {
  const loc = locationAt(c.pos) ?? c.loc;
  if (loc === c.loc) return;
  c.loc = loc;
  closeSegment(state, c.id);
  state.segments.push({ who: c.id, loc, from: state.t, to: null });
}

function closeSegment(state: GameState, who: string) {
  for (let i = state.segments.length - 1; i >= 0; i--) {
    const s = state.segments[i]!;
    if (s.who === who && s.to === null) {
      s.to = state.t;
      return;
    }
  }
}

// ---- Security cameras ------------------------------------------------------------------------

export const onCamera = (loc: LocationId) => CAMERA_ROOMS.includes(loc as RoomId);

export function isWatching(state: GameState, who: string) {
  return state.camSessions.some((s) => s.who === who && s.to === null);
}

/** Is anyone (other than `except`) watching the feeds right now? */
export function camerasInUse(state: GameState, except?: string) {
  return state.camSessions.some((s) => s.to === null && s.who !== except);
}

function openSession(state: GameState, who: string) {
  if (!isWatching(state, who)) state.camSessions.push({ who, from: state.t, to: null });
}

function closeSession(state: GameState, who: string) {
  for (const s of state.camSessions) if (s.who === who && s.to === null) s.to = state.t;
}

export function canUseCameras(state: GameState) {
  const you = player(state);
  return you.alive && state.phase === "roam" && dist(you.pos, CAMERA_DESK) <= USE_RANGE + 8;
}

export function startWatching(state: GameState) {
  if (canUseCameras(state)) {
    player(state).path = [];
    openSession(state, "you");
  }
}

export function stopWatching(state: GameState) {
  closeSession(state, "you");
}

// ---- AI -----------------------------------------------------------------------------------

const rand = (state: GameState) => () => next(state);

function startErrand(state: GameState, c: Character) {
  c.huntTarget = undefined;
  c.errand = undefined;
  // Now and then an innocent goes to watch the cameras, if the desk is free.
  if (c.role !== "killer" && !camerasInUse(state) && next(state) < 0.14) {
    c.errand = "cams";
    walkTo(c, CAMERA_DESK);
    return;
  }
  const rooms = ROOMS.filter((r) => r.id !== c.loc);
  const room = pick(state, rooms);
  walkTo(c, spotInRoom(room.id, rand(state)));
}

/** A target the AI killer could take without witnesses, if anyone is alone right now. */
function loneTarget(state: GameState, killer: Character): Character | undefined {
  const allies = alliesOfKiller(state);
  const refused = state.pactOffers.some((o) => o.from === killer.id && o.to === "you" && o.outcome === "refused");
  const candidates = aliveChars(state).filter((c) => {
    if (c.id === killer.id || allies.has(c.id)) return false;
    if (c.isPlayer && !refused) return false; // the player is only hunted after turning down a pact
    if (onCamera(c.loc) && camerasInUse(state, killer.id)) return false; // someone is watching that room
    const company = othersInLoc(state, c).filter((o) => o.id !== killer.id);
    return company.length === 0;
  });
  if (candidates.length === 0) return undefined;
  // Prefer the player once they refused; otherwise the nearest.
  return candidates.sort((a, b) => Number(b.isPlayer) - Number(a.isPlayer) || dist(killer.pos, a.pos) - dist(killer.pos, b.pos))[0];
}

function witnessesFor(state: GameState, killer: Character, victim: Character): Character[] {
  const allies = alliesOfKiller(state);
  return othersInLoc(state, killer).filter((o) => o.id !== victim.id && !allies.has(o.id));
}

export function kill(state: GameState, killer: Character, victim: Character) {
  victim.alive = false;
  closeSession(state, victim.id);
  victim.path = [];
  closeSegment(state, victim.id);
  const body: Body = { victim: victim.id, loc: victim.loc, pos: { ...victim.pos }, t: state.t };
  state.bodies.push(body);
  state.kills.push({ killer: killer.id, victim: victim.id, loc: victim.loc, pos: { ...victim.pos }, t: state.t, round: state.round });
  killer.killCooldownUntil = state.t + KILL_COOLDOWN;
  killer.huntTarget = undefined;
  state.log.push(`${clock(state.t)} ${victim.name} was killed.`);
  if (!killer.isPlayer) startErrand(state, killer); // walk away from the body
  checkWin(state);
}

function aiKiller(state: GameState, c: Character): boolean {
  const ready = state.t >= c.killCooldownUntil;
  // If no one has died for a long time, stop waiting for the perfect moment.
  const restless = state.t - state.roundStart > 90;
  if (!ready && !restless) return false;

  // Offer the player a pact the first time they are alone together.
  const you = player(state);
  const alreadyOffered = state.pactOffers.some((o) => o.from === c.id && o.to === "you");
  if (
    !alreadyOffered &&
    you.alive &&
    you.role === "crew" &&
    isRoom(c.loc) &&
    you.loc === c.loc &&
    othersInLoc(state, c).length === 1 &&
    state.t - state.roundStart > 8 &&
    dist(c.pos, you.pos) < TALK_RANGE
  ) {
    c.path = [];
    state.pending = { kind: "pact", from: c.id, to: "you" };
    state.phase = "pact";
    return true;
  }

  const target = c.huntTarget ? state.characters.find((x) => x.id === c.huntTarget && x.alive) : undefined;
  const filmed = target && onCamera(target.loc) && camerasInUse(state, c.id);
  if (target && !filmed && target.loc === c.loc && witnessesFor(state, c, target).length === 0 && dist(c.pos, target.pos) <= KILL_RANGE) {
    kill(state, c, target);
    return true;
  }

  // Re-pick a target about once a second so the hunt follows people around.
  if (!c.huntTarget || c.path.length === 0 || next(state) < STEP) {
    const lone = loneTarget(state, c);
    if (lone) {
      c.huntTarget = lone.id;
      walkTo(c, lone.pos);
      return true;
    }
    if (c.huntTarget) c.huntTarget = undefined;
  }
  return false;
}

function aiStep(state: GameState, c: Character, dt: number) {
  if (c.role === "killer" && isWatching(state, c.id)) closeSession(state, c.id);
  if (c.role === "killer" && aiKiller(state, c)) {
    followPath(c, AI_SPEED * 1.1, dt);
    return;
  }
  if (state.t < c.busyUntil) return;
  if (c.errand === "cams" && isWatching(state, c.id)) {
    closeSession(state, c.id); // done watching
    startErrand(state, c);
    return;
  }
  if (c.path.length > 0) {
    followPath(c, AI_SPEED, dt);
    if (c.path.length === 0) {
      if (c.errand === "cams" && !camerasInUse(state, c.id)) {
        openSession(state, c.id);
        c.busyUntil = state.t + 8 + next(state) * 6;
      } else {
        c.errand = undefined;
        c.busyUntil = state.t + 4 + next(state) * 7; // do the "task" for a while
      }
    }
    return;
  }
  startErrand(state, c);
}

/** AI crew report a body as soon as they walk in on it. The killer never reports. */
function aiReports(state: GameState) {
  for (const body of state.bodies) {
    if (body.foundAt !== undefined) continue;
    const finder = state.characters.find(
      (c) => c.alive && !c.isPlayer && c.role !== "killer" && c.loc === body.loc && dist(c.pos, body.pos) < 420,
    );
    if (finder) {
      callMeeting(state, finder.id, "body", body);
      return;
    }
  }
}

// ---- Player actions -------------------------------------------------------------------------

export function visibleBody(state: GameState): Body | undefined {
  const you = player(state);
  return state.bodies.find((b) => b.foundAt === undefined && b.loc === you.loc);
}

export function killTarget(state: GameState): Character | undefined {
  const you = player(state);
  if (you.role !== "killer" || !you.alive || state.t < you.killCooldownUntil) return undefined;
  const near = othersInLoc(state, you)
    .filter((o) => o.role !== "accomplice" && dist(o.pos, you.pos) <= KILL_RANGE + 10)
    .sort((a, b) => dist(a.pos, you.pos) - dist(b.pos, you.pos))[0];
  if (!near) return undefined;
  return witnessesFor(state, you, near).length === 0 ? near : undefined;
}

/** Why the kill button is disabled, for the HUD. */
export function killBlockedReason(state: GameState): string | undefined {
  const you = player(state);
  if (you.role !== "killer") return undefined;
  if (state.t < you.killCooldownUntil) return `Ready in ${Math.ceil(you.killCooldownUntil - state.t)}s`;
  const near = othersInLoc(state, you).filter((o) => o.role !== "accomplice");
  if (near.length === 0) return "No one here";
  if (near.length > 1) return "Too many eyes";
  if (dist(near[0]!.pos, you.pos) > KILL_RANGE + 10) return "Get closer";
  return undefined;
}

export function pactCandidate(state: GameState): Character | undefined {
  const you = player(state);
  if (you.role !== "killer" || !isRoom(you.loc)) return undefined;
  const others = othersInLoc(state, you);
  if (others.length !== 1) return undefined;
  const other = others[0]!;
  if (other.role !== "crew" || state.pactOffers.some((o) => o.from === "you" && o.to === other.id)) return undefined;
  return dist(other.pos, you.pos) < TALK_RANGE ? other : undefined;
}

export function nearbyTask(state: GameState) {
  const you = player(state);
  return state.tasks.find((t) => !t.done && dist(t.pos, you.pos) <= USE_RANGE);
}

export function canCallEmergency(state: GameState) {
  const you = player(state);
  return !state.emergencyUsed && you.alive && you.loc === "mess";
}

export function callMeeting(state: GameState, calledBy: string, reason: "body" | "emergency", body?: Body) {
  if (body) {
    body.foundBy = calledBy;
    body.foundAt = state.t;
  }
  if (reason === "emergency") state.emergencyUsed = true;
  for (const c of state.characters) {
    c.path = [];
    c.errand = undefined;
    closeSegment(state, c.id);
    closeSession(state, c.id);
  }
  state.pending = { kind: "meeting", calledBy, reason, body };
  state.phase = "meeting";
}

export function startPlayerPact(state: GameState, to: string) {
  for (const c of state.characters) c.path = [];
  state.pending = { kind: "pact", from: "you", to };
  state.phase = "pact";
}

/** One true sighting from this round, handed out for finishing a task. */
function grantClue(state: GameState) {
  const killer = currentKiller(state);
  const recent = state.segments.filter((s) => s.from >= state.roundStart && s.who !== "you" && isRoom(s.loc) && (s.to ?? state.t) - s.from >= 2);
  const juicy = killer ? recent.filter((s) => s.who === killer.id) : [];
  const pool = juicy.length > 0 && next(state) < 0.4 ? juicy : recent;
  if (pool.length === 0) return;
  const s = pick(state, pool);
  const who = byId(state, s.who);
  state.clues.push(`Sonar log: ${who.name} was in ${locationName(s.loc)} from ${clock(s.from)} to ${clock(s.to ?? state.t)}.`);
}

// ---- Tick -----------------------------------------------------------------------------------

export function tick(state: GameState, input: Input, dt = STEP) {
  if (state.phase !== "roam") return;
  state.t += dt;

  const you = player(state);
  if (you.alive) {
    if (input.dir && (input.dir.x !== 0 || input.dir.y !== 0)) {
      you.path = [];
      closeSession(state, "you");
      moveBy(you, input.dir.x * PLAYER_SPEED * dt, input.dir.y * PLAYER_SPEED * dt);
    } else if (you.path.length > 0) {
      followPath(you, PLAYER_SPEED, dt);
    }
    const task = nearbyTask(state);
    if (task && input.use && you.role !== "killer") {
      task.progress = Math.min(1, task.progress + dt / TASK_SECONDS);
      if (task.progress >= 1) {
        task.done = true;
        grantClue(state);
      }
    } else if (task && input.use && you.role === "killer") {
      // The killer can fake tasks, but gets no clue for it.
      task.progress = Math.min(1, task.progress + dt / TASK_SECONDS);
      if (task.progress >= 1) task.done = true;
    }
  }

  for (const c of state.characters) {
    if (!c.alive || c.isPlayer) continue;
    aiStep(state, c, dt);
    if (state.phase !== "roam") return;
  }
  for (const c of state.characters) if (c.alive) updateLocation(state, c);

  if (state.phase === "roam") aiReports(state);
}

/** After a meeting: everyone back to the mess table, cooldowns reset, a new round. */
export function startNextRound(state: GameState) {
  state.t += 10; // the meeting took a while
  state.round += 1;
  state.roundStart = state.t;
  state.phase = "roam";
  state.pending = undefined;
  const alive = aliveChars(state);
  alive.forEach((c, i) => {
    c.pos = seatInMess(i, alive.length);
    c.loc = "mess";
    c.path = [];
    c.busyUntil = state.t + 1 + (i % 3);
    c.killCooldownUntil = state.t + KILL_COOLDOWN;
    c.huntTarget = undefined;
    c.errand = undefined;
    state.segments.push({ who: c.id, loc: "mess", from: state.t, to: null });
  });
}

export function sideLabel(state: GameState, id: string) {
  return sideOf(state, id);
}
