import { describe, expect, it } from "vitest";
import { findPath, GRAPH_EDGES, nearestNode, NODES, ROOMS, spotInRoom, straightWalkable, walkable, locationAt } from "@/lib/game/map";
import { seatInMess } from "@/lib/game/setup";

describe("station geometry", () => {
  it("every waypoint is standable", () => {
    for (const [id, p] of Object.entries(NODES)) expect(walkable(p), id).toBe(true);
  });

  it("no waypoint edge passes through furniture or a wall", () => {
    for (const [a, b] of GRAPH_EDGES) expect(straightWalkable(NODES[a]!, NODES[b]!), `${a} → ${b}`).toBe(true);
  });

  it("every console is standable and reachable", () => {
    for (const room of ROOMS) {
      for (const c of room.consoles) {
        expect(walkable(c), `${room.id} console ${c.x},${c.y}`).toBe(true);
        expect(locationAt(c)).toBe(room.id);
        expect(nearestNode(c), `${room.id} console sees a node`).toBeDefined();
      }
    }
  });

  it("every mess seat is clear of the table", () => {
    for (let n = 2; n <= 6; n++) for (let i = 0; i < n; i++) expect(walkable(seatInMess(i, n)), `seat ${i}/${n}`).toBe(true);
  });

  it("random errand spots are standable, and paths to them never clip furniture", () => {
    let seed = 1;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const room of ROOMS) {
      for (let i = 0; i < 25; i++) {
        const to = spotInRoom(room.id, r);
        expect(walkable(to), `${room.id} spot`).toBe(true);
        const from = seatInMess(i % 6, 6);
        const path = findPath(from, to);
        expect(path.length, `${room.id} path`).toBeGreaterThan(0);
        let prev = from;
        for (const p of path) {
          expect(straightWalkable(prev, p), `${room.id}: ${prev.x},${prev.y} → ${p.x},${p.y}`).toBe(true);
          prev = p;
        }
        expect(locationAt(path[path.length - 1]!)).toBe(room.id);
      }
    }
  });
});

describe("walking into furniture", () => {
  it("the player slides along props and walls but never ends up inside them", async () => {
    const { newGame } = await import("@/lib/game/setup");
    const { tick } = await import("@/lib/game/sim");
    const s = newGame(5);
    const you = s.characters[0]!;
    const dirs = [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 0, y: -1 },
      { x: 0.7071, y: 0.7071 },
      { x: -0.7071, y: 0.7071 },
    ];
    // Wander hard in each direction for a while; every position must stay standable.
    for (const dir of dirs) {
      for (let i = 0; i < 120 && s.phase === "roam"; i++) {
        tick(s, { dir, use: false });
        expect(walkable(you.pos), `at ${you.pos.x.toFixed(1)},${you.pos.y.toFixed(1)}`).toBe(true);
      }
    }
  });
});
