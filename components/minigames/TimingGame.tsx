"use client";

import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./MiniGame";

const HITS = 3;
const ARC = 38; // degrees wide
const SPEED = 190; // degrees per second

const COPY: Record<string, { hint: string; target: string; icon: string }> = {
  sonar: { hint: "Lock on: hit when the sweep crosses the contact.", target: "contact", icon: "◎" },
  ping: { hint: "Catch the surface ping as the sweep passes it.", target: "ping", icon: "✶" },
  vitals: { hint: "Sync the monitor: hit on each heartbeat.", target: "beat", icon: "♥" },
  kelp: { hint: "Trim the fronds: cut as the blade passes each one.", target: "frond", icon: "❦" },
};

/** Timing sweep: an arm circles; press Space (or click) while it's inside the target arc. Three hits. */
export function TimingGame({ theme, tint, onDone }: GameProps) {
  const copy = COPY[theme] ?? COPY.sonar!;
  const [angle, setAngle] = useState(0);
  const [target, setTarget] = useState(() => 60 + Math.random() * 240);
  const [hits, setHits] = useState(0);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const angleRef = useRef(0);
  const dir = useRef(1);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      angleRef.current = (angleRef.current + dir.current * SPEED * dt + 360) % 360;
      setAngle(angleRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const strike = () => {
    if (hits >= HITS) return;
    const a = angleRef.current;
    const d = Math.abs(((a - target + 540) % 360) - 180);
    if (d <= ARC / 2) {
      const n = hits + 1;
      setHits(n);
      setFlash("hit");
      if (n >= HITS) onDone();
      else {
        setTarget((target + 100 + Math.random() * 160) % 360);
        dir.current = -dir.current; // change direction each hit to keep you on your toes
      }
    } else setFlash("miss");
    window.setTimeout(() => setFlash(null), 250);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        strike();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const p = (deg: number, r: number) => `${100 + Math.cos(rad(deg)) * r} ${100 + Math.sin(rad(deg)) * r}`;
  const arcPath = `M ${p(target - ARC / 2, 80)} A 80 80 0 0 1 ${p(target + ARC / 2, 80)} L ${p(target + ARC / 2, 40)} A 40 40 0 0 0 ${p(target - ARC / 2, 40)} Z`;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-muted">{copy.hint}</p>
      <svg viewBox="0 0 200 200" className="w-52 cursor-pointer select-none" onPointerDown={strike} role="button" aria-label={`Strike: ${hits} of ${HITS}`} data-angle={angle.toFixed(0)} data-target={target.toFixed(0)}>
        <circle cx="100" cy="100" r="92" fill="#0b0f1a" stroke={flash === "miss" ? "#ff5d73" : flash === "hit" ? "#5be49b" : "#1d2540"} strokeWidth="4" />
        {[40, 60, 80].map((r) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#1d2540" strokeWidth="1" />
        ))}
        <path d={arcPath} fill={tint} opacity="0.35" stroke={tint} strokeWidth="2" />
        <text x={p(target, 60).split(" ")[0]} y={Number(p(target, 60).split(" ")[1]) + 5} textAnchor="middle" className="text-[14px]" fill={tint}>
          {copy.icon}
        </text>
        <line x1="100" y1="100" x2={p(angle, 88).split(" ")[0]} y2={p(angle, 88).split(" ")[1]} stroke="#e9ecf5" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="100" r="7" fill="#2d3a60" />
      </svg>
      <div className="flex items-center gap-2">
        {Array.from({ length: HITS }, (_, i) => (
          <span key={i} className={`h-3 w-3 rounded-full ${i < hits ? "bg-kelp shadow-[0_0_8px_#5be49b]" : "bg-line-strong"}`} />
        ))}
        <span className="ml-2 text-xs text-faint">Space or click to strike the {copy.target}</span>
      </div>
    </div>
  );
}
