import type { LocationId, Point, RoomId } from "./types";

export const WORLD = { width: 1000, height: 640 };

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Room {
  id: RoomId;
  name: string;
  rect: Rect;
  /** Floor tint on the map. */
  tint: string;
  /** Spots where someone can stand at a console. */
  consoles: Point[];
}

export const ROOMS: Room[] = [
  { id: "dock", name: "Sub Dock", rect: { x: 40, y: 240, w: 180, h: 160 }, tint: "#12324a", consoles: [{ x: 80, y: 280 }, { x: 180, y: 370 }] },
  { id: "comms", name: "Comms", rect: { x: 260, y: 40, w: 200, h: 150 }, tint: "#1d2d52", consoles: [{ x: 300, y: 80 }, { x: 400, y: 80 }] },
  { id: "lab", name: "Bio Lab", rect: { x: 540, y: 40, w: 200, h: 150 }, tint: "#16404a", consoles: [{ x: 600, y: 80 }, { x: 700, y: 160 }] },
  { id: "mess", name: "Mess Hall", rect: { x: 400, y: 250, w: 200, h: 140 }, tint: "#2a2f4a", consoles: [{ x: 500, y: 320 }] },
  { id: "reactor", name: "Reactor", rect: { x: 780, y: 240, w: 180, h: 160 }, tint: "#3d2440", consoles: [{ x: 920, y: 280 }, { x: 830, y: 370 }] },
  { id: "medbay", name: "Medbay", rect: { x: 260, y: 450, w: 200, h: 150 }, tint: "#173f3a", consoles: [{ x: 300, y: 570 }, { x: 410, y: 480 }] },
  { id: "hydro", name: "Hydroponics", rect: { x: 540, y: 450, w: 200, h: 150 }, tint: "#1d3d26", consoles: [{ x: 700, y: 570 }, { x: 590, y: 560 }] },
];

export interface Corridor {
  id: LocationId;
  name: string;
  rects: Rect[];
}

export const CORRIDORS: Corridor[] = [
  { id: "c-west", name: "west corridor", rects: [{ x: 220, y: 300, w: 180, h: 40 }] },
  { id: "c-east", name: "east corridor", rects: [{ x: 600, y: 300, w: 180, h: 40 }] },
  { id: "c-comms", name: "comms hatch", rects: [{ x: 415, y: 190, w: 40, h: 60 }] },
  { id: "c-lab", name: "lab hatch", rects: [{ x: 545, y: 190, w: 40, h: 60 }] },
  { id: "c-medbay", name: "medbay hatch", rects: [{ x: 415, y: 390, w: 40, h: 60 }] },
  { id: "c-hydro", name: "hydro hatch", rects: [{ x: 545, y: 390, w: 40, h: 60 }] },
  { id: "c-north", name: "north tube", rects: [{ x: 460, y: 95, w: 80, h: 40 }] },
  { id: "c-south", name: "south tube", rects: [{ x: 460, y: 505, w: 80, h: 40 }] },
  {
    id: "c-reactor",
    name: "reactor tube",
    rects: [
      { x: 740, y: 100, w: 140, h: 40 },
      { x: 840, y: 100, w: 40, h: 140 },
    ],
  },
  {
    id: "c-dock",
    name: "dock tube",
    rects: [
      { x: 110, y: 400, w: 40, h: 125 },
      { x: 110, y: 485, w: 150, h: 40 },
    ],
  },
];

export const ROOM_BY_ID = Object.fromEntries(ROOMS.map((r) => [r.id, r])) as Record<RoomId, Room>;

export function isRoom(loc: LocationId): loc is RoomId {
  return !loc.startsWith("c-");
}

export function locationName(loc: LocationId): string {
  if (isRoom(loc)) return ROOM_BY_ID[loc].name;
  return CORRIDORS.find((c) => c.id === loc)?.name ?? "a corridor";
}

/** Every name a model might use for a place, lowercased, for consistency checks. */
export const PLACE_WORDS: Array<{ loc: LocationId; words: string[] }> = [
  { loc: "dock", words: ["sub dock", "dock"] },
  { loc: "comms", words: ["comms", "communications"] },
  { loc: "lab", words: ["bio lab", "lab"] },
  { loc: "mess", words: ["mess hall", "mess", "cafeteria"] },
  { loc: "reactor", words: ["reactor"] },
  { loc: "medbay", words: ["medbay", "med bay", "infirmary"] },
  { loc: "hydro", words: ["hydroponics", "hydro"] },
];

const inRect = (p: Point, r: Rect, pad = 0) => p.x >= r.x + pad && p.x <= r.x + r.w - pad && p.y >= r.y + pad && p.y <= r.y + r.h - pad;

/** Rooms win over corridors where they touch, so standing in a doorway counts as the room. */
export function locationAt(p: Point): LocationId | undefined {
  for (const r of ROOMS) if (inRect(p, r.rect)) return r.id;
  for (const c of CORRIDORS) if (c.rects.some((r) => inRect(p, r))) return c.id;
  return undefined;
}

const BODY_RADIUS = 9;

export function walkable(p: Point): boolean {
  // The whole body circle must fit inside the union of rects. Checking the centre plus
  // four edge points is enough for axis-aligned rects this size.
  const probes = [p, { x: p.x - BODY_RADIUS, y: p.y }, { x: p.x + BODY_RADIUS, y: p.y }, { x: p.x, y: p.y - BODY_RADIUS }, { x: p.x, y: p.y + BODY_RADIUS }];
  const rects = [...ROOMS.map((r) => r.rect), ...CORRIDORS.flatMap((c) => c.rects)];
  return probes.every((q) => rects.some((r) => inRect(q, r)));
}

// ---- Waypoint graph for AI movement -------------------------------------------------------

export const NODES: Record<string, Point> = {
  dock: { x: 130, y: 320 },
  comms: { x: 360, y: 115 },
  lab: { x: 640, y: 115 },
  mess: { x: 500, y: 320 },
  reactor: { x: 870, y: 320 },
  medbay: { x: 360, y: 525 },
  hydro: { x: 640, y: 525 },
  "comms-door": { x: 435, y: 170 },
  "mess-nw": { x: 435, y: 270 },
  "lab-door": { x: 565, y: 170 },
  "mess-ne": { x: 565, y: 270 },
  "medbay-door": { x: 435, y: 470 },
  "mess-sw": { x: 435, y: 370 },
  "hydro-door": { x: 565, y: 470 },
  "mess-se": { x: 565, y: 370 },
  "lab-east": { x: 720, y: 120 },
  "reactor-bend": { x: 860, y: 120 },
  "reactor-door": { x: 860, y: 260 },
  "dock-door": { x: 130, y: 380 },
  "dock-bend": { x: 130, y: 505 },
  "medbay-west": { x: 280, y: 505 },
};

const EDGES: Array<[string, string]> = [
  ["dock", "mess"],
  ["mess", "reactor"],
  ["comms", "lab"],
  ["medbay", "hydro"],
  ["comms", "comms-door"],
  ["comms-door", "mess-nw"],
  ["mess-nw", "mess"],
  ["lab", "lab-door"],
  ["lab-door", "mess-ne"],
  ["mess-ne", "mess"],
  ["medbay", "medbay-door"],
  ["medbay-door", "mess-sw"],
  ["mess-sw", "mess"],
  ["hydro", "hydro-door"],
  ["hydro-door", "mess-se"],
  ["mess-se", "mess"],
  ["lab", "lab-east"],
  ["lab-east", "reactor-bend"],
  ["reactor-bend", "reactor-door"],
  ["reactor-door", "reactor"],
  ["dock", "dock-door"],
  ["dock-door", "dock-bend"],
  ["dock-bend", "medbay-west"],
  ["medbay-west", "medbay"],
];

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const ADJ: Record<string, string[]> = {};
for (const [a, b] of EDGES) {
  (ADJ[a] ??= []).push(b);
  (ADJ[b] ??= []).push(a);
}

/** Nearest node reachable in a straight walkable line from p. */
function nearestNode(p: Point): string {
  let best = "mess";
  let bestD = Infinity;
  for (const [id, n] of Object.entries(NODES)) {
    const d = dist(p, n);
    if (d < bestD && straightWalkable(p, n)) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

export function straightWalkable(a: Point, b: Point): boolean {
  const steps = Math.ceil(dist(a, b) / 6);
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (!locationAt(q)) return false;
  }
  return true;
}

/** Dijkstra over the waypoint graph. Returns points to walk through, ending at `to`. */
export function findPath(from: Point, to: Point): Point[] {
  if (straightWalkable(from, to) && locationAt(from) === locationAt(to)) return [to];
  const start = nearestNode(from);
  const goal = nearestNode(to);
  const d: Record<string, number> = { [start]: 0 };
  const prev: Record<string, string> = {};
  const open = new Set([start]);
  while (open.size > 0) {
    let u = "";
    let best = Infinity;
    for (const n of open) if ((d[n] ?? Infinity) < best) [u, best] = [n, d[n]!];
    open.delete(u);
    if (u === goal) break;
    for (const v of ADJ[u] ?? []) {
      const alt = best + dist(NODES[u]!, NODES[v]!);
      if (alt < (d[v] ?? Infinity)) {
        d[v] = alt;
        prev[v] = u;
        open.add(v);
      }
    }
  }
  const nodes: string[] = [];
  for (let n: string | undefined = goal; n; n = prev[n]) {
    nodes.unshift(n);
    if (n === start) break;
  }
  return [...nodes.map((n) => NODES[n]!), to];
}

/** A random standing spot inside a room, away from the walls. */
export function spotInRoom(room: RoomId, r: () => number): Point {
  const { rect } = ROOM_BY_ID[room];
  const pad = 22;
  return { x: rect.x + pad + r() * (rect.w - pad * 2), y: rect.y + pad + r() * (rect.h - pad * 2) };
}
