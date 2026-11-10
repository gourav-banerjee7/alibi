"use client";

import { useEffect, useMemo, useState } from "react";
import type { GameProps } from "./MiniGame";

const CABLES = [
  { id: "coral", color: "#ff5d73", name: "red" },
  { id: "ember", color: "#ffb547", name: "amber" },
  { id: "glow", color: "#5ce1e6", name: "cyan" },
  { id: "kelp", color: "#5be49b", name: "green" },
  { id: "orchid", color: "#b48cff", name: "violet" },
];

const COPY: Record<string, string> = {
  purifier: "Re-splice the purifier's control cables: match each cable to its socket.",
  oxygen: "Reconnect the oxygen manifold: match each line to its port.",
  pump: "Rewire the nutrient pump: match each cable to its terminal.",
};

const shuffle = <T,>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** Cable splice: pick a cable on the left, then the matching socket on the right. Keys 1–4 work too. */
export function WiresGame({ theme, onDone }: GameProps) {
  const left = useMemo(() => shuffle(CABLES).slice(0, 4), []);
  const right = useMemo(() => shuffle(left), [left]);
  const [picked, setPicked] = useState<number | null>(null);
  const [links, setLinks] = useState<Record<number, number>>({});
  const [miss, setMiss] = useState<number | null>(null);

  const connect = (rightIndex: number) => {
    if (picked === null) return;
    if (Object.values(links).includes(rightIndex)) return;
    if (left[picked]!.id === right[rightIndex]!.id) {
      const next = { ...links, [picked]: rightIndex };
      setLinks(next);
      setPicked(null);
      if (Object.keys(next).length === left.length) onDone();
    } else {
      setMiss(rightIndex);
      window.setTimeout(() => setMiss(null), 350);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key) - 1;
      if (!(n >= 0 && n < 4)) return;
      if (picked === null) {
        if (links[n] === undefined) setPicked(n);
      } else connect(n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const y = (i: number) => 30 + i * 52;

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-muted">{COPY[theme] ?? COPY.purifier}</p>
      <svg viewBox="0 0 320 220" className="w-full max-w-xs select-none">
        <rect x="0" y="0" width="320" height="220" rx="16" fill="#0b0f1a" stroke="#1d2540" />
        {Object.entries(links).map(([l, r]) => (
          <path
            key={l}
            d={`M 62 ${y(+l)} C 160 ${y(+l)}, 160 ${y(r)}, 258 ${y(r)}`}
            stroke={left[+l]!.color}
            strokeWidth="9"
            fill="none"
            strokeLinecap="round"
          />
        ))}
        {left.map((c, i) => (
          <g key={c.id} onClick={() => links[i] === undefined && setPicked(i)} className="cursor-pointer" role="button" aria-label={`${c.name} cable, key ${i + 1}`}>
            <rect x="14" y={y(i) - 14} width="48" height="28" rx="8" fill={c.color} stroke={picked === i ? "#e9ecf5" : "#05070d"} strokeWidth={picked === i ? 3 : 2} />
            <text x="38" y={y(i) + 5} textAnchor="middle" className="fill-[#05070d] text-[13px] font-bold">
              {i + 1}
            </text>
          </g>
        ))}
        {right.map((c, i) => (
          <g key={c.id} onClick={() => connect(i)} className="cursor-pointer" role="button" aria-label={`${c.name} socket, key ${i + 1}`}>
            <rect x="258" y={y(i) - 14} width="48" height="28" rx="8" fill="#141a2e" stroke={miss === i ? "#ff5d73" : c.color} strokeWidth="3" />
            <circle cx="282" cy={y(i)} r="6" fill={c.color} />
            <text x="250" y={y(i) + 5} textAnchor="end" className="fill-[#5b6482] text-[11px]">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-[11px] text-faint">Click a cable, then its matching socket (or press 1–4, then 1–4).</p>
    </div>
  );
}
