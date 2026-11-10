"use client";

import { useEffect, useRef, useState } from "react";
import type { Director } from "@/lib/ai/director";
import { tallyVotes } from "@/lib/game/actions";
import { clock } from "@/lib/game/clock";
import { locationName } from "@/lib/game/map";
import { aliveChars, byId } from "@/lib/game/rules";
import { DiverIcon } from "./DiverIcon";
import type { Body, GameState, MeetingRecord, TranscriptLine } from "@/lib/game/types";

type Stage = "statements" | "your-statement" | "discussion" | "voting" | "counting" | "result";

interface Props {
  state: GameState;
  director: Director;
  pending: { calledBy: string; reason: "body" | "emergency"; body?: Body };
  onDone: (record: MeetingRecord) => void;
}

const QUESTIONS = 3;

function speakingOrder(state: GameState, calledBy: string): string[] {
  const ais = aliveChars(state).filter((c) => !c.isPlayer).map((c) => c.id);
  const first = ais.includes(calledBy) ? [calledBy] : [];
  const rest = ais.filter((id) => id !== calledBy);
  // You speak first if you called it, otherwise after a couple of others.
  if (calledBy === "you") return ["you", ...rest];
  const before = [...first, ...rest].slice(0, 2);
  const after = [...first, ...rest].slice(2);
  return [...before, "you", ...after];
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />;
}

export function Meeting({ state, director, pending, onDone }: Props) {
  const [record] = useState<MeetingRecord>(() => ({
    round: state.round,
    t: state.t,
    calledBy: pending.calledBy,
    reason: pending.reason,
    body: pending.body,
    transcript: [],
    votes: {},
  }));
  const [, rerender] = useState(0);
  const [stage, setStage] = useState<Stage>("statements");
  const [speaking, setSpeaking] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState<string>(() => aliveChars(state).find((c) => !c.isPlayer)?.id ?? "");
  const [questionsLeft, setQuestionsLeft] = useState(QUESTIONS);
  const [yourVote, setYourVote] = useState<string | null>(null);
  const yourTurn = useRef<((text: string) => void) | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const push = (line: TranscriptLine) => {
    record.transcript.push(line);
    rerender((n) => n + 1);
  };

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      for (const id of speakingOrder(state, pending.calledBy)) {
        if (id === "you") {
          setStage("your-statement");
          const text = await new Promise<string>((resolve) => (yourTurn.current = resolve));
          yourTurn.current = null;
          if (text.trim()) push({ speaker: "you", text: text.trim(), kind: "statement" });
          setStage("statements");
          continue;
        }
        setSpeaking(id);
        push(await director.statement(state, id, record));
        setSpeaking(null);
      }
      setStage("discussion");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const others = aliveChars(state).filter((c) => !c.isPlayer);
  const nameOf = (id: string) => (id === "you" ? "You" : byId(state, id).name);
  const colorOf = (id: string) => (id === "you" ? "#f5f5f4" : byId(state, id).color);

  async function ask(text: string) {
    if (!text.trim() || !target || questionsLeft <= 0 || speaking) return;
    setDraft("");
    setQuestionsLeft((n) => n - 1);
    push({ speaker: "you", text: text.trim(), to: target, kind: "question" });
    setSpeaking(target);
    push(await director.reply(state, target, record, text.trim(), "you"));
    setSpeaking(null);
  }

  async function castVote(vote: string) {
    setYourVote(vote);
    setStage("counting");
    record.votes["you"] = vote;
    const ais = aliveChars(state).filter((c) => !c.isPlayer);
    const results = await Promise.all(ais.map(async (c) => [c.id, await director.vote(state, c.id, record)] as const));
    for (const [id, v] of results) {
      record.votes[id] = v.vote;
      push({ speaker: id, text: v.vote === "skip" ? `Skips. ${v.reason}` : `Votes ${nameOf(v.vote)}. ${v.reason}`, kind: "vote" });
    }
    setStage("result");
  }

  const header = pending.body
    ? `${byId(state, pending.body.victim).name} was found dead in ${locationName(pending.body.loc)} by ${nameOf(pending.calledBy)} at ${clock(pending.body.foundAt ?? state.t)}.`
    : `${nameOf(pending.calledBy)} hit the emergency button.`;

  const tally = stage === "result" ? tallyVotes(record.votes) : null;
  const ejected = tally?.ejected ? byId(state, tally.ejected) : null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-abyss/85 p-3 backdrop-blur-md sm:p-6">
      <div className="flex h-full max-h-[52rem] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-line-strong bg-deep shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        <header className="border-b border-line bg-gradient-to-b from-ember-dim/40 to-transparent p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ember">Emergency meeting · {clock(state.t)}</p>
          <h2 className="mt-1.5 text-xl font-semibold text-ink">{header}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.characters.map((c) => (
              <span
                key={c.id}
                className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-xs transition ${speaking === c.id ? "border-glow/60 bg-glow-dim/40 text-ink" : c.alive ? "border-line text-ink" : "border-line/60 text-faint line-through"}`}
              >
                <DiverIcon id={c.id} size={22} dead={!c.alive} />
                {c.isPlayer ? "You" : c.name}
                {speaking === c.id ? <span className="text-glow">speaking…</span> : null}
              </span>
            ))}
          </div>
        </header>

        <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
          {record.transcript.map((l, i) => (
            <div key={i} className={`animate-rise flex gap-3 ${l.kind === "vote" ? "opacity-75" : ""}`}>
              <DiverIcon id={l.speaker} size={l.kind === "vote" ? 26 : 34} className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs text-muted">
                  <span className="font-semibold" style={{ color: colorOf(l.speaker) }}>{nameOf(l.speaker)}</span>
                  {l.to ? <> → {nameOf(l.to)}</> : null}
                  {l.kind === "vote" ? <span className="text-faint"> · vote</span> : null}
                </p>
                <p className={`leading-relaxed text-ink ${l.kind === "vote" ? "text-sm" : "text-[15px]"}`}>{l.text}</p>
              </div>
            </div>
          ))}
          {speaking ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Dot color={colorOf(speaking)} /> {nameOf(speaking)} is thinking
              <span className="inline-flex gap-0.5" aria-hidden>
                <span className="h-1 w-1 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-muted" />
              </span>
            </p>
          ) : null}
        </div>

        <footer className="border-t border-line bg-deep-2/60 p-4">
          {stage === "your-statement" ? (
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                yourTurn.current?.(draft);
                setDraft("");
              }}
            >
              <input
                autoFocus
                value={draft}
                maxLength={240}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Your turn. Where were you? Who did you see?"
                className="flex-1 rounded-xl border border-line-strong bg-abyss px-3.5 py-2.5 text-ink placeholder:text-faint focus:border-glow/70 focus:outline-none"
              />
              <div className="flex gap-2">
                <button className="rounded-xl bg-glow px-4 py-2.5 font-semibold text-glow-ink hover:brightness-110">Say it</button>
                <button type="button" onClick={() => yourTurn.current?.("")} className="rounded-xl border border-line-strong px-3.5 py-2.5 text-muted hover:bg-deep-3 hover:text-ink">
                  Stay quiet
                </button>
              </div>
            </form>
          ) : null}

          {stage === "discussion" ? (
            <div className="flex flex-col gap-3">
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask(draft);
                }}
              >
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="rounded-xl border border-line-strong bg-abyss px-2.5 py-2.5 text-ink"
                  aria-label="Who to question"
                >
                  {others.map((c) => (
                    <option key={c.id} value={c.id}>
                      Ask {c.name}
                    </option>
                  ))}
                </select>
                <input
                  value={draft}
                  maxLength={240}
                  onChange={(e) => setDraft(e.target.value)}
                  disabled={questionsLeft <= 0 || Boolean(speaking)}
                  placeholder={questionsLeft > 0 ? `Question or accusation (${questionsLeft} left)` : "No questions left. Time to vote."}
                  className="flex-1 rounded-xl border border-line-strong bg-abyss px-3.5 py-2.5 text-ink placeholder:text-faint focus:border-glow/70 focus:outline-none disabled:opacity-50"
                />
                <button disabled={questionsLeft <= 0 || Boolean(speaking)} className="rounded-xl bg-glow px-4 py-2.5 font-semibold text-glow-ink hover:brightness-110 disabled:opacity-40">
                  Ask
                </button>
              </form>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2 text-xs">
                  {questionsLeft > 0 && !speaking
                    ? others.slice(0, 5).map((c) => (
                        <button key={c.id} type="button" onClick={() => { setTarget(c.id); void ask(`${c.name}, where were you when it happened?`); }} className="rounded-full border border-line-strong px-3 py-1 text-muted hover:border-glow/50 hover:text-ink">
                          Grill {c.name}
                        </button>
                      ))
                    : null}
                </div>
                <button type="button" onClick={() => setStage("voting")} disabled={Boolean(speaking)} className="rounded-xl bg-ember px-4 py-2.5 font-semibold text-[#2a1a00] hover:brightness-110 disabled:opacity-40">
                  Go to vote
                </button>
              </div>
            </div>
          ) : null}

          {stage === "voting" ? (
            <div>
              <p className="mb-3 text-sm text-muted">Who goes in the dive chamber?</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {others.map((c) => (
                  <button key={c.id} onClick={() => void castVote(c.id)} className="flex items-center gap-2.5 rounded-xl border border-line-strong bg-deep px-3 py-2 text-left font-medium text-ink transition hover:border-coral/70 hover:bg-coral-dim/50">
                    <DiverIcon id={c.id} size={30} /> {c.name}
                  </button>
                ))}
                <button onClick={() => void castVote("skip")} className="rounded-xl border border-line-strong px-3.5 py-2.5 text-muted hover:bg-deep-3 hover:text-ink">
                  Skip vote
                </button>
              </div>
            </div>
          ) : null}

          {stage === "counting" ? <p className="text-sm text-muted">You voted {yourVote === "skip" ? "to skip" : nameOf(yourVote!)}. Counting votes…</p> : null}

          {stage === "result" && tally ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-ink">
                  {ejected
                    ? `${ejected.isPlayer ? "You were" : `${ejected.name} was`} locked in the dive chamber. ${ejected.role === "killer" ? `${ejected.isPlayer ? "You were" : "They were"} the killer.` : `${ejected.isPlayer ? "You were" : "They were"} not the killer.`}`
                    : "No one was ejected."}
                </p>
                <p className="text-sm text-muted">{tally.counts.map(([id, n]) => `${id === "skip" ? "Skip" : nameOf(id)} ${n}`).join(" · ")}</p>
              </div>
              <button onClick={() => onDone(record)} className="rounded-xl bg-glow px-5 py-2.5 font-semibold text-glow-ink hover:brightness-110">
                Continue
              </button>
            </div>
          ) : null}

          {stage === "statements" ? <p className="text-sm text-faint">Everyone is giving their account…</p> : null}
        </footer>
      </div>
    </div>
  );
}
