import { z } from "zod";

const text = (max: number) => z.string().max(max);
const lines = (maxItems: number, maxLen = 300) => z.array(text(maxLen)).max(maxItems);

export const TASKS = ["statement", "reply", "vote", "pactPitch", "pactChat", "pactAnswer"] as const;
export type Task = (typeof TASKS)[number];

/**
 * Everything a character knows, sent from the browser. The server turns this into the prompt;
 * it never accepts a prompt directly, so the endpoint can't be used as a general Gemini proxy.
 */
export const AgentCtxSchema = z.object({
  task: z.enum(TASKS),
  me: z.object({
    id: text(20),
    name: text(30),
    job: text(60),
    voice: text(200),
    role: z.enum(["crew", "killer", "accomplice"]),
    pactStyle: z.enum(["greedy", "honest", "loyal", "paranoid", "schemer"]),
  }),
  clock: text(5),
  situation: text(300),
  secrets: lines(8),
  memory: lines(30),
  cover: lines(15),
  noticed: lines(12),
  alive: z.array(z.object({ id: text(20), name: text(30) })).max(8),
  transcript: z.array(z.object({ speaker: text(30), text: text(400) })).max(40),
  question: text(300).optional(),
  asker: text(30).optional(),
  pactChat: z.array(z.object({ speaker: text(30), text: text(400) })).max(12).optional(),
  pactWith: text(30).optional(),
});
export type AgentCtx = z.infer<typeof AgentCtxSchema>;

export const PLACE_IDS = ["dock", "comms", "lab", "mess", "reactor", "medbay", "hydro"] as const;

export const StatementOut = z.object({
  say: text(600),
  claims: z
    .array(z.object({ place: z.enum(PLACE_IDS), from: text(5), to: text(5) }))
    .max(8)
    .default([]),
});
export const SayOut = z.object({ say: text(600) });
export const VoteOut = z.object({ vote: text(20), reason: text(300) });
export const PactAnswerOut = z.object({ say: text(600), accept: z.boolean() });

export type StatementResult = z.infer<typeof StatementOut>;
export type VoteResult = z.infer<typeof VoteOut>;
export type PactAnswerResult = z.infer<typeof PactAnswerOut>;

export const OUTPUT_SCHEMAS = {
  statement: StatementOut,
  reply: SayOut,
  vote: VoteOut,
  pactPitch: SayOut,
  pactChat: SayOut,
  pactAnswer: PactAnswerOut,
} as const;
