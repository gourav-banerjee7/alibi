import { diverDataUrl } from "@/lib/art/diver";
import { drawConsole, drawFloor, drawProp, hexA } from "@/lib/art/props";
import { CORRIDORS, ROOMS, WORLD, type Rect } from "@/lib/game/map";
import { player } from "@/lib/game/rules";
import { killTarget, nearbyTask, pactCandidate } from "@/lib/game/sim";
import type { Character, GameState, LocationId, Point } from "@/lib/game/types";

/** The camera's view, in world units. The canvas keeps this aspect ratio. */
export const VIEW = { w: 960, h: 600 };

const PAL = {
  waterTop: "#070a14",
  waterBottom: "#03050a",
  corridor: "#0b1020",
  corridorLit: "#121a30",
  corridorEdge: "#1d2540",
  fog: "rgba(3,5,10,0.6)",
  glow: "#5ce1e6",
  ember: "#ffb547",
  coral: "#ff5d73",
  orchid: "#b48cff",
  kelp: "#5be49b",
  ink: "#e9ecf5",
};

/** Top-left of the camera, centred on the player and kept inside the station. */
export function cameraFor(state: GameState): Point {
  const p = player(state).pos;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  return { x: clamp(p.x - VIEW.w / 2, WORLD.width - VIEW.w), y: clamp(p.y - VIEW.h / 2, WORLD.height - VIEW.h) };
}

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

const SPRITE = 56;

function drawDiver(ctx: CanvasRenderingContext2D, c: Character, time: number, ring?: string) {
  const { dir, moving, step } = motion(c);
  const { x, y } = c.pos;
  const bob = moving ? Math.abs(Math.sin(step * 0.1)) * -3 : Math.sin(time * 2.2 + x * 0.05) * 1;

  if (ring) {
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 22, 8, 0, 0, Math.PI * 2);
    ctx.strokeStyle = ring;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = ring;
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  if (c.isPlayer) {
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 19, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = hexA(PAL.glow, 0.16);
    ctx.fill();
    ctx.strokeStyle = hexA(PAL.glow, 0.7);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const img = sprite(c.id);
  ctx.save();
  ctx.translate(x, y + bob - 14);
  if (dir.x < -0.15) ctx.scale(-1, 1);
  if (img) ctx.drawImage(img, -SPRITE / 2, -SPRITE / 2, SPRITE, SPRITE);
  else {
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fillStyle = c.color;
    ctx.fill();
  }
  ctx.restore();

  const label = c.isPlayer ? "You" : c.name;
  ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
  const w = ctx.measureText(label).width + 12;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y + 22, w, 15, 7.5);
  ctx.fillStyle = "rgba(5,7,13,0.8)";
  ctx.fill();
  ctx.strokeStyle = hexA(c.color, 0.6);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = PAL.ink;
  ctx.textAlign = "center";
  ctx.fillText(label, x, y + 33.5);
}

function drawBody(ctx: CanvasRenderingContext2D, c: Character, pos: Point, time: number) {
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + 8, 28, 10, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(160,20,45,0.45)";
  ctx.fill();
  const img = sprite(c.id, true);
  if (img) ctx.drawImage(img, pos.x - SPRITE / 2, pos.y - SPRITE / 2 - 4, SPRITE, SPRITE);
  const pulse = (Math.sin(time * 4) + 1) / 2;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 32 + pulse * 8, 0, Math.PI * 2);
  ctx.strokeStyle = hexA(PAL.ember, 0.25 + pulse * 0.35);
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

// ---- Station ------------------------------------------------------------------------------

const motes = Array.from({ length: 160 }, (_, i) => ({
  x: (i * 157) % WORLD.width,
  speed: 6 + ((i * 37) % 13),
  r: 0.8 + ((i * 7) % 3) * 0.6,
  phase: (i * 53) % WORLD.height,
  hue: i % 5 === 0 ? PAL.orchid : PAL.glow,
}));

function rectsOf(loc: LocationId): Rect[] {
  const room = ROOMS.find((r) => r.id === loc);
  if (room) return [room.rect];
  return CORRIDORS.find((c) => c.id === loc)?.rects ?? [];
}

function drawLabels(ctx: CanvasRenderingContext2D, youLoc: LocationId) {
  // A sign mounted on each room's top wall, so it never covers the furniture.
  ctx.font = "700 12px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const room of ROOMS) {
    const lit = room.id === youLoc;
    const { rect } = room;
    const label = room.name.toUpperCase();
    const lw = ctx.measureText(label).width + 22;
    const cx = rect.x + rect.w / 2;
    ctx.beginPath();
    ctx.roundRect(cx - lw / 2, rect.y - 11, lw, 22, 11);
    ctx.fillStyle = "#0b0f1a";
    ctx.fill();
    ctx.strokeStyle = hexA(room.tint, lit ? 0.9 : 0.45);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = hexA(room.tint, lit ? 1 : 0.75);
    ctx.fillText(label, cx, rect.y + 4.5);
  }
}

function drawMinimap(ctx: CanvasRenderingContext2D, state: GameState, cam: Point) {
  const you = player(state);
  const scale = 0.1;
  const w = WORLD.width * scale;
  const h = WORLD.height * scale;
  const ox = VIEW.w - w - 14;
  const oy = 14;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(ox - 8, oy - 8, w + 16, h + 16, 12);
  ctx.fillStyle = "rgba(5,7,13,0.78)";
  ctx.fill();
  ctx.strokeStyle = "#2d3a60";
  ctx.lineWidth = 1;
  ctx.stroke();
  for (const c of CORRIDORS) for (const r of c.rects) {
    ctx.fillStyle = c.id === you.loc ? "#3a4a78" : "#1d2540";
    ctx.fillRect(ox + r.x * scale, oy + r.y * scale, r.w * scale, r.h * scale);
  }
  for (const room of ROOMS) {
    const r = room.rect;
    ctx.beginPath();
    ctx.roundRect(ox + r.x * scale, oy + r.y * scale, r.w * scale, r.h * scale, 3);
    ctx.fillStyle = hexA(room.tint, room.id === you.loc ? 0.55 : 0.18);
    ctx.fill();
  }
  for (const t of state.tasks) {
    if (t.done) continue;
    ctx.beginPath();
    ctx.arc(ox + t.pos.x * scale, oy + t.pos.y * scale, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = PAL.ember;
    ctx.fill();
  }
  // camera frame and you
  ctx.strokeStyle = "rgba(233,236,245,0.35)";
  ctx.strokeRect(ox + cam.x * scale, oy + cam.y * scale, VIEW.w * scale, VIEW.h * scale);
  ctx.beginPath();
  ctx.arc(ox + you.pos.x * scale, oy + you.pos.y * scale, 3, 0, Math.PI * 2);
  ctx.fillStyle = PAL.glow;
  ctx.shadowColor = PAL.glow;
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.restore();
}

export function drawStation(ctx: CanvasRenderingContext2D, state: GameState, time: number) {
  const you = player(state);
  const cam = cameraFor(state);

  // the water fills the view, then everything else is drawn in world space
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  g.addColorStop(0, PAL.waterTop);
  g.addColorStop(1, PAL.waterBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);

  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  for (const m of motes) {
    const y = WORLD.height - ((time * m.speed + m.phase) % (WORLD.height + 20));
    const x = m.x + Math.sin(time * 0.6 + m.phase) * 8;
    if (x < cam.x - 10 || x > cam.x + VIEW.w + 10 || y < cam.y - 10 || y > cam.y + VIEW.h + 10) continue;
    ctx.beginPath();
    ctx.arc(x, y, m.r, 0, Math.PI * 2);
    ctx.fillStyle = hexA(m.hue, 0.16);
    ctx.fill();
  }

  // tubes, with guide lights
  for (const c of CORRIDORS) {
    for (const r of c.rects) {
      ctx.fillStyle = c.id === you.loc ? PAL.corridorLit : PAL.corridor;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
  }
  for (const c of CORRIDORS) {
    for (const r of c.rects) {
      ctx.strokeStyle = PAL.corridorEdge;
      ctx.lineWidth = 6;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      const horizontal = r.w > r.h;
      const len = horizontal ? r.w : r.h;
      for (let d = 16; d < len - 8; d += 32) {
        const on = Math.sin(time * 3 - d * 0.05) > 0.2;
        ctx.fillStyle = hexA(PAL.glow, on ? 0.5 : 0.15);
        const px = horizontal ? r.x + d : r.x + 6;
        const py = horizontal ? r.y + 6 : r.y + d;
        ctx.fillRect(px - 2, py - 2, 4, 4);
        const qx = horizontal ? r.x + d : r.x + r.w - 6;
        const qy = horizontal ? r.y + r.h - 6 : r.y + d;
        ctx.fillRect(qx - 2, qy - 2, 4, 4);
      }
    }
  }
  // re-fill tube interiors so the thick edge stroke doesn't cover the floor where tubes meet
  for (const c of CORRIDORS) for (const r of c.rects) {
    ctx.fillStyle = c.id === you.loc ? PAL.corridorLit : PAL.corridor;
    ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
  }

  // rooms: floor, walls, furniture, terminals
  for (const room of ROOMS) {
    drawFloor(ctx, room, room.id === you.loc, time);
  }
  for (const room of ROOMS) {
    for (const prop of room.props.filter((p) => !p.solid)) drawProp(ctx, prop, room, time);
  }

  // your tasks (rings on the floor, under people)
  for (const t of state.tasks) {
    const pulse = (Math.sin(time * 3.2) + 1) / 2;
    ctx.beginPath();
    ctx.ellipse(t.pos.x, t.pos.y + 6, 22 + (t.done ? 0 : pulse * 3), 10 + (t.done ? 0 : pulse), 0, 0, Math.PI * 2);
    ctx.strokeStyle = t.done ? hexA(PAL.kelp, 0.55) : hexA(PAL.ember, 0.55 + pulse * 0.4);
    ctx.lineWidth = 2.5;
    ctx.setLineDash(t.done ? [] : [6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const b of state.bodies) {
    if (b.foundAt !== undefined || b.loc !== you.loc) continue;
    drawBody(ctx, state.characters.find((c) => c.id === b.victim)!, b.pos, time);
  }

  // furniture and people sorted by depth, so you can walk in front of and behind things
  type Drawable = { y: number; draw: () => void };
  const items: Drawable[] = [];
  for (const room of ROOMS) {
    for (const prop of room.props.filter((p) => p.solid)) {
      const s = prop.shape;
      const bottom = s.type === "rect" ? s.y + s.h : s.type === "circle" ? s.y + s.r * 0.4 : s.y + s.ry * 0.3;
      items.push({ y: bottom, draw: () => drawProp(ctx, prop, room, time) });
    }
    for (const c of room.consoles) items.push({ y: c.y - 16, draw: () => drawConsole(ctx, c.x, c.y, room.tint, time) });
  }
  const target = killTarget(state)?.id;
  const offer = pactCandidate(state)?.id;
  for (const c of state.characters) if (c.alive) motion(c);
  for (const c of state.characters.filter((c) => c.alive && (c.isPlayer || c.loc === you.loc))) {
    items.push({ y: c.pos.y, draw: () => drawDiver(ctx, c, time, c.id === target ? PAL.coral : c.id === offer ? PAL.orchid : undefined) });
  }
  for (const it of items.sort((a, b) => a.y - b.y)) it.draw();

  // fog over everywhere you aren't
  ctx.fillStyle = PAL.fog;
  for (const room of ROOMS) {
    if (room.id === you.loc) continue;
    ctx.beginPath();
    ctx.roundRect(room.rect.x - 5, room.rect.y - 5, room.rect.w + 10, room.rect.h + 10, 20);
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
    const lamp = ctx.createRadialGradient(you.pos.x, you.pos.y, 10, you.pos.x, you.pos.y, 220);
    lamp.addColorStop(0, "rgba(255,240,200,0.10)");
    lamp.addColorStop(1, "rgba(255,240,200,0)");
    ctx.fillStyle = lamp;
    ctx.fillRect(cam.x, cam.y, VIEW.w, VIEW.h);
    ctx.restore();
  }

  const task = nearbyTask(state);
  if (task && task.progress > 0) {
    ctx.beginPath();
    ctx.arc(you.pos.x, you.pos.y - 52, 11, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(you.pos.x, you.pos.y - 52, 11, -Math.PI / 2, -Math.PI / 2 + task.progress * Math.PI * 2);
    ctx.strokeStyle = PAL.ember;
    ctx.stroke();
  }
  ctx.restore();

  // vignette, then the minimap in screen space
  const v = ctx.createRadialGradient(VIEW.w / 2, VIEW.h / 2, VIEW.h * 0.45, VIEW.w / 2, VIEW.h / 2, VIEW.w * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  drawMinimap(ctx, state, cam);
}
