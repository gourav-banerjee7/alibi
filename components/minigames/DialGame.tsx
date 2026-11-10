"use client";

import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./MiniGame";

const COPY: Record<string, { hint: string; unit: string }> = {
  ballast: { hint: "Bring ballast pressure into the green band and hold it there.", unit: "bar" },
  focus: { hint: "Turn the focus knob until the culture is sharp, and hold it.", unit: "µm" },
  coolant: { hint: "Vent coolant until the gauge settles in the green band.", unit: "°C" },
  core: { hint: "Steady the core reading inside the safe band.", unit: "MW" },
};

const HOLD_SECONDS = 1.2;
const TURN_SPEED = 45; // units per second while a control is held
const BAND = 14;

/**
 * Pressure dial: the needle creeps on its own; keep it inside the band for a moment.
 * Controls: ←/→ or A/D, the on-screen buttons, dragging the knob, or the mouse wheel.
 */
export function DialGame({ theme, tint, onDone }: GameProps) {
  const copy = COPY[theme] ?? COPY.ballast!;
  const [value, setValue] = useState(() => (Math.random() < 0.5 ? 10 + Math.random() * 15 : 75 + Math.random() * 15));
  const [band] = useState(() => 30 + Math.random() * (100 - 60 - BAND));
  const [held, setHeld] = useState(0);
  const turn = useRef(0); // -1, 0, +1
  const drag = useRef<number | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const doneRef = useRef(false);
  // Parents re-render often; keep the latest callback without restarting the game loop.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const keys = new Set<string>();
    const sync = () => {
      turn.current = (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0);
    };
    const down = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.add("left");
      else if (e.code === "ArrowRight" || e.code === "KeyD") keys.add("right");
      else return;
      e.preventDefault();
      sync();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") keys.delete("left");
      if (e.code === "ArrowRight" || e.code === "KeyD") keys.delete("right");
      sync();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let inZone = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const creep = Math.sin(t * 1.3) * 7 + Math.sin(t * 0.47) * 4;
      const next = Math.max(0, Math.min(100, valueRef.current + (creep + turn.current * TURN_SPEED) * dt));
      setValue(next);
      inZone = next >= band && next <= band + BAND ? inZone + dt : 0;
      setHeld(inZone);
      if (inZone >= HOLD_SECONDS && !doneRef.current) {
        doneRef.current = true;
        onDoneRef.current();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [band]);

  // gauge geometry: 0..100 maps to -120°..+120°
  const angle = (v: number) => (-120 + (v / 100) * 240) * (Math.PI / 180);
  const pt = (v: number, r: number) => [100 + Math.sin(angle(v)) * r, 110 - Math.cos(angle(v)) * r] as const;
  const arc = (from: number, to: number, r: number) => {
    const [x1, y1] = pt(from, r);
    const [x2, y2] = pt(to, r);
    return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 50 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const inBand = value >= band && value <= band + BAND;
  const [nx, ny] = pt(value, 72);
  const error = inBand ? 0 : Math.min(Math.abs(value - band), Math.abs(value - band - BAND));

  const hold = (dir: number) => ({
    onPointerDown: () => (turn.current = dir),
    onPointerUp: () => (turn.current = 0),
    onPointerLeave: () => (turn.current = 0),
    onPointerCancel: () => (turn.current = 0),
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-muted">{copy.hint}</p>
      <div className="relative">
        <svg
          viewBox="0 0 200 170"
          className="w-56 touch-none select-none"
          onWheel={(e) => setValue((v) => Math.max(0, Math.min(100, v + (e.deltaY > 0 ? -3 : 3))))}
          onPointerDown={(e) => {
            drag.current = e.clientX;
            (e.target as Element).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current === null) return;
            const dx = e.clientX - drag.current;
            drag.current = e.clientX;
            setValue((v) => Math.max(0, Math.min(100, v + dx * 0.35)));
          }}
          onPointerUp={() => (drag.current = null)}
          aria-label={`Gauge at ${Math.round(value)} ${copy.unit}`}
          data-band={band.toFixed(1)}
        >
          {theme === "focus" ? (
            <g style={{ filter: `blur(${Math.min(6, error / 4)}px)` }}>
              <circle cx="100" cy="150" r="14" fill={tint} opacity="0.85" />
              <path d="M 88 150 Q 90 166 86 170 M 96 152 Q 98 168 96 170 M 104 152 Q 102 168 104 170 M 112 150 Q 110 166 114 170" stroke={tint} strokeWidth="2" fill="none" />
            </g>
          ) : null}
          <path d={arc(0, 100, 80)} stroke="#1d2540" strokeWidth="14" fill="none" strokeLinecap="round" />
          <path d={arc(band, band + BAND, 80)} stroke="#5be49b" strokeWidth="14" fill="none" opacity={inBand ? 1 : 0.65} />
          {Array.from({ length: 11 }, (_, i) => {
            const [x1, y1] = pt(i * 10, 92);
            const [x2, y2] = pt(i * 10, 98);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5b6482" strokeWidth="2" />;
          })}
          <line x1="100" y1="110" x2={nx} y2={ny} stroke={inBand ? "#5be49b" : "#ff5d73"} strokeWidth="4" strokeLinecap="round" />
          <circle cx="100" cy="110" r="12" fill="#2d3a60" stroke="#05070d" strokeWidth="2" />
          <circle cx="100" cy="110" r="22" fill="none" stroke={tint} strokeWidth="3" strokeDasharray={`${(held / HOLD_SECONDS) * 138} 138`} transform="rotate(-90 100 110)" />
          <text x="100" y="146" textAnchor="middle" className="fill-ink font-mono text-[13px]">
            {theme === "focus" ? "" : `${Math.round(value)} ${copy.unit}`}
          </text>
        </svg>
      </div>
      <div className="flex gap-3">
        <button {...hold(-1)} className="select-none rounded-xl border border-line-strong bg-deep-2 px-5 py-2 text-lg text-ink active:bg-deep-3" aria-label="Turn down">
          ◀
        </button>
        <button {...hold(1)} className="select-none rounded-xl border border-line-strong bg-deep-2 px-5 py-2 text-lg text-ink active:bg-deep-3" aria-label="Turn up">
          ▶
        </button>
      </div>
      <p className="text-[11px] text-faint">Hold ← → (or the buttons), drag the gauge, or scroll.</p>
    </div>
  );
}
