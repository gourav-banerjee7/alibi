"use client";

import { playerRoleLine } from "@/lib/game/actions";
import { clock } from "@/lib/game/clock";
import { locationName } from "@/lib/game/map";
import { player } from "@/lib/game/rules";
import { MAX_MEETINGS } from "@/lib/game/setup";
import { canCallEmergency, killBlockedReason, killTarget, nearbyTask, pactCandidate, visibleBody } from "@/lib/game/sim";
import type { GameState } from "@/lib/game/types";
import type { DirectorStatus } from "@/lib/ai/director";

export function VoiceBadge({ status }: { status: DirectorStatus | null }) {
  if (!status) return <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400">checking AI…</span>;
  const live = status.mode === "live";
  return (
    <span
      title={status.note ?? (live ? `Characters speak through ${status.model}` : "No Gemini key: characters use scripted lines built from the simulation")}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${live ? "bg-teal-950 text-teal-300" : "bg-slate-800 text-slate-300"}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-teal-400" : "bg-slate-400"}`} />
      {live ? `Gemini live` : "Scripted voices"}
      {live && status.fallbacks > 0 ? <span className="text-teal-500/70">· {status.fallbacks} fallback</span> : null}
    </span>
  );
}

export function TopBar({ state, status }: { state: GameState; status: DirectorStatus | null }) {
  const you = player(state);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-3">
        <span className="font-mono text-2xl font-semibold tracking-tight text-sky-100 tabular-nums">{clock(state.t)}</span>
        <span className="text-slate-400">
          {locationName(you.loc)} · meeting {Math.min(state.meetings.length + 1, MAX_MEETINGS)} of {MAX_MEETINGS} before the storm clears
        </span>
      </div>
      <VoiceBadge status={status} />
    </div>
  );
}

export function SidePanel({ state }: { state: GameState }) {
  const you = player(state);
  const isKiller = you.role === "killer";
  return (
    <div className="flex flex-col gap-3 text-sm">
      <section className={`rounded-lg border p-3 ${isKiller ? "border-rose-800/70 bg-rose-950/40" : you.role === "accomplice" ? "border-violet-800/70 bg-violet-950/40" : "border-sky-900/70 bg-slate-900/60"}`}>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Your role</h2>
        <p className="text-slate-100">{playerRoleLine(state)}</p>
      </section>

      <section className="rounded-lg border border-sky-900/70 bg-slate-900/60 p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{isKiller ? "Fake tasks (blend in)" : "Tasks: each one pulls a sonar log"}</h2>
        <ul className="space-y-1.5">
          {state.tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${t.done ? "bg-emerald-400" : "bg-yellow-400"}`} />
              <span className={t.done ? "text-slate-500 line-through" : "text-slate-200"}>
                {t.label} <span className="text-slate-500">· {locationName(t.room)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-sky-900/70 bg-slate-900/60 p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Sonar logs</h2>
        {state.clues.length === 0 ? (
          <p className="text-slate-500">{isKiller ? "Killers get no logs." : "Finish a task to pull one true sighting."}</p>
        ) : (
          <ul className="space-y-1.5 text-slate-200">
            {state.clues.map((c, i) => (
              <li key={i}>{c.replace("Sonar log: ", "")}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface ActionProps {
  state: GameState;
  useHeld: React.MutableRefObject<boolean>;
  onReport: () => void;
  onEmergency: () => void;
  onKill: () => void;
  onOffer: () => void;
}

function Btn(props: { label: string; hint: string; onClick?: () => void; disabled?: boolean; tone?: "default" | "danger" | "violet" | "warn"; sub?: string; holdRef?: React.MutableRefObject<boolean> }) {
  const tones = {
    default: "bg-sky-900/70 hover:bg-sky-800 text-sky-50 border-sky-700",
    danger: "bg-rose-800/80 hover:bg-rose-700 text-rose-50 border-rose-600",
    violet: "bg-violet-800/80 hover:bg-violet-700 text-violet-50 border-violet-600",
    warn: "bg-amber-700/80 hover:bg-amber-600 text-amber-50 border-amber-500",
  };
  const hold = props.holdRef
    ? {
        onPointerDown: () => (props.holdRef!.current = true),
        onPointerUp: () => (props.holdRef!.current = false),
        onPointerLeave: () => (props.holdRef!.current = false),
        onPointerCancel: () => (props.holdRef!.current = false),
      }
    : {};
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      {...hold}
      className={`flex min-w-24 flex-col items-center rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-600 ${tones[props.tone ?? "default"]}`}
    >
      <span>{props.label}</span>
      <span className="text-[10px] font-normal opacity-70">{props.sub ?? props.hint}</span>
    </button>
  );
}

export function ActionBar({ state, useHeld, onReport, onEmergency, onKill, onOffer }: ActionProps) {
  const you = player(state);
  const task = nearbyTask(state);
  const body = visibleBody(state);
  const isKiller = you.role === "killer";
  const target = killTarget(state);
  const offer = pactCandidate(state);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Btn label="Use" hint="hold E / Space" holdRef={useHeld} disabled={!task} sub={task ? task.label : "stand on a yellow ring"} />
      <Btn label="Report body" hint="R" tone="warn" onClick={onReport} disabled={!body} />
      <Btn label="Emergency" hint="M · Mess only" onClick={onEmergency} disabled={!canCallEmergency(state)} sub={state.emergencyUsed ? "used" : undefined} />
      {isKiller ? (
        <>
          <Btn label="Kill" hint="K" tone="danger" onClick={onKill} disabled={!target} sub={target ? target.name : killBlockedReason(state)} />
          <Btn label="Offer a deal" hint="Q" tone="violet" onClick={onOffer} disabled={!offer} sub={offer ? `to ${offer.name}` : "get someone alone"} />
        </>
      ) : null}
    </div>
  );
}
