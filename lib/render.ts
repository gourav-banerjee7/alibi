import { CORRIDORS, ROOMS, WORLD, type Rect } from "@/lib/game/map";
import { player } from "@/lib/game/rules";
import { killTarget, nearbyTask, pactCandidate } from "@/lib/game/sim";
import type { Character, GameState, LocationId, Point } from "@/lib/game/types";

const facing = new Map<string, { last: Point; dir: Point }>();

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
}

function updateFacing(c: Character): Point {
  const f = facing.get(c.id);
  if (!f) {
    facing.set(c.id, { last: { ...c.pos }, dir: { x: 0, y: 1 } });
    return { x: 0, y: 1 };
  }
  const dx = c.pos.x - f.last.x;
  const dy = c.pos.y - f.last.y;
  const len = Math.hypot(dx, dy);
  if (len > 0.3) f.dir = { x: dx / len, y: dy / len };
  f.last = { ...c.pos };
  return f.dir;
}

/** An original diver: round suit, big glass helmet, a tank on the back and a head lamp. */
function drawDiver(ctx: CanvasRenderingContext2D, c: Character, dir: Point, time: number, highlight?: string) {
  const { x, y } = c.pos;
  const bob = Math.sin(time * 3 + x * 0.05) * 0.8;

  if (highlight) {
    ctx.beginPath();
    ctx.arc(x, y + bob, 19, 0, Math.PI * 2);
    ctx.strokeStyle = highlight;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // shadow
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 10, 3.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();

  // air tank, behind the diver
  ctx.save();
  ctx.translate(x - dir.x * 8, y + bob - dir.y * 8);
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.roundRect(-4, -7, 8, 14, 3);
  ctx.fill();
  ctx.restore();

  // suit
  ctx.beginPath();
  ctx.arc(x, y + bob, 11, 0, Math.PI * 2);
  ctx.fillStyle = c.color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.stroke();

  // helmet glass, facing the walking direction
  const hx = x + dir.x * 4;
  const hy = y + bob + dir.y * 4 - 2;
  ctx.beginPath();
  ctx.arc(hx, hy, 6.5, 0, Math.PI * 2);
  ctx.fillStyle = "#0b2236";
  ctx.fill();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx - 2, hy - 2, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();

  // head lamp glow
  ctx.beginPath();
  ctx.arc(x, y + bob - 10, 2, 0, Math.PI * 2);
  ctx.fillStyle = "#fde68a";
  ctx.fill();

  if (c.isPlayer) {
    ctx.beginPath();
    ctx.arc(x, y + bob, 14, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(226,232,240,0.95)";
  ctx.fillText(c.isPlayer ? "You" : c.name, x, y + bob + 26);
}

function drawBody(ctx: CanvasRenderingContext2D, c: Character, pos: Point) {
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + 4, 16, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(127,29,29,0.55)";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y, 12, 7, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = c.color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(pos.x + 8, pos.y - 3, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#0b2236";
  ctx.fill();
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.stroke();
}

const bubbles = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 197) % WORLD.width,
  speed: 8 + ((i * 37) % 13),
  r: 1 + ((i * 7) % 3),
  phase: (i * 53) % WORLD.height,
}));

function rectsOf(loc: LocationId): Rect[] {
  const room = ROOMS.find((r) => r.id === loc);
  if (room) return [room.rect];
  return CORRIDORS.find((c) => c.id === loc)?.rects ?? [];
}

export function drawStation(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  const you = player(state);

  // the deep
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  g.addColorStop(0, "#041021");
  g.addColorStop(1, "#02070f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  for (const b of bubbles) {
    const y = WORLD.height - ((time * b.speed + b.phase) % (WORLD.height + 20));
    ctx.beginPath();
    ctx.arc(b.x + Math.sin(time + b.phase) * 4, y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(125,211,252,0.12)";
    ctx.fill();
  }

  // corridors
  for (const c of CORRIDORS) {
    for (const r of c.rects) {
      ctx.fillStyle = "#0c1a2c";
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  }
  for (const c of CORRIDORS) {
    for (const r of c.rects) {
      ctx.strokeStyle = "#1c3352";
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }
  }

  // rooms
  for (const room of ROOMS) {
    roundRect(ctx, room.rect, 12);
    ctx.fillStyle = room.tint;
    ctx.fill();
    ctx.strokeStyle = "#2b4c74";
    ctx.lineWidth = 2;
    ctx.stroke();
    // floor grating
    ctx.save();
    roundRect(ctx, room.rect, 12);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    for (let x = room.rect.x; x < room.rect.x + room.rect.w; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, room.rect.y);
      ctx.lineTo(x, room.rect.y + room.rect.h);
      ctx.stroke();
    }
    ctx.restore();

    ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(186,230,253,0.6)";
    ctx.fillText(room.name.toUpperCase(), room.rect.x + 10, room.rect.y + 18);

    for (const p of room.consoles) {
      ctx.fillStyle = "#0f2740";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(p.x - 7, p.y - 5, 14, 10, 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // mess table
  ctx.beginPath();
  ctx.ellipse(500, 320, 34, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#3b4466";
  ctx.fill();

  // the player's tasks
  for (const t of state.tasks) {
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, 12, 0, Math.PI * 2);
    ctx.strokeStyle = t.done ? "rgba(52,211,153,0.7)" : `rgba(250,204,21,${0.55 + Math.sin(time * 4) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // bodies in your location
  for (const b of state.bodies) {
    if (b.foundAt !== undefined || b.loc !== you.loc) continue;
    const victim = state.characters.find((c) => c.id === b.victim)!;
    drawBody(ctx, victim, b.pos);
  }

  // people: you see only who shares your location
  const target = killTarget(state)?.id;
  const offer = pactCandidate(state)?.id;
  const visible = state.characters.filter((c) => c.alive && (c.isPlayer || c.loc === you.loc));
  for (const c of state.characters) if (c.alive) updateFacing(c);
  for (const c of visible.sort((a, b) => a.pos.y - b.pos.y)) {
    const highlight = c.id === target ? "#f43f5e" : c.id === offer ? "#a78bfa" : undefined;
    drawDiver(ctx, c, facing.get(c.id)?.dir ?? { x: 0, y: 1 }, time, highlight);
  }

  // fog over everywhere you aren't
  ctx.fillStyle = "rgba(2,6,15,0.62)";
  for (const room of ROOMS) if (room.id !== you.loc) {
    roundRect(ctx, room.rect, 12);
    ctx.fill();
  }
  for (const c of CORRIDORS) if (c.id !== you.loc) for (const r of c.rects) ctx.fillRect(r.x, r.y, r.w, r.h);

  // light around you
  if (you.alive) {
    const lamp = ctx.createRadialGradient(you.pos.x, you.pos.y, 10, you.pos.x, you.pos.y, 140);
    lamp.addColorStop(0, "rgba(253,230,138,0.10)");
    lamp.addColorStop(1, "rgba(253,230,138,0)");
    ctx.fillStyle = lamp;
    for (const r of rectsOf(you.loc)) ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  // task progress ring
  const task = nearbyTask(state);
  if (task && task.progress > 0) {
    ctx.beginPath();
    ctx.arc(you.pos.x, you.pos.y - 30, 9, -Math.PI / 2, -Math.PI / 2 + task.progress * Math.PI * 2);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}
