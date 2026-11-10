"use client";

import { useState } from "react";
import type { StartRole } from "@/lib/game/setup";
import { CREW } from "@/lib/game/personas";
import type { DirectorStatus } from "@/lib/ai/director";
import { DiverIcon } from "./DiverIcon";
import { VoiceBadge } from "./Hud";

const ROLES = [
  { id: "crew", title: "Play crew", body: "Do tasks, collect sonar logs, catch the lie.", accent: "glow" },
  { id: "killer", title: "Play the killer", body: "Kill unseen, recruit accomplices, survive three meetings.", accent: "coral" },
  { id: "random", title: "Random", body: "Find out when you wake up.", accent: "orchid" },
] as const;

const ACCENT = {
  glow: { on: "border-glow/70 bg-glow-dim/40 shadow-[0_0_30px_-10px_#5ce1e6]", dot: "bg-glow" },
  coral: { on: "border-coral/70 bg-coral-dim/50 shadow-[0_0_30px_-10px_#ff5d73]", dot: "bg-coral" },
  orchid: { on: "border-orchid/70 bg-orchid-dim/50 shadow-[0_0_30px_-10px_#b48cff]", dot: "bg-orchid" },
};

export function TitleScreen({ status, onStart }: { status: DirectorStatus | null; onStart: (role: StartRole) => void }) {
  const [role, setRole] = useState<StartRole>("crew");
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-12 sm:py-20">
      <header className="flex flex-col items-start gap-5">
        <VoiceBadge status={status} />
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-glow/80">Halcyon-9 · 300 m below</p>
          <h1 className="bg-gradient-to-b from-ink via-ink to-glow/70 bg-clip-text text-7xl font-black tracking-tight text-transparent sm:text-9xl">
            ALIBI
          </h1>
        </div>
        <p className="max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
          Six divers are sealed in a research station while a storm rages above. One of them is killing the others.
          Every suspect is an AI agent with its own memory of the night, <span className="text-ink">and the killer lies.</span>
        </p>
      </header>

      <section aria-label="The crew" className="flex flex-wrap items-end gap-4 sm:gap-6">
        {CREW.map((c) => (
          <figure key={c.id} className="flex flex-col items-center gap-1.5">
            <DiverIcon id={c.id} size={64} glow />
            <figcaption className="text-center leading-tight">
              <span className="block text-sm font-semibold text-ink">{c.name}</span>
              <span className="block text-[11px] text-faint">{c.job}</span>
            </figcaption>
          </figure>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Choose your role">
          {ROLES.map((r) => {
            const on = role === r.id;
            return (
              <button
                key={r.id}
                role="radio"
                aria-checked={on}
                onClick={() => setRole(r.id)}
                className={`rounded-2xl border p-4 text-left transition ${on ? ACCENT[r.accent].on : "border-line bg-deep/70 hover:border-line-strong"}`}
              >
                <span className="flex items-center gap-2 text-lg font-semibold text-ink">
                  <span className={`h-2 w-2 rounded-full ${on ? ACCENT[r.accent].dot : "bg-line-strong"}`} />
                  {r.title}
                </span>
                <span className="mt-1 block text-sm text-muted">{r.body}</span>
              </button>
            );
          })}
        </div>
        <div>
          <button
            onClick={() => onStart(role)}
            className="rounded-2xl bg-glow px-9 py-3.5 text-lg font-bold text-glow-ink shadow-[0_0_40px_-8px_#5ce1e6] transition hover:brightness-110"
          >
            Dive in
          </button>
        </div>
      </section>

      <section className="grid gap-8 text-sm text-muted sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">How to play</h2>
          <ul className="space-y-2">
            {[
              "Move with WASD or the arrow keys, or click or tap where to go.",
              "You only see who shares your room or tube.",
              "Stand on a dashed ring and press E to start a task: turn a dial, splice cables, match specimens or time a sweep. Each task gives you one true sonar log.",
              "Find a body and report it. Everyone gives an alibi. Question them, then vote.",
              "The storm clears after three meetings. If the killer is still aboard, they win.",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-glow" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-orchid/80">The twist: pacts</h2>
          <ul className="space-y-2">
            {[
              "The killer may corner you and offer a deal: vouch for them and win with them, or take the knife and swap roles.",
              "Refuse, and you know who it is. Can you convince the others?",
              "As the killer, make the same offer. Some accept, some refuse, and some only pretend.",
            ].map((t) => (
              <li key={t} className="flex gap-2.5">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-orchid" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
