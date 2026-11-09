"use client";

import { useState } from "react";
import type { StartRole } from "@/lib/game/setup";
import { CREW } from "@/lib/game/personas";
import type { DirectorStatus } from "@/lib/ai/director";
import { VoiceBadge } from "./Hud";

export function TitleScreen({ status, onStart }: { status: DirectorStatus | null; onStart: (role: StartRole) => void }) {
  const [role, setRole] = useState<StartRole>("crew");
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-12 sm:py-20">
      <header className="flex flex-col items-start gap-4">
        <VoiceBadge status={status} />
        <h1 className="text-6xl font-black tracking-tight text-sky-50 sm:text-8xl">ALIBI</h1>
        <p className="max-w-2xl text-lg text-slate-300 sm:text-xl">
          Six divers are sealed inside a research station 300 metres down while a storm rages above. One of them is killing the others.
          Every crew member is an AI agent with its own memory of the night, and the killer lies.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["crew", "Play crew", "Do tasks, collect sonar logs, catch the lie."],
            ["killer", "Play the killer", "Kill unseen, recruit accomplices, survive three meetings."],
            ["random", "Random", "Find out when you wake up."],
          ] as const
        ).map(([id, title, body]) => (
          <button
            key={id}
            onClick={() => setRole(id)}
            className={`rounded-xl border p-4 text-left transition ${role === id ? "border-teal-400 bg-teal-950/40" : "border-slate-800 bg-slate-950/40 hover:border-slate-600"}`}
          >
            <span className="block text-lg font-semibold text-slate-50">{title}</span>
            <span className="block text-sm text-slate-400">{body}</span>
          </button>
        ))}
      </section>

      <div>
        <button onClick={() => onStart(role)} className="rounded-xl bg-teal-500 px-8 py-3 text-lg font-bold text-slate-950 hover:bg-teal-400">
          Dive in
        </button>
      </div>

      <section className="grid gap-6 text-sm text-slate-300 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">How to play</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Move with WASD or the arrow keys, or click or tap where to go.</li>
            <li>You only see who is in the same room or tube as you.</li>
            <li>Stand on a yellow ring and hold E (or the Use button) to do a task. Each task gives you a true sonar log.</li>
            <li>Find a body and report it. At the meeting, everyone gives an alibi. Question them, then vote.</li>
            <li>The storm clears after three meetings. If the killer is still aboard, they win.</li>
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">The twist: pacts</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>The killer may corner you and offer a deal: vouch for them and win with them, or take the knife and swap roles.</li>
            <li>Refuse, and you know who it is. Can you convince the others?</li>
            <li>As the killer, you can make the same offer. Some will accept, some refuse, and some will only pretend.</li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">The crew</h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {CREW.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <p className="flex items-center gap-2 font-semibold text-slate-100">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} /> {c.name}
              </p>
              <p className="text-xs text-slate-400">{c.job}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
