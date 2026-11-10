"use client";

import { playerRoleLine } from "@/lib/game/actions";
import { clock } from "@/lib/game/clock";
import { locationName } from "@/lib/game/map";
import { player } from "@/lib/game/rules";
import { MAX_MEETINGS } from "@/lib/game/setup";
import { canCallEmergency, canSabotage, canUseCameras, isWatching, killBlockedReason, killTarget, nearbyFix, nearbyTask, pactCandidate, visibleBody } from "@/lib/game/sim";
import type { GameState } from "@/lib/game/types";
import type { DirectorStatus } from "@/lib/ai/director";
import { DiverIcon } from "./DiverIcon";

export function VoiceBadge({ status }: { status: DirectorStatus | null }) {
  if (!status) return <span className="rounded-full border border-line bg-deep px-3 py-1 text-xs text-faint">checking AI…</span>;
  const live = status.mode === "live";
  return (
    <span
      title={status.note ?? (live ? `Characters speak through ${status.model}` : "No Gemini key: characters use scripted lines built from the simulation")}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${live ? "border-glow/40 bg-glow-dim/50 text-glow" : "border-line bg-deep text-muted"}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-glow shadow-[0_0_8px_#5ce1e6]" : "bg-faint"}`} />
      {live ? "Gemini live" : "Scripted voices"}
      {live && status.fallbacks > 0 ? <span className="text-glow/60">· {status.fallbacks} fallback</span> : null}
    </span>
  );
}

export function TopBar({ state, status }: { state: GameState; status: DirectorStatus | null }) {
  const you = player(state);
  const meeting = Math.min(state.meetings.length + 1, MAX_MEETINGS);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <span className="font-mono text-3xl font-semibold tracking-tight text-ink tabular-nums">{clock(state.t)}</span>
        <div className="leading-tight">
          <p className="text-sm font-medium text-ink">{locationName(you.loc)}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            Meeting {meeting} of {MAX_MEETINGS}
            <span className="flex gap-1" aria-hidden>
              {Array.from({ length: MAX_MEETINGS }, (_, i) => (
                <span key={i} className={`h-1.5 w-4 rounded-full ${i < state.meetings.length ? "bg-ember" : "bg-line-strong"}`} />
              ))}
            </span>
            storm clears after the third
          </p>
        </div>
      </div>
      <VoiceBadge status={status} />
    </div>
  );
}

function Panel({ title, children, tone = "default" }: { title: string; children: React.ReactNode; tone?: "default" | "coral" | "orchid" | "glow" }) {
  const tones = {
    default: "border-line bg-deep/80",
    glow: "border-glow/30 bg-glow-dim/25",
    coral: "border-coral/40 bg-coral-dim/40",
    orchid: "border-orchid/40 bg-orchid-dim/40",
  };
  return (
    <section className={`rounded-xl border p-3.5 backdrop-blur ${tones[tone]}`}>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">{title}</h2>
      {children}
    </section>
  );
}

export function SidePanel({ state }: { state: GameState }) {
  const you = player(state);
  const isKiller = you.role === "killer";
  const tone = isKiller ? "coral" : you.role === "accomplice" ? "orchid" : "glow";
  return (
    <div className="flex flex-col gap-3 text-sm">
      <Panel title="Your role" tone={tone}>
        <div className="flex items-center gap-3">
          <DiverIcon id="you" size={40} glow />
          <p className="text-ink">{playerRoleLine(state)}</p>
        </div>
      </Panel>

      <Panel title={isKiller ? "Fake tasks · blend in" : "Tasks · each pulls a sonar log"}>
        <ul className="space-y-2">
          {state.tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2.5">
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${t.done ? "border-kelp bg-kelp/20 text-kelp" : "border-ember/70"}`}>
                {t.done ? <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden><path d="M2.5 6.5 5 9l4.5-6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
              </span>
              <span className={t.done ? "text-faint line-through" : "text-ink"}>
                {t.label} <span className="text-faint">· {locationName(t.room)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Sonar logs">
        {state.clues.length === 0 ? (
          <p className="text-faint">{isKiller ? "Killers don't get logs." : "Finish a task to pull one true sighting."}</p>
        ) : (
          <ul className="space-y-2">
            {state.clues.map((c, i) => (
              <li key={i} className="animate-rise rounded-lg border border-glow/20 bg-glow-dim/20 px-2.5 py-1.5 text-ink">
                {c.replace("Sonar log: ", "")}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function sabotageSub(state: GameState): string | undefined {
  if (state.sabotage) return "already active";
  const wait = Math.ceil(state.sabotageReadyAt - state.t);
  return wait > 0 ? `ready in ${wait}s` : undefined;
}

/** The alarm strip over the map while a sabotage is active. */
export function SabotageBanner({ state }: { state: GameState }) {
  const sab = state.sabotage;
  if (!sab) return null;
  const isBreach = sab.kind === "breach";
  const left = isBreach && sab.deadline !== undefined ? Math.max(0, Math.ceil(sab.deadline - state.t)) : null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border px-4 py-2 text-sm shadow-lg backdrop-blur ${isBreach ? "border-coral/70 bg-coral-dim/85" : "border-line-strong bg-abyss/90"}`}>
        <span className={`font-bold uppercase tracking-[0.14em] ${isBreach ? "text-coral" : "text-ink"}`}>
          {isBreach ? "Hull breach" : "Blackout"}
        </span>
        {left !== null ? <span className={`font-mono text-lg font-bold tabular-nums ${left <= 10 ? "animate-pulse text-coral" : "text-ink"}`}>0:{String(left).padStart(2, "0")}</span> : null}
        <span className="text-muted">{isBreach ? "Close both valves:" : "Restore power at the"}</span>
        {sab.fixes.map((f) => (
          <span key={f.id} className={`inline-flex items-center gap-1.5 ${f.done ? "text-kelp" : "text-ink"}`}>
            <span className={`h-2 w-2 rounded-full ${f.done ? "bg-kelp" : "animate-pulse bg-coral"}`} />
            {f.label} · {locationName(f.room)}
          </span>
        ))}
      </div>
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
  onCameras: () => void;
  onSabotage: (kind: "blackout" | "breach") => void;
  onUse: () => void;
}

type Tone = "glow" | "ember" | "coral" | "orchid" | "plain";

function Btn(props: { label: string; hint: string; onClick?: () => void; disabled?: boolean; tone?: Tone; sub?: string; holdRef?: React.MutableRefObject<boolean> }) {
  const tones: Record<Tone, string> = {
    glow: "border-glow/50 bg-glow-dim/60 text-glow hover:bg-glow-dim hover:shadow-[0_0_18px_-4px_#5ce1e6]",
    ember: "border-ember/60 bg-ember-dim text-ember hover:shadow-[0_0_18px_-4px_#ffb547]",
    coral: "border-coral/60 bg-coral-dim text-coral hover:shadow-[0_0_18px_-4px_#ff5d73]",
    orchid: "border-orchid/60 bg-orchid-dim text-orchid hover:shadow-[0_0_18px_-4px_#b48cff]",
    plain: "border-line-strong bg-deep-2 text-ink hover:bg-deep-3",
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
      className={`flex min-w-28 flex-col items-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:border-line disabled:bg-deep disabled:text-faint disabled:shadow-none ${tones[props.tone ?? "plain"]}`}
    >
      <span>{props.label}</span>
      <span className="max-w-32 truncate text-[10px] font-normal opacity-75">{props.sub ?? props.hint}</span>
    </button>
  );
}

export function ActionBar({ state, useHeld, onReport, onEmergency, onKill, onOffer, onCameras, onSabotage, onUse }: ActionProps) {
  const you = player(state);
  const fix = nearbyFix(state);
  const task = fix ?? nearbyTask(state);
  const body = visibleBody(state);
  const isKiller = you.role === "killer";
  const target = killTarget(state);
  const offer = pactCandidate(state);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {fix ? (
        <Btn label="Fix" hint="hold E / Space" tone="coral" holdRef={useHeld} sub={fix.label} />
      ) : (
        <Btn label="Use" hint="E" tone="glow" onClick={onUse} disabled={!task} sub={task ? task.label : "stand on a dashed ring"} />
      )}
      <Btn label="Report body" hint="R" tone="ember" onClick={onReport} disabled={!body} />
      <Btn
        label={isWatching(state, "you") ? "Leave cameras" : "Cameras"}
        hint="C · Comms desk"
        tone="glow"
        onClick={onCameras}
        disabled={!isWatching(state, "you") && !canUseCameras(state)}
      />
      <Btn label="Emergency" hint="M · Mess Hall only" onClick={onEmergency} disabled={!canCallEmergency(state)} sub={state.emergencyUsed ? "used" : undefined} />
      {isKiller ? (
        <>
          <Btn label="Kill" hint="K" tone="coral" onClick={onKill} disabled={!target} sub={target ? target.name : killBlockedReason(state)} />
          <Btn label="Offer a deal" hint="Q" tone="orchid" onClick={onOffer} disabled={!offer} sub={offer ? `to ${offer.name}` : "get someone alone"} />
          <Btn label="Blackout" hint="B" tone="coral" onClick={() => onSabotage("blackout")} disabled={!canSabotage(state, "you")} sub={sabotageSub(state)} />
          <Btn label="Hull breach" hint="V" tone="coral" onClick={() => onSabotage("breach")} disabled={!canSabotage(state, "you")} sub={sabotageSub(state)} />
        </>
      ) : null}
    </div>
  );
}
