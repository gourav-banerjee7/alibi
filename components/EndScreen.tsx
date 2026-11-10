"use client";

import { auditTranscript } from "@/lib/game/judge";
import { describeClaim } from "@/lib/game/memory";
import { byId, playerWon } from "@/lib/game/rules";
import type { GameState } from "@/lib/game/types";
import { DiverIcon } from "./DiverIcon";

export function EndScreen({ state, onAgain, onTitle }: { state: GameState; onAgain: () => void; onTitle: () => void }) {
  const won = playerWon(state);
  const originalKiller = state.kills[0]?.killer ?? state.pacts.find((p) => p.kind === "swap")?.killer ?? state.characters.find((c) => c.role === "killer")?.id;
  const nameOf = (id: string) => (id === "you" ? "You" : byId(state, id).name);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="text-center">
        {originalKiller ? <div className="mb-4 flex justify-center"><DiverIcon id={originalKiller} size={88} glow /></div> : null}
        <p className={`text-sm font-semibold uppercase tracking-[0.3em] ${won ? "text-kelp" : "text-coral"}`}>{won ? "You win" : "You lose"}</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">{state.endReason}</h1>
        <p className="mt-2 text-muted">
          {state.winner === "crew" ? "The crew's side won." : "The killer's side won."} The first blood was spilled by{" "}
          <span className="font-semibold text-ink">{originalKiller ? nameOf(originalKiller) : "no one"}</span>.
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-deep/80 p-5">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">What really happened</h2>
        <ul className="space-y-1.5 font-mono text-sm text-muted">
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
        <section className="rounded-2xl border border-line bg-deep/80 p-5">
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Who lied</h2>
          <p className="mb-4 text-sm text-faint">Every alibi checked against where people really were.</p>
          <div className="space-y-5">
            {state.meetings.map((m, i) => {
              const audited = auditTranscript(state, m.transcript).filter((a) => a.line.kind === "statement" && a.line.speaker !== "you");
              return (
                <div key={i}>
                  <h3 className="mb-2 text-sm font-semibold text-ink">Meeting {i + 1}</h3>
                  <ul className="space-y-2">
                    {audited.map(({ line, lies }, j) => (
                      <li key={j} className={`rounded-lg border p-3 text-sm ${lies.length > 0 ? "border-coral/50 bg-coral-dim/40" : "border-line"}`}>
                        <p className="flex gap-2.5 text-ink">
                          <DiverIcon id={line.speaker} size={26} />
                          <span>
                          <span className="font-semibold" style={{ color: byId(state, line.speaker).color }}>
                            {nameOf(line.speaker)}
                          </span>
                          : {line.text}
                          </span>
                        </p>
                        {lies.length > 0 ? (
                          <p className="mt-1 text-xs font-semibold text-coral">Lie: claimed {lies.map(describeClaim).join("; ")}</p>
                        ) : (
                          <p className="mt-1 text-xs text-kelp/80">Alibi checks out</p>
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
        <button onClick={onAgain} className="rounded-xl bg-glow px-6 py-2.5 font-semibold text-glow-ink hover:brightness-110">
          Play again
        </button>
        <button onClick={onTitle} className="rounded-xl border border-line-strong px-6 py-2.5 font-semibold text-ink hover:bg-deep-3">
          Title screen
        </button>
      </div>
      <p className="text-center text-xs text-faint">Seed {state.seed}</p>
    </div>
  );
}
