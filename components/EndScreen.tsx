"use client";

import { auditTranscript } from "@/lib/game/judge";
import { describeClaim } from "@/lib/game/memory";
import { byId, playerWon } from "@/lib/game/rules";
import type { GameState } from "@/lib/game/types";

export function EndScreen({ state, onAgain, onTitle }: { state: GameState; onAgain: () => void; onTitle: () => void }) {
  const won = playerWon(state);
  const originalKiller = state.kills[0]?.killer ?? state.pacts.find((p) => p.kind === "swap")?.killer ?? state.characters.find((c) => c.role === "killer")?.id;
  const nameOf = (id: string) => (id === "you" ? "You" : byId(state, id).name);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="text-center">
        <p className={`text-sm font-semibold uppercase tracking-[0.3em] ${won ? "text-teal-400" : "text-rose-400"}`}>{won ? "You win" : "You lose"}</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50 sm:text-4xl">{state.endReason}</h1>
        <p className="mt-2 text-slate-400">
          {state.winner === "crew" ? "The crew's side won." : "The killer's side won."} The first blood was spilled by{" "}
          <span className="font-semibold text-slate-200">{originalKiller ? nameOf(originalKiller) : "no one"}</span>.
        </p>
      </header>

      <section className="rounded-xl border border-sky-900 bg-slate-950/60 p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">What really happened</h2>
        <ul className="space-y-1.5 font-mono text-sm text-slate-300">
          {state.log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
          {state.meetings.map((m, i) => (
            <li key={`m${i}`}>
              Meeting {i + 1}: {m.ejected ? `${nameOf(m.ejected)} was voted out.` : "no one was voted out."}
            </li>
          ))}
        </ul>
      </section>

      {state.meetings.length > 0 ? (
        <section className="rounded-xl border border-sky-900 bg-slate-950/60 p-5">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-400">Who lied</h2>
          <p className="mb-4 text-sm text-slate-500">Every alibi checked against where people really were.</p>
          <div className="space-y-5">
            {state.meetings.map((m, i) => {
              const audited = auditTranscript(state, m.transcript).filter((a) => a.line.kind === "statement" && a.line.speaker !== "you");
              return (
                <div key={i}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-200">Meeting {i + 1}</h3>
                  <ul className="space-y-2">
                    {audited.map(({ line, lies }, j) => (
                      <li key={j} className={`rounded-lg border p-3 text-sm ${lies.length > 0 ? "border-rose-800 bg-rose-950/30" : "border-slate-800"}`}>
                        <p className="text-slate-200">
                          <span className="font-semibold" style={{ color: byId(state, line.speaker).color }}>
                            {nameOf(line.speaker)}
                          </span>
                          : {line.text}
                        </p>
                        {lies.length > 0 ? (
                          <p className="mt-1 text-xs font-semibold text-rose-300">Lie: claimed {lies.map(describeClaim).join("; ")}</p>
                        ) : (
                          <p className="mt-1 text-xs text-emerald-400/80">Alibi checks out</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={onAgain} className="rounded-lg bg-teal-600 px-6 py-2.5 font-semibold text-white hover:bg-teal-500">
          Play again
        </button>
        <button onClick={onTitle} className="rounded-lg border border-slate-700 px-6 py-2.5 font-semibold text-slate-200 hover:bg-slate-800">
          Title screen
        </button>
      </div>
      <p className="text-center text-xs text-slate-600">Seed {state.seed}</p>
    </div>
  );
}
