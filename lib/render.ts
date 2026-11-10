import { diverDataUrl } from "@/lib/art/diver";
import { CORRIDORS, ROOMS, WORLD, type Rect } from "@/lib/game/map";
import { player } from "@/lib/game/rules";
import { killTarget, nearbyTask, pactCandidate } from "@/lib/game/sim";
import type { Character, GameState, LocationId, Point } from "@/lib/game/types";

const PAL = {
  waterTop: "#070a14",
  waterBottom: "#03050a",
  floor: "#0f1426",
  floorLit: "#141b33",
  corridor: "#0a0e1c",
  corridorEdge: "#1d2540",
  fog: "rgba(3,5,10,0.62)",
  glow: "#5ce1e6",
  ember: "#ffb547",
  coral: "#ff5d73",
  orchid: "#b48cff",
  kelp: "#5be49b",
  ink: "#e9ecf5",
};

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// ---- Sprites ------------------------------------------------------------------------------

const sprites = new Map<string, HTMLImageElement>();

function sprite(id: string, dead = false): HTMLImageElement | undefined {
  if (typeof Image === "undefined") return undefined;
  const key = `${id}:${dead}`;
  let img = sprites.get(key);
  if (!img) {
    img = new Image();
    img.src = diverDataUrl(id, { uid: `cv${id}${dead ? "d" : ""}`, dead });
    sprites.set(key, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : undefined;
}

const facing = new Map<string, { last: Point; dir: Point; step: number }>();

function motion(c: Character) {
  let f = facing.get(c.id);
  if (!f) {
    f = { last: { ...c.pos }, dir: { x: 1, y: 0 }, step: 0 };
    facing.set(c.id, f);
  }
  const dx = c.pos.x - f.last.x;
  const dy = c.pos.y - f.last.y;
  const moved = Math.hypot(dx, dy);
  if (moved > 0.3) {
    f.dir = { x: dx / moved, y: dy / moved };
    f.step += moved;
  }
  f.last = { ...c.pos };
  return { dir: f.dir, moving: moved > 0.3, step: f.step };
}

const SPRITE = 48; // world units

function drawDiver(ctx: CanvasRenderingContext2D, c: Character, time: number, ring?: string) {
  const { dir, moving, step } = motion(c);
  const { x, y } = c.pos;
  const bob = moving ? Math.abs(Math.sin(step * 0.18)) * -2.2 : Math.sin(time * 2.2 + x * 0.05) * 0.8;

  if (ring) {
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 17, 6.5, 0, 0, Math.PI * 2);
    ctx.strokeStyle = ring;
    ctx.lineWidth = 2;
    ctx.shadowColor = ring;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (c.isPlayer) {
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 15, 5.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = hexA(PAL.glow, 0.18);
    ctx.fill();
    ctx.strokeStyle = hexA(PAL.glow, 0.7);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const img = sprite(c.id);
  ctx.save();
  ctx.translate(x, y + bob - 10);
  if (dir.x < -0.15) ctx.scale(-1, 1);
  if (img) ctx.drawImage(img, -SPRITE / 2, -SPRITE / 2, SPRITE, SPRITE);
  else {
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fillStyle = c.color;
    ctx.fill();
  }
  ctx.restore();

  // name pill
  const label = c.isPlayer ? "You" : c.name;
  ctx.font = "600 9.5px ui-sans-serif, system-ui, sans-serif";
  const w = ctx.measureText(label).width + 10;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y + 19, w, 13, 6.5);
  ctx.fillStyle = "rgba(5,7,13,0.78)";
  ctx.fill();
  ctx.strokeStyle = hexA(c.color, 0.55);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = PAL.ink;
  ctx.textAlign = "center";
  ctx.fillText(label, x, y + 28.5);
}

function drawBody(ctx: CanvasRenderingContext2D, c: Character, pos: Point, time: number) {
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + 6, 22, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(160,20,45,0.45)";
  ctx.fill();
  const img = sprite(c.id, true);
  if (img) ctx.drawImage(img, pos.x - SPRITE / 2, pos.y - SPRITE / 2 - 4, SPRITE, SPRITE);
  // a pulsing alarm ring so a body is hard to miss
  const pulse = (Math.sin(time * 4) + 1) / 2;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 24 + pulse * 6, 0, Math.PI * 2);
  ctx.strokeStyle = hexA(PAL.ember, 0.25 + pulse * 0.35);
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawLabels(ctx: CanvasRenderingContext2D, youLoc: LocationId) {
  for (const room of ROOMS) {
    const lit = room.id === youLoc;
    const { rect } = room;
    ctx.font = "700 9.5px ui-sans-serif, system-ui, sans-serif";
    const label = room.name.toUpperCase();
    const lw = ctx.measureText(label).width + 14;
    ctx.beginPath();
    ctx.roundRect(rect.x + 8, rect.y + 8, lw, 16, 8);
    ctx.fillStyle = hexA(room.tint, lit ? 0.2 : 0.1);
    ctx.fill();
    ctx.fillStyle = hexA(room.tint, lit ? 1 : 0.7);
    ctx.textAlign = "left";
    ctx.fillText(label, rect.x + 15, rect.y + 19.5);

  }
}

// ---- Station ------------------------------------------------------------------------------

const motes = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 157) % WORLD.width,
  speed: 5 + ((i * 37) % 11),
  r: 0.6 + ((i * 7) % 3) * 0.5,
  phase: (i * 53) % WORLD.height,
  hue: i % 5 === 0 ? PAL.orchid : PAL.glow,
}));

function rectsOf(loc: LocationId): Rect[] {
  const room = ROOMS.find((r) => r.id === loc);
  if (room) return [room.rect];
  return CORRIDORS.find((c) => c.id === loc)?.rects ?? [];
}

export function drawStation(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  const you = player(state);

  // the water
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  g.addColorStop(0, PAL.waterTop);
  g.addColorStop(1, PAL.waterBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  for (const m of motes) {
    const y = WORLD.height - ((time * m.speed + m.phase) % (WORLD.height + 20));
    ctx.beginPath();
    ctx.arc(m.x + Math.sin(time * 0.6 + m.phase) * 6, y, m.r, 0, Math.PI * 2);
    ctx.fillStyle = hexA(m.hue, 0.16);
    ctx.fill();
  }

  // tubes
  for (const c of CORRIDORS) {
    const lit = c.id === you.loc;
    for (const r of c.rects) {
      ctx.fillStyle = lit ? "#10172b" : PAL.corridor;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  }
  for (const c of CORRIDORS) {
    for (const r of c.rects) {
      ctx.strokeStyle = PAL.corridorEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      // guide lights along the tube
      ctx.fillStyle = hexA(PAL.glow, 0.22);
      const horizontal = r.w > r.h;
      const len = horizontal ? r.w : r.h;
      for (let d = 10; d < len - 4; d += 18) {
        const px = horizontal ? r.x + d : r.x + r.w / 2;
        const py = horizontal ? r.y + r.h / 2 : r.y + d;
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
    }
  }

  // rooms
  for (const room of ROOMS) {
    const lit = room.id === you.loc;
    const { rect } = room;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 14);
    ctx.fillStyle = lit ? PAL.floorLit : PAL.floor;
    ctx.fill();
    ctx.clip();
    // accent light pooled in the room
    const pool = ctx.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h / 2, 4, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w * 0.75);
    pool.addColorStop(0, hexA(room.tint, lit ? 0.16 : 0.07));
    pool.addColorStop(1, hexA(room.tint, 0));
    ctx.fillStyle = pool;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    // floor plates
    ctx.strokeStyle = "rgba(255,255,255,0.028)";
    ctx.lineWidth = 1;
    for (let x = rect.x + 20; x < rect.x + rect.w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, rect.y);
      ctx.lineTo(x, rect.y + rect.h);
      ctx.stroke();
    }
    for (let y = rect.y + 20; y < rect.y + rect.h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(rect.x, y);
      ctx.lineTo(rect.x + rect.w, y);
      ctx.stroke();
    }
    ctx.restore();

    // glowing wall
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 14);
    ctx.strokeStyle = hexA(room.tint, lit ? 0.85 : 0.35);
    ctx.lineWidth = lit ? 2 : 1.5;
    if (lit) {
      ctx.shadowColor = room.tint;
      ctx.shadowBlur = 14;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // consoles
    for (const p of room.consoles) {
      ctx.beginPath();
      ctx.roundRect(p.x - 8, p.y - 6, 16, 12, 3);
      ctx.fillStyle = "#0a0f1e";
      ctx.fill();
      ctx.strokeStyle = hexA(room.tint, 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = hexA(room.tint, 0.5 + Math.sin(time * 2 + p.x) * 0.2);
      ctx.fillRect(p.x - 4, p.y - 2, 8, 3);
    }
  }

  // mess table
  ctx.beginPath();
  ctx.ellipse(500, 320, 36, 21, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#2a3150";
  ctx.fill();
  ctx.strokeStyle = hexA(PAL.ember, 0.5);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // your tasks
  for (const t of state.tasks) {
    const pulse = (Math.sin(time * 3.2) + 1) / 2;
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, 13 + (t.done ? 0 : pulse * 2), 0, Math.PI * 2);
    ctx.strokeStyle = t.done ? hexA(PAL.kelp, 0.55) : hexA(PAL.ember, 0.55 + pulse * 0.4);
    ctx.lineWidth = 2;
    ctx.setLineDash(t.done ? [] : [5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // bodies where you are
  for (const b of state.bodies) {
    if (b.foundAt !== undefined || b.loc !== you.loc) continue;
    const victim = state.characters.find((c) => c.id === b.victim)!;
    drawBody(ctx, victim, b.pos, time);
  }

  // people you can see
  const target = killTarget(state)?.id;
  const offer = pactCandidate(state)?.id;
  for (const c of state.characters) if (c.alive) motion(c);
  const visible = state.characters.filter((c) => c.alive && (c.isPlayer || c.loc === you.loc)).sort((a, b) => a.pos.y - b.pos.y);
  for (const c of visible) drawDiver(ctx, c, time, c.id === target ? PAL.coral : c.id === offer ? PAL.orchid : undefined);

  // fog everywhere else
  ctx.fillStyle = PAL.fog;
  for (const room of ROOMS) {
    if (room.id === you.loc) continue;
    ctx.beginPath();
    ctx.roundRect(room.rect.x, room.rect.y, room.rect.w, room.rect.h, 14);
    ctx.fill();
  }
  for (const c of CORRIDORS) if (c.id !== you.loc) for (const r of c.rects) ctx.fillRect(r.x, r.y, r.w, r.h);

  drawLabels(ctx, you.loc);

  // your helmet lamp
  if (you.alive) {
    ctx.save();
    ctx.beginPath();
    for (const r of rectsOf(you.loc)) ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    const lamp = ctx.createRadialGradient(you.pos.x, you.pos.y, 8, you.pos.x, you.pos.y, 150);
    lamp.addColorStop(0, "rgba(255,240,200,0.10)");
    lamp.addColorStop(1, "rgba(255,240,200,0)");
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.restore();
  }

  // task progress
  const task = nearbyTask(state);
  if (task && task.progress > 0) {
    ctx.beginPath();
    ctx.arc(you.pos.x, you.pos.y - 36, 9, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(you.pos.x, you.pos.y - 36, 9, -Math.PI / 2, -Math.PI / 2 + task.progress * Math.PI * 2);
    ctx.strokeStyle = PAL.ember;
    ctx.stroke();
  }
}
