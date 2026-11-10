"use client";

import { useEffect, useRef, useState } from "react";
import type { Director } from "@/lib/ai/director";
import { resolvePact, type PactDecision } from "@/lib/game/actions";
import { byId } from "@/lib/game/rules";
import type { GameState, PactKind } from "@/lib/game/types";
import { DiverIcon } from "./DiverIcon";

interface Props {
  state: GameState;
  director: Director;
  from: string;
  to: string;
  onClose: (summary: string) => void;
}

type Line = { speaker: string; text: string };

const MAX_REPLIES = 3;

/** The AI killer has cornered you and offers a deal. */
function KillerOffersYou({ state, director, from, onClose }: Omit<Props, "to">) {
  const killer = byId(state, from);
  const [chat, setChat] = useState<Line[]>([]);
  const [thinking, setThinking] = useState(true);
  const [draft, setDraft] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void director.pactPitch(state, from).then((say) => {
      setChat([{ speaker: killer.name, text: say }]);
      setThinking(false);
    });
  }, [director, from, killer.name, state]);

  const replies = chat.filter((l) => l.speaker === "You").length;

  async function send() {
    const text = draft.trim();
    if (!text || thinking || replies >= MAX_REPLIES) return;
    setDraft("");
    const next = [...chat, { speaker: "You", text }];
    setChat(next);
    setThinking(true);
    const say = await director.pactChat(state, from, next);
    setChat([...next, { speaker: killer.name, text: say }]);
    setThinking(false);
  }

  function decide(decision: PactDecision) {
    resolvePact(state, from, "you", decision);
    onClose(
      decision === "vouch"
        ? `You agreed to cover for ${killer.name}. You win if they get away, unless you vote against them.`
        : decision === "swap"
          ? `You took the knife. ${killer.name} is now your accomplice and will cover for you.`
          : `You refused. ${killer.name} knows you know. Watch your back, and tell the others.`,
    );
  }

  return (
    <Frame title={`${killer.name} corners you`} who={from} subtitle="Nobody else can hear this.">
      <Chat chat={chat} thinking={thinking ? killer.name : null} idOf={(s) => (s === "You" ? "you" : from)} />
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={draft}
          maxLength={240}
          onChange={(e) => setDraft(e.target.value)}
          disabled={thinking || replies >= MAX_REPLIES}
          placeholder={replies < MAX_REPLIES ? "Negotiate, stall, or threaten…" : "Decide."}
          className="flex-1 rounded-xl border border-orchid/30 bg-abyss px-3.5 py-2.5 text-ink placeholder:text-faint focus:border-orchid/70 focus:outline-none disabled:opacity-50"
        />
        <button disabled={thinking || replies >= MAX_REPLIES} className="rounded-xl bg-orchid px-4 py-2.5 font-semibold text-[#160b2e] hover:brightness-110 disabled:opacity-40">
          Say
        </button>
      </form>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Choice disabled={thinking} onClick={() => decide("vouch")} title="Deal" body={`Vouch for ${killer.name}. You win if they get away.`} tone="violet" />
        <Choice disabled={thinking} onClick={() => decide("swap")} title="Take the knife" body={`Swap: you become the killer, ${killer.name} covers for you.`} tone="rose" />
        <Choice disabled={thinking} onClick={() => decide("refused")} title="Refuse" body="Walk away and expose them at the next meeting." tone="slate" />
      </div>
    </Frame>
  );
}

/** You are the killer and try to recruit someone. */
function YouOfferThem({ state, director, to, onClose }: Omit<Props, "from">) {
  const them = byId(state, to);
  const [chat, setChat] = useState<Line[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState<{ accept: boolean; kind: PactKind } | null>(null);

  async function offer(kind: PactKind) {
    if (thinking || result) return;
    const pitch =
      draft.trim() ||
      (kind === "vouch"
        ? `${them.name}, I'll be straight with you: it was me. Say I was with you at the meeting and you live.`
        : `${them.name}, it was me, and I'm done. Take over. I'll cover for you at every meeting.`);
    setDraft("");
    const next = [...chat, { speaker: "You", text: pitch }];
    setChat(next);
    setThinking(true);
    const answer = await director.pactAnswer(state, to, kind, next);
    setChat([...next, { speaker: them.name, text: answer.say }]);
    setThinking(false);
    setResult({ accept: answer.accept, kind });
    resolvePact(state, "you", to, answer.accept ? kind : "refused", answer.sincere);
  }

  return (
    <Frame title={`Alone with ${them.name}`} who={to} subtitle="Confess and offer a deal. They might accept, refuse, or only pretend.">
      <Chat chat={chat} thinking={thinking ? them.name : null} idOf={(s) => (s === "You" ? "you" : to)} />
      {result ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {result.accept
              ? `${them.name} agreed${result.kind === "swap" ? " to take the knife" : " to cover for you"}. Whether they meant it, you'll find out at the meeting.`
              : `${them.name} refused, and now knows what you are.`}
          </p>
          <button
            onClick={() =>
              onClose(result.accept ? `${them.name} agreed to your deal… apparently.` : `${them.name} refused your deal. They'll talk at the next meeting.`)
            }
            className="rounded-xl border border-line-strong bg-deep-3 px-4 py-2.5 font-semibold text-ink hover:bg-line"
          >
            Leave
          </button>
        </div>
      ) : (
        <>
          <input
            value={draft}
            maxLength={240}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Optional: write your own pitch"
            className="mt-3 w-full rounded-xl border border-orchid/30 bg-abyss px-3.5 py-2.5 text-ink placeholder:text-faint focus:border-orchid/70 focus:outline-none"
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Choice disabled={thinking} onClick={() => void offer("vouch")} title="Ask them to vouch" body="Confess, and ask for an alibi." tone="violet" />
            <Choice disabled={thinking} onClick={() => void offer("swap")} title="Offer the knife" body="They become the killer; you play innocent." tone="rose" />
            <Choice disabled={thinking} onClick={() => onClose("You thought better of it.")} title="Never mind" body="Say nothing and walk away." tone="slate" />
          </div>
        </>
      )}
    </Frame>
  );
}

export function PactDialog(props: Props) {
  return props.from === "you" ? <YouOfferThem {...props} /> : <KillerOffersYou {...props} />;
}

function Frame({ title, subtitle, who, children }: { title: string; subtitle: string; who: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-abyss/85 p-3 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-3xl border border-orchid/35 bg-gradient-to-b from-orchid-dim/70 to-deep p-6 shadow-[0_0_80px_-20px_#b48cff]">
        <div className="flex items-center gap-4">
          <DiverIcon id={who} size={56} glow />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orchid">Private</p>
            <h2 className="mt-0.5 text-xl font-semibold text-ink">{title}</h2>
            <p className="text-sm text-muted">{subtitle}</p>
          </div>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function Chat({ chat, thinking, idOf }: { chat: Line[]; thinking: string | null; idOf: (s: string) => string }) {
  if (chat.length === 0 && !thinking) return null;
  return (
    <div className="max-h-72 space-y-3 overflow-y-auto rounded-2xl border border-line bg-abyss/60 p-3.5" aria-live="polite">
      {chat.map((l, i) => (
        <div key={i} className="animate-rise flex gap-2.5">
          <DiverIcon id={idOf(l.speaker)} size={28} />
          <p className="text-[15px] leading-relaxed text-ink">
            <span className="mr-1.5 text-xs font-semibold text-muted">{l.speaker}</span>
            {l.text}
          </p>
        </div>
      ))}
      {thinking ? <p className="text-sm text-faint">{thinking} is choosing their words…</p> : null}
    </div>
  );
}

function Choice({ title, body, onClick, disabled, tone }: { title: string; body: string; onClick: () => void; disabled?: boolean; tone: "violet" | "rose" | "slate" }) {
  const tones = {
    violet: "border-orchid/50 bg-orchid-dim/40 hover:border-orchid hover:shadow-[0_0_20px_-6px_#b48cff]",
    rose: "border-coral/50 bg-coral-dim/40 hover:border-coral hover:shadow-[0_0_20px_-6px_#ff5d73]",
    slate: "border-line-strong bg-deep hover:border-faint",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-2xl border p-3.5 text-left transition disabled:opacity-40 ${tones[tone]}`}>
      <span className="block font-semibold text-ink">{title}</span>
      <span className="block text-xs text-muted">{body}</span>
    </button>
  );
}
