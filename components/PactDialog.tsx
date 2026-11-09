"use client";

import { useEffect, useRef, useState } from "react";
import type { Director } from "@/lib/ai/director";
import { resolvePact, type PactDecision } from "@/lib/game/actions";
import { byId } from "@/lib/game/rules";
import type { GameState, PactKind } from "@/lib/game/types";

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
    <Frame title={`${killer.name} corners you`} accent={killer.color} subtitle="Nobody else can hear this.">
      <Chat chat={chat} thinking={thinking ? killer.name : null} colorOf={(s) => (s === "You" ? "#f5f5f4" : killer.color)} />
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
          className="flex-1 rounded-lg border border-violet-900 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none disabled:opacity-50"
        />
        <button disabled={thinking || replies >= MAX_REPLIES} className="rounded-lg bg-violet-700 px-4 py-2 font-semibold text-white hover:bg-violet-600 disabled:opacity-40">
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
    <Frame title={`Alone with ${them.name}`} accent={them.color} subtitle="Confess and offer a deal. They might accept, refuse, or only pretend.">
      <Chat chat={chat} thinking={thinking ? them.name : null} colorOf={(s) => (s === "You" ? "#f5f5f4" : them.color)} />
      {result ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-300">
            {result.accept
              ? `${them.name} agreed${result.kind === "swap" ? " to take the knife" : " to cover for you"}. Whether they meant it, you'll find out at the meeting.`
              : `${them.name} refused, and now knows what you are.`}
          </p>
          <button
            onClick={() =>
              onClose(result.accept ? `${them.name} agreed to your deal… apparently.` : `${them.name} refused your deal. They'll talk at the next meeting.`)
            }
            className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-600"
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
            className="mt-3 w-full rounded-lg border border-violet-900 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
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

function Frame({ title, subtitle, accent, children }: { title: string; subtitle: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#05030f]/80 p-3 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-violet-900/80 bg-[#0b0718] p-5 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">Private</p>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-50">
          <span className="h-3 w-3 rounded-full" style={{ background: accent }} /> {title}
        </h2>
        <p className="text-sm text-slate-400">{subtitle}</p>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function Chat({ chat, thinking, colorOf }: { chat: Line[]; thinking: string | null; colorOf: (s: string) => string }) {
  if (chat.length === 0 && !thinking) return null;
  return (
    <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg bg-black/30 p-3" aria-live="polite">
      {chat.map((l, i) => (
        <div key={i} className="flex gap-2.5">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(l.speaker) }} />
          <p className="text-[15px] leading-relaxed text-slate-100">
            <span className="mr-1.5 text-xs font-semibold text-slate-400">{l.speaker}</span>
            {l.text}
          </p>
        </div>
      ))}
      {thinking ? <p className="text-sm text-slate-500">{thinking} is choosing their words…</p> : null}
    </div>
  );
}

function Choice({ title, body, onClick, disabled, tone }: { title: string; body: string; onClick: () => void; disabled?: boolean; tone: "violet" | "rose" | "slate" }) {
  const tones = {
    violet: "border-violet-700 hover:bg-violet-950",
    rose: "border-rose-700 hover:bg-rose-950",
    slate: "border-slate-700 hover:bg-slate-900",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-lg border p-3 text-left transition disabled:opacity-40 ${tones[tone]}`}>
      <span className="block font-semibold text-slate-50">{title}</span>
      <span className="block text-xs text-slate-400">{body}</span>
    </button>
  );
}
