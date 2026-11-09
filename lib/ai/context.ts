import { clock } from "@/lib/game/clock";
import { contradictionsFor } from "@/lib/game/judge";
import { locationName } from "@/lib/game/map";
import { coverStory, describeClaim, describeRecollection, lastSighting, recollect } from "@/lib/game/memory";
import { aliveChars, byId } from "@/lib/game/rules";
import type { GameState, MeetingRecord } from "@/lib/game/types";
import type { AgentCtx, Task } from "./schema";

export interface CtxExtras {
  meeting?: MeetingRecord;
  question?: string;
  asker?: string;
  pactChat?: Array<{ speaker: string; text: string }>;
  pactWith?: string;
}

/** What happened that everyone in the meeting knows. */
export function situation(state: GameState, meeting?: MeetingRecord): string {
  const parts: string[] = [];
  if (meeting?.body) {
    const b = meeting.body;
    parts.push(
      `${byId(state, b.victim).name}'s body was found in ${locationName(b.loc)} by ${byId(state, meeting.calledBy).name} at ${clock(b.foundAt ?? state.t)}. Everyone is in the Mess Hall for an emergency meeting.`,
    );
  } else if (meeting) {
    parts.push(`${byId(state, meeting.calledBy).name} called an emergency meeting in the Mess Hall.`);
  }
  const dead = state.characters.filter((c) => !c.alive && !c.ejected && c.id !== meeting?.body?.victim).map((c) => c.name);
  if (dead.length > 0) parts.push(`Already dead: ${dead.join(", ")}.`);
  const ejected = state.characters.filter((c) => c.ejected).map((c) => c.name);
  if (ejected.length > 0) parts.push(`Locked in the dive chamber after earlier votes: ${ejected.join(", ")}.`);
  parts.push(`This is meeting ${state.meetings.length + 1} of 3; the storm clears after the third.`);
  return parts.join(" ");
}

/** Private knowledge: kills, pacts, confessions. */
export function secretsOf(state: GameState, id: string): string[] {
  const me = byId(state, id);
  const out: string[] = [];
  for (const k of state.kills.filter((k) => k.killer === id)) {
    out.push(`You killed ${byId(state, k.victim).name} in ${locationName(k.loc)} at ${clock(k.t)}.`);
  }
  for (const o of state.pactOffers) {
    const from = byId(state, o.from).name;
    const to = byId(state, o.to).name;
    if (o.from === id) {
      out.push(
        o.outcome === "refused"
          ? `At ${clock(o.t)} you secretly offered ${to} a deal and they refused. They know what you are and may expose you, so get ahead of it.`
          : `At ${clock(o.t)} ${to} secretly agreed to your deal (${o.outcome === "accepted-swap" ? "they took over the killing" : "they will vouch for you"}).`,
      );
    }
    if (o.to === id) {
      const pact = state.pacts.find((p) => p.killer === o.from && p.partner === id);
      if (o.outcome === "refused") {
        out.push(`At ${clock(o.t)} ${from} confessed to you in private that they are the killer and offered you a deal. You refused. Tell the meeting.`);
      } else if (pact && !pact.sincere) {
        out.push(`At ${clock(o.t)} ${from} confessed to you in private that they are the killer. You pretended to agree to their deal so you could expose them. Expose them now.`);
      } else {
        out.push(`At ${clock(o.t)} you agreed to ${from}'s secret deal. Protect ${from}.`);
      }
    }
  }
  if (me.role === "accomplice") {
    const k = state.characters.find((c) => c.role === "killer");
    if (k) out.push(`${k.name} is now the killer and you are their secret accomplice. Keep suspicion off them.`);
  }
  return out;
}

export function memoryLines(state: GameState, id: string, meeting?: MeetingRecord): string[] {
  const lines = recollect(state, id, state.roundStart, state.t).map((r) => describeRecollection(state, r));
  const victim = meeting?.body?.victim;
  if (victim && victim !== id) {
    const seen = lastSighting(state, id, victim, meeting.body!.t + 0.01);
    lines.push(
      seen
        ? `You last saw ${byId(state, victim).name} alive in ${locationName(seen.loc)} around ${clock(seen.t)}.`
        : `You did not see ${byId(state, victim).name} at all this round.`,
    );
  }
  return lines;
}

export function noticedBy(state: GameState, id: string, meeting?: MeetingRecord): string[] {
  if (!meeting) return [];
  const out: string[] = [];
  for (const line of meeting.transcript) {
    if (line.speaker === id || !line.claims?.length) continue;
    out.push(...contradictionsFor(state, id, line.speaker, line.claims));
  }
  return [...new Set(out)].slice(0, 12);
}

export function buildCtx(state: GameState, id: string, task: Task, extras: CtxExtras = {}): AgentCtx {
  const me = byId(state, id);
  const nameOf = (speaker: string) => (speaker === "system" ? "Station" : byId(state, speaker).name);
  return {
    task,
    me: { id: me.id, name: me.name, job: me.job, voice: me.voice, role: me.role, pactStyle: me.pactStyle },
    clock: clock(state.t),
    situation: extras.meeting
      ? situation(state, extras.meeting)
      : `You are alone with ${extras.pactWith ?? "someone"} in ${locationName(me.loc)}. Nobody else can hear.`,
    secrets: secretsOf(state, id).slice(0, 8),
    memory: memoryLines(state, id, extras.meeting).slice(-30),
    cover: me.role === "killer" ? coverStory(state, id, state.roundStart, state.t).map(describeClaim).slice(0, 15) : [],
    noticed: noticedBy(state, id, extras.meeting),
    alive: aliveChars(state).map((c) => ({ id: c.id, name: c.name })),
    transcript: (extras.meeting?.transcript ?? [])
      .filter((l) => l.kind !== "vote")
      .slice(-30)
      .map((l) => ({ speaker: nameOf(l.speaker), text: l.text.slice(0, 400) })),
    question: extras.question?.slice(0, 300),
    asker: extras.asker,
    pactChat: extras.pactChat?.slice(-12).map((l) => ({ speaker: l.speaker, text: l.text.slice(0, 400) })),
    pactWith: extras.pactWith,
  };
}
