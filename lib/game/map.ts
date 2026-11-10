import type { LocationId, Point, RoomId } from "./types";

/**
 * Halcyon-9. World units; the camera shows roughly a third of this at a time.
 * Every room has furniture ("props"). Solid props block movement for everyone,
 * and the AI waypoint graph is laid out so no route crosses one.
 */
export const WORLD = { width: 2000, height: 1280 };

/** Radius of a diver's footprint for collision. */
export const BODY_RADIUS = 14;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Shape =
  | ({ type: "rect" } & Rect)
  | { type: "circle"; x: number; y: number; r: number }
  | { type: "ellipse"; x: number; y: number; rx: number; ry: number };

export type PropKind =
  | "moonpool"
  | "crates"
  | "ballast"
  | "lockers"
  | "sonarwall"
  | "desk"
  | "rack"
  | "bench"
  | "tank"
  | "table"
  | "galley"
  | "core"
  | "coolant"
  | "pipes"
  | "bed"
  | "cabinet"
  | "scanner"
  | "planter"
  | "pump";

export interface Prop {
  kind: PropKind;
  shape: Shape;
  /** Solid props block movement. Floor decals (like the scanner pad) don't. */
  solid: boolean;
}

export interface Room {
  id: RoomId;
  name: string;
  rect: Rect;
  /** Bioluminescent accent for the room's walls, label and light. */
  tint: string;
  /** Spots where someone can stand at a console. */
  consoles: Point[];
  props: Prop[];
}

const rect = (x: number, y: number, w: number, h: number): Shape => ({ type: "rect", x, y, w, h });
const solid = (kind: PropKind, shape: Shape): Prop => ({ kind, shape, solid: true });

export const ROOMS: Room[] = [
  {
    id: "dock",
    name: "Sub Dock",
    rect: { x: 80, y: 480, w: 360, h: 320 },
    tint: "#38D6F5",
    consoles: [{ x: 360, y: 548 }, { x: 150, y: 742 }],
    props: [
      solid("moonpool", rect(104, 504, 132, 104)),
      solid("crates", rect(330, 700, 92, 82)),
      solid("ballast", rect(300, 492, 120, 30)),
      solid("lockers", rect(92, 770, 120, 22)),
    ],
  },
  {
    id: "comms",
    name: "Comms",
    rect: { x: 520, y: 80, w: 400, h: 300 },
    tint: "#8B93FF",
    consoles: [{ x: 640, y: 160 }, { x: 630, y: 280 }],
    props: [
      solid("sonarwall", rect(560, 90, 320, 42)),
      solid("desk", rect(556, 300, 150, 52)),
      solid("rack", rect(532, 160, 40, 104)),
    ],
  },
  {
    id: "lab",
    name: "Bio Lab",
    rect: { x: 1080, y: 80, w: 400, h: 300 },
    tint: "#3EE0C8",
    consoles: [{ x: 1380, y: 178 }, { x: 1380, y: 282 }],
    props: [
      solid("bench", rect(1300, 98, 164, 52)),
      solid("bench", rect(1300, 306, 164, 52)),
      solid("tank", { type: "circle", x: 1122, y: 128, r: 24 }),
      solid("tank", { type: "circle", x: 1180, y: 128, r: 24 }),
      solid("tank", { type: "circle", x: 1238, y: 128, r: 24 }),
    ],
  },
  {
    id: "mess",
    name: "Mess Hall",
    rect: { x: 800, y: 500, w: 400, h: 280 },
    tint: "#FFB547",
    consoles: [{ x: 1000, y: 572 }],
    props: [
      solid("table", { type: "ellipse", x: 1000, y: 650, rx: 92, ry: 50 }),
      solid("galley", rect(1152, 748, 40, 26)),
    ],
  },
  {
    id: "reactor",
    name: "Reactor",
    rect: { x: 1560, y: 480, w: 360, h: 320 },
    tint: "#FF6B7D",
    consoles: [{ x: 1720, y: 762 }, { x: 1640, y: 548 }],
    props: [
      solid("core", { type: "circle", x: 1822, y: 640, r: 56 }),
      solid("coolant", rect(1576, 712, 92, 74)),
      solid("pipes", rect(1780, 488, 132, 24)),
    ],
  },
  {
    id: "medbay",
    name: "Medbay",
    rect: { x: 520, y: 900, w: 400, h: 300 },
    tint: "#5BE49B",
    consoles: [{ x: 590, y: 962 }, { x: 680, y: 1108 }],
    props: [
      solid("bed", rect(556, 1130, 104, 56)),
      solid("bed", rect(700, 1130, 104, 56)),
      solid("cabinet", rect(536, 908, 104, 30)),
      { kind: "scanner", shape: { type: "circle", x: 852, y: 1110, r: 34 }, solid: false },
    ],
  },
  {
    id: "hydro",
    name: "Hydroponics",
    rect: { x: 1080, y: 900, w: 400, h: 300 },
    tint: "#B5E853",
    consoles: [{ x: 1350, y: 988 }, { x: 1200, y: 1090 }],
    props: [
      solid("planter", rect(1232, 918, 230, 38)),
      solid("planter", rect(1112, 1112, 350, 34)),
      solid("planter", rect(1112, 1158, 350, 32)),
      solid("pump", { type: "circle", x: 1438, y: 1040, r: 22 }),
    ],
  },
];

export interface Corridor {
  id: LocationId;
  name: string;
  rects: Rect[];
}

export const CORRIDORS: Corridor[] = [
  { id: "c-west", name: "west corridor", rects: [{ x: 440, y: 600, w: 360, h: 80 }] },
  { id: "c-east", name: "east corridor", rects: [{ x: 1200, y: 600, w: 360, h: 80 }] },
  { id: "c-comms", name: "comms hatch", rects: [{ x: 830, y: 380, w: 80, h: 120 }] },
  { id: "c-lab", name: "lab hatch", rects: [{ x: 1090, y: 380, w: 80, h: 120 }] },
  { id: "c-medbay", name: "medbay hatch", rects: [{ x: 830, y: 780, w: 80, h: 120 }] },
  { id: "c-hydro", name: "hydro hatch", rects: [{ x: 1090, y: 780, w: 80, h: 120 }] },
  { id: "c-north", name: "north tube", rects: [{ x: 920, y: 190, w: 160, h: 80 }] },
  { id: "c-south", name: "south tube", rects: [{ x: 920, y: 1010, w: 160, h: 80 }] },
  {
    id: "c-reactor",
    name: "reactor tube",
    rects: [
      { x: 1480, y: 200, w: 280, h: 80 },
      { x: 1680, y: 200, w: 80, h: 280 },
    ],
  },
  {
    id: "c-dock",
    name: "dock tube",
    rects: [
      { x: 220, y: 800, w: 80, h: 250 },
      { x: 220, y: 970, w: 300, h: 80 },
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

const FLOOR_RECTS: Rect[] = [...ROOMS.map((r) => r.rect), ...CORRIDORS.flatMap((c) => c.rects)];
const SOLIDS: Shape[] = ROOMS.flatMap((r) => r.props.filter((p) => p.solid).map((p) => p.shape));

/** Does a circle of radius `r` at p overlap the shape? */
export function hitsShape(p: Point, s: Shape, r: number): boolean {
  switch (s.type) {
    case "rect": {
      const cx = Math.max(s.x, Math.min(p.x, s.x + s.w));
      const cy = Math.max(s.y, Math.min(p.y, s.y + s.h));
      return Math.hypot(p.x - cx, p.y - cy) < r;
    }
    case "circle":
      return Math.hypot(p.x - s.x, p.y - s.y) < s.r + r;
    case "ellipse": {
      const dx = (p.x - s.x) / (s.rx + r);
      const dy = (p.y - s.y) / (s.ry + r);
      return dx * dx + dy * dy < 1;
    }
  }
}

/** Can a diver of radius `r` stand at p: on the floor and clear of furniture? */
export function walkable(p: Point, r = BODY_RADIUS): boolean {
  const probes = [p, { x: p.x - r, y: p.y }, { x: p.x + r, y: p.y }, { x: p.x, y: p.y - r }, { x: p.x, y: p.y + r }];
  if (!probes.every((q) => FLOOR_RECTS.some((f) => inRect(q, f)))) return false;
  return !SOLIDS.some((s) => hitsShape(p, s, r));
}

// ---- Waypoint graph for AI movement -------------------------------------------------------

export const NODES: Record<string, Point> = {
  dock: { x: 260, y: 640 },
  comms: { x: 720, y: 230 },
  lab: { x: 1280, y: 230 },
  mess: { x: 1000, y: 545 },
  reactor: { x: 1700, y: 640 },
  medbay: { x: 720, y: 1050 },
  hydro: { x: 1280, y: 1050 },
  "mess-w": { x: 840, y: 640 },
  "mess-e": { x: 1160, y: 640 },
  "mess-nw": { x: 870, y: 545 },
  "mess-ne": { x: 1130, y: 545 },
  "mess-sw": { x: 870, y: 738 },
  "mess-se": { x: 1130, y: 738 },
  "comms-door": { x: 870, y: 340 },
  "lab-door": { x: 1130, y: 340 },
  "medbay-door": { x: 870, y: 940 },
  "hydro-door": { x: 1130, y: 940 },
  "lab-east": { x: 1440, y: 240 },
  "reactor-bend": { x: 1720, y: 240 },
  "reactor-door": { x: 1720, y: 520 },
  "dock-door": { x: 260, y: 760 },
  "dock-bend": { x: 260, y: 1010 },
  "medbay-west": { x: 560, y: 1010 },
};

const EDGES: Array<[string, string]> = [
  // ring around the mess table
  ["mess-w", "mess-nw"],
  ["mess-nw", "mess"],
  ["mess", "mess-ne"],
  ["mess-ne", "mess-e"],
  ["mess-e", "mess-se"],
  ["mess-se", "mess-sw"],
  ["mess-sw", "mess-w"],
  // spokes
  ["dock", "mess-w"],
  ["mess-e", "reactor"],
  ["comms", "lab"],
  ["medbay", "hydro"],
  ["comms", "comms-door"],
  ["comms-door", "mess-nw"],
  ["lab", "lab-door"],
  ["lab-door", "mess-ne"],
  ["medbay", "medbay-door"],
  ["medbay-door", "mess-sw"],
  ["hydro", "hydro-door"],
  ["hydro-door", "mess-se"],
  ["lab", "lab-east"],
  ["lab-east", "reactor-bend"],
  ["reactor-bend", "reactor-door"],
  ["reactor-door", "reactor"],
  ["dock", "dock-door"],
  ["dock-door", "dock-bend"],
  ["dock-bend", "medbay-west"],
  ["medbay-west", "medbay"],
];

export const GRAPH_EDGES = EDGES;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const ADJ: Record<string, string[]> = {};
for (const [a, b] of EDGES) {
  (ADJ[a] ??= []).push(b);
  (ADJ[b] ??= []).push(a);
}

/** Is the straight line a→b clear for a diver? */
export function straightWalkable(a: Point, b: Point, r = BODY_RADIUS): boolean {
  const steps = Math.ceil(dist(a, b) / 8);
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    if (!walkable({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, r)) return false;
  }
  return true;
}

/** Nearest node reachable in a straight clear line from p. */
export function nearestNode(p: Point): string | undefined {
  let best: string | undefined;
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

/** Dijkstra over the waypoint graph. Returns points to walk through, ending at `to`. */
export function findPath(from: Point, to: Point): Point[] {
  if (straightWalkable(from, to)) return [to];
  const start = nearestNode(from);
  const goal = nearestNode(to);
  if (!start || !goal) return [];
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
  return smooth(from, [...nodes.map((n) => NODES[n]!), to]);
}

/** Skip waypoints when a later one is already in clear view, so walks don't zig-zag. */
function smooth(from: Point, path: Point[]): Point[] {
  const out: Point[] = [];
  let cur = from;
  let i = 0;
  while (i < path.length) {
    let j = path.length - 1;
    while (j > i && !straightWalkable(cur, path[j]!)) j--;
    out.push(path[j]!);
    cur = path[j]!;
    i = j + 1;
  }
  return out;
}

/** A random standing spot inside a room: clear of furniture and in view of a waypoint. */
export function spotInRoom(room: RoomId, r: () => number): Point {
  const { rect } = ROOM_BY_ID[room];
  const pad = BODY_RADIUS + 10;
  for (let i = 0; i < 40; i++) {
    const p = { x: rect.x + pad + r() * (rect.w - pad * 2), y: rect.y + pad + r() * (rect.h - pad * 2) };
    if (walkable(p) && nearestNode(p)) return p;
  }
  return { ...NODES[room]! };
}
