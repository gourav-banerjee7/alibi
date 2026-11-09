import { parseClock } from "@/lib/game/clock";
import { statementIsConsistent } from "@/lib/game/judge";
import { claimsOf, coverStory, recollect } from "@/lib/game/memory";
import { aliveChars, alliesOfKiller, byId } from "@/lib/game/rules";
import type { Claim, GameState, MeetingRecord, PactKind, TranscriptLine } from "@/lib/game/types";
import { buildCtx } from "./context";
import { PactAnswerOut, SayOut, StatementOut, VoteOut, type AgentCtx } from "./schema";
import {
  pactDisposition,
  scriptedPactAnswer,
  scriptedPactChat,
  scriptedPitch,
  scriptedReply,
  scriptedStatement,
  scriptedVote,
} from "./scripted";

export type VoiceMode = "live" | "offline";

export interface DirectorStatus {
  mode: VoiceMode;
  model: string | null;
  /** Lines that fell back to the scripted voice this game. */
  fallbacks: number;
  note?: string;
}

/**
 * Speaks for every AI character. Uses Gemini through /api/agent when it is available and
 * falls back, line by line, to the scripted voice when it isn't, or when an innocent
 * character's answer contradicts what they actually saw.
 */
export class Director {
  status: DirectorStatus;
  private pausedUntil = 0;
  private listeners = new Set<(s: DirectorStatus) => void>();

  constructor(live: boolean, model: string | null) {
    this.status = { mode: live ? "live" : "offline", model, fallbacks: 0 };
  }

  onStatus(fn: (s: DirectorStatus) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private update(patch: Partial<DirectorStatus>) {
    this.status = { ...this.status, ...patch };
    for (const fn of this.listeners) fn(this.status);
  }

  private fellBack(note?: string) {
    this.update({ fallbacks: this.status.fallbacks + 1, ...(note ? { note } : {}) });
  }

  private async ask(ctx: AgentCtx): Promise<unknown | undefined> {
    if (this.status.mode !== "live" || Date.now() < this.pausedUntil) return undefined;
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ctx),
      });
      if (res.status === 503) {
        this.update({ mode: "offline", note: "No Gemini key on the server. Playing with scripted voices." });
        return undefined;
      }
      if (res.status === 429) {
        this.pausedUntil = Date.now() + 45_000;
        this.fellBack("Gemini is rate-limited. Using scripted voices for a bit.");
        return undefined;
      }
      if (!res.ok) {
        this.fellBack();
        return undefined;
      }
      return await res.json();
    } catch {
      this.fellBack();
      return undefined;
    }
  }

  async statement(state: GameState, id: string, meeting: MeetingRecord): Promise<TranscriptLine> {
    const me = byId(state, id);
    const out = StatementOut.safeParse(await this.ask(buildCtx(state, id, "statement", { meeting })));
    if (!out.success) {
      const s = scriptedStatement(state, id, meeting);
      return { speaker: id, text: s.say, claims: s.claims, kind: "statement" };
    }

    // Innocent characters can't lie: their claims are always the truth, and if the model put
    // them somewhere they never went, use the scripted line instead.
    if (me.role !== "killer") {
      const truth = claimsOf(recollect(state, id, state.roundStart, state.t));
      const allowed = meeting.body ? [meeting.body.loc, "mess" as const] : ["mess" as const];
      if (!statementIsConsistent(state, id, out.data.say, allowed)) {
        this.fellBack();
        const s = scriptedStatement(state, id, meeting);
        return { speaker: id, text: s.say, claims: s.claims, kind: "statement" };
      }
      return { speaker: id, text: out.data.say, claims: truth, kind: "statement" };
    }

    // The killer may lie; keep what they claimed so it can be checked against the truth later.
    const claims: Claim[] = [];
    for (const c of out.data.claims) {
      const from = parseClock(c.from);
      const to = parseClock(c.to);
      if (from !== undefined && to !== undefined && to >= from) claims.push({ loc: c.place, from, to });
    }
    return {
      speaker: id,
      text: out.data.say,
      claims: claims.length > 0 ? claims : coverStory(state, id, state.roundStart, state.t),
      kind: "statement",
    };
  }

  async reply(state: GameState, id: string, meeting: MeetingRecord, question: string, asker: string): Promise<TranscriptLine> {
    const ctx = buildCtx(state, id, "reply", { meeting, question, asker: byId(state, asker).name });
    const out = SayOut.safeParse(await this.ask(ctx));
    return { speaker: id, text: out.success ? out.data.say : scriptedReply(state, id, question, asker), kind: "reply", to: asker };
  }

  async vote(state: GameState, id: string, meeting: MeetingRecord): Promise<{ vote: string; reason: string }> {
    const me = byId(state, id);
    const fallback = () => scriptedVote(state, id, meeting);
    const out = VoteOut.safeParse(await this.ask(buildCtx(state, id, "vote", { meeting })));
    if (!out.success) return fallback();

    const valid = new Set([...aliveChars(state).map((c) => c.id), "skip"]);
    const vote = out.data.vote.trim().toLowerCase();
    if (!valid.has(vote) || vote === id) return fallback();
    // Killer's side never votes out its own.
    const allies = alliesOfKiller(state);
    const onKillerSide = me.role !== "crew" || allies.has(id);
    if (onKillerSide && (byId(state, vote === "skip" ? id : vote).role === "killer" || allies.has(vote))) return fallback();
    return { vote, reason: out.data.reason };
  }

  async pactPitch(state: GameState, killerId: string): Promise<string> {
    const out = SayOut.safeParse(await this.ask(buildCtx(state, killerId, "pactPitch", { pactWith: "the relief diver" })));
    return out.success ? out.data.say : scriptedPitch(state, killerId);
  }

  async pactChat(state: GameState, killerId: string, chat: Array<{ speaker: string; text: string }>): Promise<string> {
    const out = SayOut.safeParse(await this.ask(buildCtx(state, killerId, "pactChat", { pactWith: "the relief diver", pactChat: chat })));
    const last = chat.filter((l) => l.speaker !== byId(state, killerId).name).at(-1)?.text ?? "";
    return out.success ? out.data.say : scriptedPactChat(state, killerId, last);
  }

  /** The player (as killer) offered `id` a deal. */
  async pactAnswer(
    state: GameState,
    id: string,
    kind: PactKind,
    chat: Array<{ speaker: string; text: string }>,
  ): Promise<{ say: string; accept: boolean; sincere: boolean }> {
    const c = byId(state, id);
    const disposition = pactDisposition(c, kind);
    const offer = kind === "swap" ? "They want you to take over the killing while they play innocent." : "They want you to vouch for them at the next meeting.";
    const out = PactAnswerOut.safeParse(
      await this.ask(buildCtx(state, id, "pactAnswer", { pactWith: "the relief diver", pactChat: [...chat, { speaker: "Station", text: offer }] })),
    );
    if (!out.success) return { ...scriptedPactAnswer(state, c, kind), sincere: disposition.sincere };
    // The model decides the words and whether they agree; the persona decides whether they mean it.
    return { say: out.data.say, accept: out.data.accept, sincere: out.data.accept && disposition.sincere };
  }
}
