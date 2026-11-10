/**
 * Room interiors, drawn in code. Each prop kind has its own little scene, animated by `time`.
 * Shapes come from the map, so what you see is exactly what you bump into.
 */
import type { Prop, Rect, Room, Shape } from "@/lib/game/map";

type Ctx = CanvasRenderingContext2D;

export const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const OUTLINE = "#05070d";

function box(ctx: Ctx, r: Rect, fill: string, radius = 6, stroke = OUTLINE, lw = 2) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function dropShadow(ctx: Ctx, s: Shape) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  if (s.type === "rect") ctx.roundRect(s.x + 4, s.y + 7, s.w, s.h, 8);
  else if (s.type === "circle") ctx.arc(s.x + 3, s.y + 6, s.r, 0, Math.PI * 2);
  else ctx.ellipse(s.x + 3, s.y + 7, s.rx, s.ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function hazard(ctx: Ctx, r: Rect, stripe = 10) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.fillStyle = "#1c1606";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = "rgba(255,181,71,0.55)";
  for (let x = r.x - r.h; x < r.x + r.w + r.h; x += stripe * 2) {
    ctx.beginPath();
    ctx.moveTo(x, r.y + r.h);
    ctx.lineTo(x + stripe, r.y + r.h);
    ctx.lineTo(x + stripe + r.h, r.y);
    ctx.lineTo(x + r.h, r.y);
    ctx.fill();
  }
  ctx.restore();
}

// ---- Floors -------------------------------------------------------------------------------

export function drawFloor(ctx: Ctx, room: Room, lit: boolean, time: number) {
  const { rect, id, tint } = room;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 18);
  const base: Record<string, string> = {
    dock: "#0e1626",
    comms: "#11132a",
    lab: "#121c2c",
    mess: "#1a1620",
    reactor: "#1a1119",
    medbay: "#0f1c1d",
    hydro: "#0f1a14",
  };
  ctx.fillStyle = base[id] ?? "#0f1426";
  ctx.fill();
  ctx.clip();

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  if (id === "lab" || id === "medbay") {
    // clean square tiles
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = rect.x; x < rect.x + rect.w; x += 32) line(x, rect.y, x, rect.y + rect.h);
    for (let y = rect.y; y < rect.y + rect.h; y += 32) line(rect.x, y, rect.x + rect.w, y);
  } else if (id === "mess") {
    // warm deck planks
    ctx.strokeStyle = "rgba(255,200,140,0.06)";
    ctx.lineWidth = 1;
    for (let y = rect.y; y < rect.y + rect.h; y += 22) line(rect.x, y, rect.x + rect.w, y);
    for (let y = rect.y, row = 0; y < rect.y + rect.h; y += 22, row++) {
      for (let x = rect.x + (row % 2) * 60; x < rect.x + rect.w; x += 120) line(x, y, x, y + 22);
    }
  } else if (id === "reactor") {
    // diamond plate
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    for (let y = rect.y + 8; y < rect.y + rect.h; y += 18) {
      for (let x = rect.x + ((y / 18) % 2) * 9; x < rect.x + rect.w; x += 18) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-3, -1, 6, 2);
        ctx.restore();
      }
    }
  } else if (id === "comms") {
    // carpet tiles
    for (let x = rect.x, i = 0; x < rect.x + rect.w; x += 50, i++) {
      for (let y = rect.y, j = 0; y < rect.y + rect.h; y += 50, j++) {
        ctx.fillStyle = (i + j) % 2 ? "rgba(139,147,255,0.035)" : "rgba(0,0,0,0.12)";
        ctx.fillRect(x, y, 50, 50);
      }
    }
  } else {
    // grating (dock, hydro)
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = rect.x; x < rect.x + rect.w; x += 12) line(x, rect.y, x, rect.y + rect.h);
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    for (let y = rect.y; y < rect.y + rect.h; y += 48) line(rect.x, y, rect.x + rect.w, y);
    if (id === "hydro") {
      ctx.fillStyle = "rgba(91,228,155,0.05)"; // puddles
      ctx.beginPath();
      ctx.ellipse(rect.x + 120, rect.y + 200, 40, 14, 0.2, 0, Math.PI * 2);
      ctx.ellipse(rect.x + 300, rect.y + 90, 30, 10, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // pooled accent light
  const pool = ctx.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h / 2, 10, rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w * 0.7);
  pool.addColorStop(0, hexA(tint, lit ? 0.14 : 0.06));
  pool.addColorStop(1, hexA(tint, 0));
  ctx.fillStyle = pool;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  // hydroponics grow lights flicker gently
  if (id === "hydro") {
    ctx.fillStyle = `rgba(190,120,255,${0.035 + Math.sin(time * 1.3) * 0.01})`;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();

  // walls
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 18);
  ctx.strokeStyle = "#1a2236";
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 18);
  ctx.strokeStyle = hexA(tint, lit ? 0.8 : 0.3);
  ctx.lineWidth = 2;
  if (lit) {
    ctx.shadowColor = tint;
    ctx.shadowBlur = 16;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// ---- Props --------------------------------------------------------------------------------

export function drawProp(ctx: Ctx, prop: Prop, room: Room, time: number) {
  const s = prop.shape;
  const tint = room.tint;
  if (prop.solid) dropShadow(ctx, s);

  switch (prop.kind) {
    case "moonpool": {
      const r = s as Rect;
      hazard(ctx, { x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 }, 8);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 10);
      const water = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      water.addColorStop(0, "#0a3b55");
      water.addColorStop(1, "#04182a");
      ctx.fillStyle = water;
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = "rgba(120,220,255,0.25)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const y = r.y + 12 + i * 16;
        ctx.beginPath();
        for (let x = r.x; x <= r.x + r.w; x += 6) ctx.lineTo(x, y + Math.sin(x * 0.08 + time * 2 + i) * 2.5);
        ctx.stroke();
      }
      // the docked sub
      const bob = Math.sin(time * 1.4) * 2;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2 + bob;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 46, 20, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#ffc94a";
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#e6a92a";
      ctx.beginPath();
      ctx.roundRect(cx - 12, cy - 30, 24, 16, 5);
      ctx.fill();
      ctx.stroke();
      for (const dx of [-22, 0, 22]) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#0b2236";
        ctx.fill();
        ctx.strokeStyle = "#8a6a2a";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "crates": {
      const r = s as Rect;
      const w = r.w / 2 - 2;
      const h = r.h / 2 - 2;
      [
        [0, 0],
        [w + 4, 0],
        [0, h + 4],
        [w + 4, h + 4],
      ].forEach(([dx, dy], i) => {
        const c = { x: r.x + dx!, y: r.y + dy!, w, h };
        box(ctx, c, i % 3 === 0 ? "#3a2f22" : "#2c3550", 4);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c.x + 4, c.y + 4);
        ctx.lineTo(c.x + c.w - 4, c.y + c.h - 4);
        ctx.moveTo(c.x + c.w - 4, c.y + 4);
        ctx.lineTo(c.x + 4, c.y + c.h - 4);
        ctx.stroke();
      });
      break;
    }
    case "ballast":
    case "pipes": {
      const r = s as Rect;
      box(ctx, r, "#232c44", 6);
      ctx.strokeStyle = prop.kind === "pipes" ? "#8b5a4a" : "#4a5878";
      ctx.lineWidth = 5;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(r.x + 4, r.y + 8 + i * 9);
        ctx.lineTo(r.x + r.w - 4, r.y + 8 + i * 9);
        ctx.stroke();
      }
      const gauges = prop.kind === "ballast" ? 3 : 2;
      for (let i = 0; i < gauges; i++) {
        const gx = r.x + 20 + i * ((r.w - 40) / Math.max(1, gauges - 1));
        const gy = r.y + r.h / 2;
        ctx.beginPath();
        ctx.arc(gx, gy, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#e9ecf5";
        ctx.fill();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const a = -Math.PI * 0.75 + (Math.sin(time * 0.9 + i * 2) + 1) * 0.6;
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + Math.cos(a) * 6, gy + Math.sin(a) * 6);
        ctx.strokeStyle = "#ff5d73";
        ctx.stroke();
      }
      break;
    }
    case "lockers": {
      const r = s as Rect;
      const n = 5;
      for (let i = 0; i < n; i++) {
        const lw = r.w / n;
        box(ctx, { x: r.x + i * lw + 1, y: r.y, w: lw - 2, h: r.h }, i % 2 ? "#2a3552" : "#253049", 3, OUTLINE, 1.5);
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(r.x + i * lw + 6, r.y + 6, lw - 12, 2);
      }
      break;
    }
    case "sonarwall": {
      const r = s as Rect;
      box(ctx, r, "#0a0e1e", 8, "#2d3a60", 3);
      // radar sweep
      const cx = r.x + 34;
      const cy = r.y + r.h / 2;
      const rad = r.h / 2 - 5;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = hexA(tint, 0.12);
      ctx.fill();
      const a = time * 1.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rad, a - 0.6, a);
      ctx.fillStyle = hexA(tint, 0.45);
      ctx.fill();
      ctx.fillStyle = "#ff5d73";
      ctx.beginPath();
      ctx.arc(cx + 8, cy - 5, 1.8, 0, Math.PI * 2);
      ctx.fill();
      // waveform
      ctx.strokeStyle = hexA(tint, 0.85);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = r.x + 70; x < r.x + r.w - 10; x += 3) {
        const y = cy + Math.sin(x * 0.12 + time * 5) * 7 * Math.sin(x * 0.02 + time);
        if (x === r.x + 70) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case "desk": {
      const r = s as Rect;
      box(ctx, r, "#2a2f4a", 6);
      for (let i = 0; i < 3; i++) {
        const m = { x: r.x + 10 + i * 46, y: r.y + 6, w: 38, h: 22 };
        box(ctx, m, "#0a0e1e", 3, OUTLINE, 1.5);
        ctx.fillStyle = hexA(tint, 0.35 + 0.15 * Math.sin(time * 3 + i));
        ctx.fillRect(m.x + 3, m.y + 3, m.w - 6, m.h - 6);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        for (let l = 0; l < 3; l++) ctx.fillRect(m.x + 6, m.y + 6 + l * 5, 10 + ((i * 7 + l * 5) % 16), 1.5);
      }
      ctx.fillStyle = "#151a2e";
      ctx.fillRect(r.x + 40, r.y + 34, 70, 10);
      break;
    }
    case "rack": {
      const r = s as Rect;
      box(ctx, r, "#141a2e", 4);
      for (let y = r.y + 8; y < r.y + r.h - 6; y += 10) {
        ctx.fillStyle = "#1f2742";
        ctx.fillRect(r.x + 5, y, r.w - 10, 6);
        const on = Math.sin(time * 6 + y) > 0;
        ctx.fillStyle = on ? "#5be49b" : "#1b3a2a";
        ctx.fillRect(r.x + r.w - 12, y + 2, 3, 2);
        ctx.fillStyle = Math.sin(time * 4 + y * 3) > 0.6 ? "#ffb547" : "#3a2c12";
        ctx.fillRect(r.x + r.w - 17, y + 2, 3, 2);
      }
      break;
    }
    case "bench": {
      const r = s as Rect;
      box(ctx, r, "#c9d2e6", 6);
      ctx.fillStyle = "#aeb8d0";
      ctx.fillRect(r.x + 3, r.y + r.h - 8, r.w - 6, 5);
      // specimen jars
      const colors = ["#3ee0c8", "#ff6fa5", "#b5e853", "#5ce1e6"];
      for (let i = 0; i < 4; i++) {
        const jx = r.x + 22 + i * 32;
        const jy = r.y + r.h / 2 - 2;
        const glow = 0.55 + Math.sin(time * 2.4 + i) * 0.25;
        ctx.beginPath();
        ctx.arc(jx, jy, 10, 0, Math.PI * 2);
        ctx.fillStyle = hexA(colors[i]!, glow);
        ctx.shadowColor = colors[i]!;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(jx - 5, jy - 6, 2, 4);
      }
      // microscope
      ctx.fillStyle = "#2a3150";
      ctx.beginPath();
      ctx.arc(r.x + r.w - 14, r.y + r.h / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      break;
    }
    case "tank": {
      const c = s as { x: number; y: number; r: number };
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = "#4a5878";
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r - 5, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r);
      g.addColorStop(0, hexA(tint, 0.7));
      g.addColorStop(1, "#06202a");
      ctx.fillStyle = g;
      ctx.fill();
      // a jellyfish
      const p = Math.sin(time * 2 + c.x) * 2;
      ctx.fillStyle = "rgba(255,180,230,0.85)";
      ctx.beginPath();
      ctx.arc(c.x, c.y - 2 + p, 7 + p * 0.3, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,180,230,0.6)";
      ctx.lineWidth = 1;
      for (let i = -4; i <= 4; i += 4) {
        ctx.beginPath();
        ctx.moveTo(c.x + i, c.y - 2 + p);
        ctx.quadraticCurveTo(c.x + i + Math.sin(time * 3 + i) * 3, c.y + 5 + p, c.x + i, c.y + 10 + p);
        ctx.stroke();
      }
      break;
    }
    case "table": {
      const e = s as { x: number; y: number; rx: number; ry: number };
      // benches
      ctx.fillStyle = "#3a2d26";
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.rx + 6, e.ry + 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.rx, e.ry, 0, 0, Math.PI * 2);
      const wood = ctx.createLinearGradient(e.x, e.y - e.ry, e.x, e.y + e.ry);
      wood.addColorStop(0, "#6b4a35");
      wood.addColorStop(1, "#4a3224");
      ctx.fillStyle = wood;
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      // trays, cups and the emergency button in the middle
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = e.x + Math.cos(a) * e.rx * 0.65;
        const py = e.y + Math.sin(a) * e.ry * 0.62;
        ctx.fillStyle = "#cfd6e8";
        ctx.beginPath();
        ctx.ellipse(px, py, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const pulse = (Math.sin(time * 3) + 1) / 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = "#2a1a1a";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e.x, e.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,93,115,${0.75 + pulse * 0.25})`;
      ctx.shadowColor = "#ff5d73";
      ctx.shadowBlur = 8 + pulse * 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case "galley": {
      const r = s as Rect;
      box(ctx, r, "#3a4462", 5);
      ctx.fillStyle = "#ffb547";
      ctx.fillRect(r.x + 6, r.y + 6, 6, 4);
      // steam
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 2; i++) {
        const t = (time * 0.8 + i * 0.5) % 1;
        ctx.beginPath();
        ctx.arc(r.x + 22 + i * 6, r.y - t * 22, 3 + t * 3, 0, Math.PI * 2);
        ctx.globalAlpha = 1 - t;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      break;
    }
    case "core": {
      const c = s as { x: number; y: number; r: number };
      const pulse = (Math.sin(time * 2.6) + 1) / 2;
      const glow = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, c.r * 2.1);
      glow.addColorStop(0, `rgba(255,107,125,${0.35 + pulse * 0.2})`);
      glow.addColorStop(1, "rgba(255,107,125,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = "#2a1f2e";
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(time * 0.8);
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.fillStyle = "#4a3a50";
        ctx.fillRect(c.r * 0.45, -4, c.r * 0.45, 8);
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 0.42, 0, Math.PI * 2);
      const inner = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r * 0.42);
      inner.addColorStop(0, "#fff3d6");
      inner.addColorStop(0.5, "#ff9a6b");
      inner.addColorStop(1, "#ff5d73");
      ctx.fillStyle = inner;
      ctx.shadowColor = "#ff6b7d";
      ctx.shadowBlur = 20 + pulse * 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case "coolant": {
      const r = s as Rect;
      ctx.strokeStyle = "#5c6a8e";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(r.x + 20, r.y + r.h / 2);
      ctx.lineTo(r.x + r.w - 20, r.y + r.h / 2);
      ctx.stroke();
      for (const [dx, dy] of [
        [22, 22],
        [r.w - 22, 22],
        [r.w / 2, r.h - 20],
      ]) {
        ctx.beginPath();
        ctx.arc(r.x + dx!, r.y + dy!, 18, 0, Math.PI * 2);
        ctx.fillStyle = "#2e3d5e";
        ctx.fill();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r.x + dx!, r.y + dy!, 11, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(92,225,230,${0.35 + Math.sin(time * 2 + dx!) * 0.15})`;
        ctx.fill();
      }
      break;
    }
    case "bed": {
      const r = s as Rect;
      box(ctx, r, "#d6dced", 8);
      box(ctx, { x: r.x + 6, y: r.y + 6, w: 26, h: r.h - 12 }, "#ffffff", 6, "#9aa4bf", 1);
      ctx.fillStyle = hexA(tint, 0.55);
      ctx.beginPath();
      ctx.roundRect(r.x + 38, r.y + 4, r.w - 44, r.h - 8, 6);
      ctx.fill();
      // bedside monitor with a heartbeat
      const m = { x: r.x + r.w - 2, y: r.y - 16, w: 26, h: 16 };
      box(ctx, m, "#0a0e1e", 3, OUTLINE, 1.5);
      ctx.strokeStyle = "#5be49b";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const t = (time * 30) % 26;
      for (let x = 0; x < 22; x++) {
        const beat = Math.abs(x - t) < 2 ? -5 : 0;
        ctx.lineTo(m.x + 2 + x, m.y + 9 + beat);
      }
      ctx.stroke();
      break;
    }
    case "cabinet": {
      const r = s as Rect;
      box(ctx, r, "#e9ecf5", 5);
      ctx.fillStyle = "#ff5d73";
      ctx.fillRect(r.x + r.w / 2 - 2, r.y + 6, 4, 18);
      ctx.fillRect(r.x + r.w / 2 - 9, r.y + 13, 18, 4);
      ctx.strokeStyle = "#9aa4bf";
      ctx.beginPath();
      ctx.moveTo(r.x + r.w / 2, r.y);
      ctx.lineTo(r.x + r.w / 2, r.y + r.h);
      ctx.stroke();
      break;
    }
    case "scanner": {
      const c = s as { x: number; y: number; r: number };
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = hexA(tint, 0.1);
      ctx.fill();
      ctx.strokeStyle = hexA(tint, 0.6);
      ctx.lineWidth = 2;
      ctx.stroke();
      const t = (time * 0.7) % 1;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * t, 0, Math.PI * 2);
      ctx.strokeStyle = hexA(tint, 0.6 * (1 - t));
      ctx.stroke();
      break;
    }
    case "planter": {
      const r = s as Rect;
      box(ctx, r, "#2b2238", 6);
      ctx.fillStyle = "#1a1410";
      ctx.fillRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x + 4, r.y - 14, r.w - 8, r.h + 14);
      ctx.clip();
      for (let x = r.x + 12; x < r.x + r.w - 6; x += 14) {
        const sway = Math.sin(time * 1.6 + x * 0.3) * 4;
        ctx.strokeStyle = x % 28 === 0 ? "#7bd96a" : "#4fb86a";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, r.y + r.h - 6);
        ctx.quadraticCurveTo(x + sway, r.y + r.h / 2, x + sway * 1.5, r.y - 8);
        ctx.stroke();
      }
      ctx.restore();
      ctx.lineCap = "butt";
      // grow light
      ctx.fillStyle = "rgba(190,120,255,0.18)";
      ctx.fillRect(r.x, r.y - 10, r.w, 6);
      break;
    }
    case "pump": {
      const c = s as { x: number; y: number; r: number };
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = "#34405e";
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(time * 4);
      ctx.fillStyle = "#b5e853";
      for (let i = 0; i < 3; i++) {
        ctx.rotate((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.ellipse(0, -8, 4, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
  }
}

/** A task terminal: a small console with a glowing screen. */
export function drawConsole(ctx: Ctx, x: number, y: number, tint: string, time: number) {
  box(ctx, { x: x - 11, y: y - 30, w: 22, h: 14 }, "#0a0f1e", 3, OUTLINE, 1.5);
  ctx.fillStyle = hexA(tint, 0.55 + Math.sin(time * 2 + x) * 0.2);
  ctx.fillRect(x - 8, y - 27, 16, 8);
}
