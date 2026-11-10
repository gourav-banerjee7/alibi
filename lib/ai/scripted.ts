/**
 * The offline voice of the crew. Deterministic, built straight from the simulation, and used
 * whenever Gemini is unavailable (no key, quota reached, timeout, or an inconsistent answer).
 */
import { clock } from "@/lib/game/clock";
import { confront, contradictionsFor } from "@/lib/game/judge";
import { locationName } from "@/lib/game/map";
import { cameraRecollections, claimsOf, coverStory, killsSeenOnCamera, lastSighting, recollect } from "@/lib/game/memory";
import { alliesOfKiller, aliveChars, byId } from "@/lib/game/rules";
import type { Character, Claim, GameState, MeetingRecord, PactKind } from "@/lib/game/types";
import { secretsOf } from "./context";

const OPENERS: Record<string, string[]> = {
  mara: ["Fine, I'll go.", "Let's be precise about this.", "Right. Times, people."],
  juno: ["Okay, okay, um.", "Sorry, I'm shaking.", "Right, so, technically,"],
  tobias: ["Facts only.", "Listen up.", "Here's my timeline."],
  ines: ["Let's stay calm.", "Breathe, everyone.", "I'll keep this simple."],
  kenji: ["Well, this is a terrible party.", "Not how I pictured the night shift.", "Okay, serious face on."],
};

const ACCUSE_RE = /\b(killer|kill(ed)?|lying|liar|lie|lies|suspicious|sus|did it|murder|guilty|vote)\b/i;

const hash = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7);
const choose = <T,>(items: T[], key: string) => items[Math.abs(hash(key)) % items.length]!;

function opener(c: Character, key: string) {
  return choose(OPENERS[c.id] ?? ["Okay."], key);
}

/** "you", "you and Mara", "you, Mara and Juno". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const SPOKEN_CLAIMS = 3;

/** Who someone really shared each claimed stretch with, keyed like narrate() expects. */
function companyFor(state: GameState, id: string, claims: Claim[]): Map<string, string[]> {
  const company = new Map<string, string[]>();
  const recs = recollect(state, id, state.roundStart, state.t);
  for (const c of claims) {
    const rec = recs.find((r) => r.loc === c.loc && Math.abs(r.from - c.from) < 0.5 && Math.abs(r.to - c.to) < 0.5);
    if (rec) company.set(`${c.loc}@${c.from}`, rec.saw.map((s) => (s === "you" ? "you" : byId(state, s).name)));
  }
  return company;
}

function narrate(state: GameState, claims: Claim[], company?: Map<string, string[]>): string {
  const recent = claims.slice(-SPOKEN_CLAIMS);
  if (recent.length === 0) return "I was walking the tubes most of the time, not in any one room.";
  const parts = recent.map((c, i) => {
    const who = company?.get(`${c.loc}@${c.from}`);
    // Unknown company (an invented stretch) reads as "alone"; a real empty room too.
    const withWho = who && who.length > 0 ? ` with ${listNames(who)}` : ", alone";
    const lead = i === 0 ? "I was in" : "then";
    return `${lead} ${locationName(c.loc)} from ${clock(c.from)} to ${clock(c.to)}${withWho}`;
  });
  return parts.join(", ") + ".";
}

/** Exposes a pact confession if this character knows one. */
function exposure(state: GameState, id: string): { text: string; target: string } | undefined {
  // Video beats hearsay: a murder seen on camera comes first.
  const filmed = killsSeenOnCamera(state, id)[0];
  if (filmed) {
    return {
      text: `I was on the cameras at ${clock(filmed.t)}. I watched ${byId(state, filmed.killer).name} kill ${byId(state, filmed.victim).name} in ${locationName(filmed.loc)}. I saw it happen.`,
      target: filmed.killer,
    };
  }
  for (const o of state.pactOffers) {
    if (o.to !== id) continue;
    const pact = state.pacts.find((p) => p.killer === o.from && p.partner === id);
    if (o.outcome === "refused" || (pact && !pact.sincere)) {
      return {
        text: `${byId(state, o.from).name} pulled me aside at ${clock(o.t)} and admitted it. They're the killer. They tried to buy my silence.`,
        target: o.from,
      };
    }
  }
  return undefined;
}

export function scriptedStatement(state: GameState, id: string, meeting: MeetingRecord): { say: string; claims: Claim[] } {
  const me = byId(state, id);
  const isKiller = me.role === "killer";
  const all = isKiller ? coverStory(state, id, state.roundStart, state.t) : claimsOf(recollect(state, id, state.roundStart, state.t));
  // Only what is actually said counts as a claim others can check.
  const claims = all.slice(-SPOKEN_CLAIMS);
  const parts = [opener(me, `${id}${state.t}`), narrate(state, claims, companyFor(state, id, claims))];

  // Mention one thing seen on the camera feeds, if they sat at the desk.
  if (!isKiller) {
    const feed = cameraRecollections(state, id, state.roundStart, state.t).find((r) => r.saw.length > 0);
    if (feed) {
      const who = feed.saw.map((s) => (s === "you" ? "you" : byId(state, s).name));
      parts.push(`I also sat at the cameras: ${listNames(who)} on the ${locationName(feed.loc)} feed around ${clock(feed.from)}.`);
    }
  }

  const victim = meeting.body?.victim;
  if (victim && !isKiller) {
    const seen = lastSighting(state, id, victim, meeting.body!.t + 0.01);
    parts.push(
      seen
        ? `Last time I saw ${byId(state, victim).name} was in ${locationName(seen.loc)} around ${clock(seen.t)}.`
        : `I never crossed paths with ${byId(state, victim).name} this round.`,
    );
  }

  const exposed = exposure(state, id);
  if (exposed) parts.push(exposed.text);
  else {
    if (!isKiller) {
      for (const l of meeting.transcript) {
        if (l.speaker === id || !l.claims?.length) continue;
        const challenge = confront(state, id, l.speaker, l.claims);
        if (challenge) {
          parts.push(challenge);
          break;
        }
      }
    }
  }

  if (isKiller && secretsOf(state, id).some((s) => s.includes("they refused"))) {
    parts.push("And watch the diver. They've been jumpy all night.");
  }
  return { say: parts.join(" "), claims };
}

export function scriptedReply(state: GameState, id: string, question: string, asker: string): string {
  const me = byId(state, id);
  const q = question.toLowerCase();
  const claims = me.role === "killer" ? coverStory(state, id, state.roundStart, state.t) : claimsOf(recollect(state, id, state.roundStart, state.t));
  const alibi = narrate(state, claims, companyFor(state, id, claims.slice(-SPOKEN_CLAIMS)));

  if (ACCUSE_RE.test(question)) {
    if (me.role === "killer" || me.role === "accomplice") {
      const scapegoat = aliveChars(state).find((c) => c.id !== id && c.id !== asker && !alliesOfKiller(state).has(c.id) && c.role !== "killer");
      return `Me? ${alibi} If you want someone who can't account for themselves, ask ${scapegoat?.name ?? "around"}.`;
    }
    return `I didn't do anything. ${alibi} Check it with anyone who was there.`;
  }

  // The player's name is "You", which every question contains; only match the crew by name.
  const other = aliveChars(state).find((c) => c.id !== id && !c.isPlayer && new RegExp(`\\b${c.name.toLowerCase()}\\b`).test(q));
  if (other) {
    const seen = lastSighting(state, id, other.id, state.t);
    if (me.role === "killer") return `${other.name}? Couldn't tell you. I was busy. ${alibi}`;
    return seen ? `I last saw ${other.name} in ${locationName(seen.loc)} around ${clock(seen.t)}.` : `I didn't see ${other.name} at all this round.`;
  }
  return alibi.charAt(0).toUpperCase() + alibi.slice(1);
}

/** How suspicious `target` looks to `voter`, from what the voter actually knows. */
export function suspicion(state: GameState, voter: string, target: string, meeting: MeetingRecord): number {
  let score = 0;
  for (const line of meeting.transcript) {
    if (line.speaker === target && line.claims?.length) score += 3 * contradictionsFor(state, voter, target, line.claims).length;
    if (line.speaker !== target && line.speaker !== voter && line.text.toLowerCase().includes(byId(state, target).name.toLowerCase()) && ACCUSE_RE.test(line.text)) {
      score += line.speaker === "you" ? 2 : 1;
    }
  }
  // Being in a crowd with the victim proves nothing; being the only one with them does.
  const victim = meeting.body?.victim;
  if (victim) {
    const recs = recollect(state, voter, state.roundStart, meeting.body!.t + 0.01);
    const last = [...recs].reverse().find((r) => r.saw.includes(victim));
    if (last && last.saw.length === 2 && last.saw.includes(target)) score += 2;
  }
  if (exposure(state, voter)?.target === target) score += 6;
  return score;
}

export function scriptedVote(state: GameState, id: string, meeting: MeetingRecord): { vote: string; reason: string } {
  const me = byId(state, id);
  const allies = alliesOfKiller(state);
  const killerSide = me.role === "killer" || me.role === "accomplice" || allies.has(id);
  const candidates = aliveChars(state).filter((c) => c.id !== id && !(killerSide && (c.role === "killer" || allies.has(c.id))));
  const ranked = candidates
    .map((c) => ({ c, s: suspicion(state, id, c.id, meeting) }))
    .sort((a, b) => b.s - a.s || a.c.id.localeCompare(b.c.id));
  const top = ranked[0];
  if (!top) return { vote: "skip", reason: "No one to vote for." };
  if (!killerSide && top.s < 3) return { vote: "skip", reason: "Nothing points anywhere yet." };
  return { vote: top.c.id, reason: killerSide ? `Going with the room on ${top.c.name}.` : `${top.c.name}'s story doesn't hold up.` };
}

const PITCH: Record<string, string> = {
  mara: "Don't scream, it's undignified. You've worked it out, so let's be adults. Vouch for me at the next meeting and you walk off this station. Or take the knife and I'll play the grieving biologist. Your call.",
  juno: "Okay, please don't panic, I'm not going to hurt you, probably. Just say I was with you. Or, um, you could take over? Honestly I'm bad at this. I'd cover for you.",
  tobias: "Quiet. I run security, so nobody checks me. You say I was with you, you live. Or you take over and I make sure every finger points away from you.",
  ines: "Shh, it's alright. I don't want you hurt. Tell them I was with you, and you'll be fine. Or, if you'd rather hold the knife yourself, I'll keep you safe at the meeting.",
  kenji: "So, funny story, it's me. Plot twist. Here's the deal: you vouch for me and you get the happy ending. Or you take over and I'll be your loudest fan.",
};

export function scriptedPitch(state: GameState, id: string): string {
  return PITCH[id] ?? "Keep your voice down. Vouch for me at the meeting and you live. Or take the knife yourself and I'll cover for you.";
}

export function scriptedPactChat(_state: GameState, id: string, playerText: string): string {
  const t = playerText.toLowerCase();
  if (/\b(no|never|refuse|won't|wont|tell everyone)\b/.test(t)) return id === "kenji" ? "Wow, rude. Clock's ticking, though." : "Think carefully. It's a long way to the surface.";
  if (/\b(swap|knife|take over|take it)\b/.test(t)) return "Then it's yours. Nobody suspects the new diver, and I'll back you up.";
  if (/\b(why|how)\b/.test(t)) return "Because the storm won't last forever and only one story walks off this station. Make it ours.";
  return "Vouch for me, or take the knife. Those are the options. Choose.";
}

/** Whether the AI would agree, and whether it means it. */
export function pactDisposition(c: Character, kind: PactKind): { accept: boolean; sincere: boolean } {
  switch (c.pactStyle) {
    case "greedy":
      return { accept: true, sincere: true };
    case "schemer":
      return { accept: true, sincere: kind === "vouch" };
    case "honest":
      return { accept: kind === "vouch", sincere: false };
    case "paranoid":
    case "loyal":
      return { accept: false, sincere: false };
  }
}

const ANSWERS: Record<string, { yes: string; no: string }> = {
  mara: { yes: "Interesting. Fine. I never saw you, and you never saw me.", no: "No. And everyone's going to hear about this." },
  juno: { yes: "Okay. Okay! Yes. Just don't hurt me. I'll back you up.", no: "No, no, no. I can't, I'm sorry, I'm telling them." },
  tobias: { yes: "Fine. You're with me. Don't make me regret it.", no: "You just confessed to the head of security. Bad move." },
  ines: { yes: "Alright. I'll say you were with me. Just stop, please.", no: "I can't do that. I'm sorry." },
  kenji: { yes: "Ha. Sure, partner.", no: "Hard pass. Like, the hardest. Everyone's hearing about this." },
};

export function scriptedPactAnswer(_state: GameState, c: Character, kind: PactKind): { say: string; accept: boolean } {
  const { accept } = pactDisposition(c, kind);
  const lines = ANSWERS[c.id] ?? { yes: "Fine.", no: "No." };
  return { say: accept ? lines.yes : lines.no, accept };
}
