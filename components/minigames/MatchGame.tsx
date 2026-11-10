"use client";

import { useEffect, useState } from "react";
import type { GameProps } from "./MiniGame";

const COLORS = ["#ff6fa5", "#5ce1e6", "#b5e853", "#ffb547"];
const ROUNDS = 3;

interface Spec {
  color: number;
  arms: number; // 2..5 tentacles (culture) or stripes (seals)
  dots: number; // 0..3 spots
}

const same = (a: Spec, b: Spec) => a.color === b.color && a.arms === b.arms && a.dots === b.dots;

function randomSpec(): Spec {
  return { color: Math.floor(Math.random() * 4), arms: 2 + Math.floor(Math.random() * 4), dots: Math.floor(Math.random() * 4) };
}

/** Five decoys that each differ from the target in exactly one way, plus the target, shuffled. */
function makeRound(): { target: Spec; options: Spec[] } {
  const target = randomSpec();
  const decoys: Spec[] = [];
  let guard = 0;
  while (decoys.length < 5 && guard++ < 200) {
    const d = { ...target };
    const which = Math.floor(Math.random() * 3);
    if (which === 0) d.color = (d.color + 1 + Math.floor(Math.random() * 3)) % 4;
    if (which === 1) d.arms = 2 + ((d.arms - 2 + 1 + Math.floor(Math.random() * 3)) % 4);
    if (which === 2) d.dots = (d.dots + 1 + Math.floor(Math.random() * 3)) % 4;
    if (!same(d, target) && !decoys.some((x) => same(x, d))) decoys.push(d);
  }
  const options = [...decoys, target].sort(() => Math.random() - 0.5);
  return { target, options };
}

function Glyph({ spec, theme, size = 64 }: { spec: Spec; theme: string; size?: number }) {
  const c = COLORS[spec.color]!;
  if (theme === "seals") {
    // a cargo seal: hexagon badge with stripes and rivets
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
        <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill={c} stroke="#05070d" strokeWidth="2.5" />
        {Array.from({ length: spec.arms }, (_, i) => (
          <rect key={i} x={16 + i * (32 / spec.arms)} y="22" width={32 / spec.arms - 3} height="8" fill="#05070d" opacity="0.65" />
        ))}
        {Array.from({ length: spec.dots }, (_, i) => (
          <circle key={i} cx={22 + i * 10} cy="42" r="3.5" fill="#05070d" />
        ))}
      </svg>
    );
  }
  // a vent culture: a little jellyfish with tentacles and spots
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <path d="M 12 30 A 20 18 0 0 1 52 30 Z" fill={c} stroke="#05070d" strokeWidth="2.5" />
      {Array.from({ length: spec.arms }, (_, i) => {
        const x = 16 + i * (32 / (spec.arms - 1));
        return <path key={i} d={`M ${x} 30 Q ${x + 4} 42 ${x} 54`} stroke={c} strokeWidth="3" fill="none" strokeLinecap="round" />;
      })}
      {Array.from({ length: spec.dots }, (_, i) => (
        <circle key={i} cx={24 + i * 8} cy="22" r="2.6" fill="#05070d" opacity="0.7" />
      ))}
    </svg>
  );
}

/** Specimen match: pick the one that matches the sample exactly, three rounds running. Keys 1–6. */
export function MatchGame({ theme, tint, onDone }: GameProps) {
  const [round, setRound] = useState(0);
  const [{ target, options }, setRoundData] = useState(makeRound);
  const [wrong, setWrong] = useState<number | null>(null);

  const choose = (i: number) => {
    if (same(options[i]!, target)) {
      if (round + 1 >= ROUNDS) onDone();
      else {
        setRound(round + 1);
        setRoundData(makeRound());
      }
    } else {
      setWrong(i);
      window.setTimeout(() => setWrong(null), 400);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key) - 1;
      if (n >= 0 && n < options.length) choose(n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-muted">
        {theme === "seals" ? "Find the seal that matches the manifest exactly: colour, stripes and rivets." : "Find the culture that matches the sample exactly: colour, tentacles and spots."}
      </p>
      <div className="flex items-center gap-4">
        <div className="rounded-2xl border-2 p-2" style={{ borderColor: tint, background: `${tint}14` }} data-spec={`${target.color}-${target.arms}-${target.dots}`}>
          <Glyph spec={target} theme={theme} size={70} />
        </div>
        <div className="text-sm text-muted">
          <p className="font-semibold text-ink">{theme === "seals" ? "Manifest" : "Sample"}</p>
          <p>
            Round {round + 1} of {ROUNDS}
          </p>
          <div className="mt-1 flex gap-1">
            {Array.from({ length: ROUNDS }, (_, i) => (
              <span key={i} className={`h-1.5 w-6 rounded-full ${i < round ? "bg-kelp" : "bg-line-strong"}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o, i) => (
          <button
            key={`${round}-${i}`}
            onClick={() => choose(i)}
            className={`relative rounded-xl border bg-deep-2 p-1.5 transition hover:bg-deep-3 ${wrong === i ? "border-coral bg-coral-dim" : "border-line-strong"}`}
            aria-label={`Option ${i + 1}`}
            data-spec={`${o.color}-${o.arms}-${o.dots}`}
          >
            <Glyph spec={o} theme={theme} size={54} />
            <span className="absolute left-1.5 top-1 text-[10px] text-faint">{i + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
