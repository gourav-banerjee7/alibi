import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCtx } from "@/lib/ai/context";
import { Director } from "@/lib/ai/director";
import { systemPrompt, userPrompt } from "@/lib/ai/prompts";
import { AgentCtxSchema } from "@/lib/ai/schema";
import { scriptedPactAnswer, scriptedStatement, scriptedVote } from "@/lib/ai/scripted";
import { resolvePact } from "@/lib/game/actions";
import { claimIsTrue } from "@/lib/game/memory";
import { byId, currentKiller } from "@/lib/game/rules";
import { newGame } from "@/lib/game/setup";
import { callMeeting, tick } from "@/lib/game/sim";
import type { GameState, MeetingRecord } from "@/lib/game/types";
import { checkLimits, resetLimitsForTests } from "@/lib/server/ratelimit";

function meetingAfterKill(): { state: GameState; meeting: MeetingRecord } {
  for (let seed = 1; seed < 300; seed++) {
    const state = newGame(seed);
    while (state.phase === "roam" && state.t < 300) tick(state, { dir: null, use: false });
    const p = state.pending;
    if (p?.kind === "meeting" && p.body) {
      return { state, meeting: { round: state.round, t: state.t, calledBy: p.calledBy, reason: "body", body: p.body, transcript: [], votes: {} } };
    }
  }
  throw new Error("no meeting");
}

afterEach(() => vi.unstubAllGlobals());

describe("scripted voice", () => {
  it("innocent statements only claim true places; the killer's cover story avoids the murder room", () => {
    const { state, meeting } = meetingAfterKill();
    const kill = state.kills[0]!;
    for (const c of state.characters.filter((c) => c.alive && !c.isPlayer)) {
      const s = scriptedStatement(state, c.id, meeting);
      expect(s.say.length).toBeGreaterThan(10);
      if (c.role === "crew") for (const claim of s.claims) expect(claimIsTrue(state, c.id, claim)).toBe(true);
      if (c.role === "killer") {
        const atKill = s.claims.find((x) => x.from <= kill.t && x.to >= kill.t);
        if (atKill) expect(atKill.loc).not.toBe(kill.loc);
      }
      meeting.transcript.push({ speaker: c.id, text: s.say, claims: s.claims, kind: "statement" });
    }
  });

  it("votes are valid and the killer never votes for itself", () => {
    const { state, meeting } = meetingAfterKill();
    const alive = new Set(state.characters.filter((c) => c.alive).map((c) => c.id));
    for (const c of state.characters.filter((c) => c.alive && !c.isPlayer)) {
      const v = scriptedVote(state, c.id, meeting);
      expect(v.vote === "skip" || alive.has(v.vote)).toBe(true);
      expect(v.vote).not.toBe(c.id);
      if (c.role === "killer") expect(v.vote).not.toBe("skip");
    }
  });

  it("someone who refused a pact names the killer, and votes for them", () => {
    const state = newGame(11, "killer");
    const tobias = byId(state, "tobias"); // paranoid: refuses
    resolvePact(state, "you", tobias.id, "refused");
    callMeeting(state, "tobias", "emergency");
    const meeting: MeetingRecord = { round: 1, t: state.t, calledBy: "tobias", reason: "emergency", transcript: [], votes: {} };
    expect(scriptedStatement(state, "tobias", meeting).say).toMatch(/You.*killer/);
    expect(scriptedVote(state, "tobias", meeting).vote).toBe("you");
  });

  it("personas answer pacts in character", () => {
    const s = newGame(1, "killer");
    expect(scriptedPactAnswer(s, byId(s, "juno"), "vouch").accept).toBe(true);
    expect(scriptedPactAnswer(s, byId(s, "tobias"), "vouch").accept).toBe(false);
    expect(scriptedPactAnswer(s, byId(s, "ines"), "swap").accept).toBe(false);
  });
});

describe("prompt context", () => {
  it("keeps the killer's secrets out of an innocent's prompt", () => {
    const { state, meeting } = meetingAfterKill();
    const killer = currentKiller(state)!;
    const innocent = state.characters.find((c) => c.alive && !c.isPlayer && c.role === "crew")!;
    const ctx = buildCtx(state, innocent.id, "statement", { meeting });
    expect(AgentCtxSchema.safeParse(ctx).success).toBe(true);
    const prompt = systemPrompt(ctx) + userPrompt(ctx);
    expect(prompt).not.toContain("You killed");
    expect(prompt).not.toContain("COVER STORY");
    expect(prompt).toContain("You are innocent crew");

    const kctx = buildCtx(state, killer.id, "statement", { meeting });
    const kprompt = systemPrompt(kctx) + userPrompt(kctx);
    expect(kprompt).toContain("You killed");
    expect(kprompt).toContain("COVER STORY");
  });
});

describe("director", () => {
  it("falls back to the scripted voice when the API fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 502 })));
    const { state, meeting } = meetingAfterKill();
    const d = new Director(true, "gemini-test");
    const speaker = state.characters.find((c) => c.alive && !c.isPlayer)!;
    const line = await d.statement(state, speaker.id, meeting);
    expect(line.text.length).toBeGreaterThan(10);
    expect(d.status.fallbacks).toBe(1);
  });

  it("goes offline for good when the server has no key", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const { state, meeting } = meetingAfterKill();
    const d = new Director(true, "gemini-test");
    const speaker = state.characters.find((c) => c.alive && !c.isPlayer)!;
    await d.statement(state, speaker.id, meeting);
    await d.statement(state, speaker.id, meeting);
    expect(d.status.mode).toBe("offline");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("an innocent who the model puts somewhere they never went is replaced by the truth", async () => {
    const { state, meeting } = meetingAfterKill();
    const innocent = state.characters.find((c) => c.alive && !c.isPlayer && c.role === "crew")!;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ say: "I was in the reactor, the dock, the lab, comms, medbay and hydroponics all night.", claims: [] }), { status: 200 })),
    );
    const d = new Director(true, "gemini-test");
    const line = await d.statement(state, innocent.id, meeting);
    expect(line.text).not.toContain("all night");
    for (const c of line.claims ?? []) expect(claimIsTrue(state, innocent.id, c)).toBe(true);
  });

  it("rejects a vote for a character that doesn't exist", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ vote: "nobody", reason: "?" }), { status: 200 })));
    const { state, meeting } = meetingAfterKill();
    const voter = state.characters.find((c) => c.alive && !c.isPlayer)!;
    const v = await new Director(true, null).vote(state, voter.id, meeting);
    expect(v.vote === "skip" || state.characters.some((c) => c.id === v.vote)).toBe(true);
  });
});

describe("rate limits", () => {
  it("caps per IP per minute and per day", () => {
    resetLimitsForTests();
    const limits = { perIpPerMinute: 3, perDay: 5 };
    const t = Date.UTC(2026, 0, 1, 12);
    expect([1, 2, 3].map((i) => checkLimits("a", limits, t + i).ok)).toEqual([true, true, true]);
    expect(checkLimits("a", limits, t + 4).ok).toBe(false);
    expect(checkLimits("a", limits, t + 61_000).ok).toBe(true);
    expect(checkLimits("b", limits, t + 61_001).ok).toBe(true);
    expect(checkLimits("c", limits, t + 61_002).ok).toBe(false); // day cap of 5
  });
});

describe("scripted votes stay fair", () => {
  it("innocent crew rarely vote for another innocent with truthful alibis", () => {
    let wrong = 0;
    let total = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const state = newGame(seed);
      while (state.phase === "roam" && state.t < 300) tick(state, { dir: null, use: false });
      const p = state.pending;
      if (p?.kind !== "meeting") continue;
      const meeting: MeetingRecord = { round: 1, t: state.t, calledBy: p.calledBy, reason: p.reason, body: p.body, transcript: [], votes: {} };
      for (const c of state.characters.filter((c) => c.alive && !c.isPlayer)) {
        const s = scriptedStatement(state, c.id, meeting);
        meeting.transcript.push({ speaker: c.id, text: s.say, claims: s.claims, kind: "statement" });
      }
      for (const c of state.characters.filter((c) => c.alive && !c.isPlayer && c.role === "crew")) {
        const v = scriptedVote(state, c.id, meeting).vote;
        if (v === "skip") continue;
        total++;
        if (byId(state, v).role === "crew") wrong++;
      }
    }
    // Votes that aren't skips should mostly land on the killer.
    expect(total).toBeGreaterThan(0);
    expect(wrong / total).toBeLessThan(0.25);
  });
});
