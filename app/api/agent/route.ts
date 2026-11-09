import { NextResponse, type NextRequest } from "next/server";
import { systemPrompt, userPrompt, responseSchema } from "@/lib/ai/prompts";
import { AgentCtxSchema, OUTPUT_SCHEMAS } from "@/lib/ai/schema";
import { checkLimits } from "@/lib/server/ratelimit";
import { generateJson, geminiConfig, GeminiError } from "@/lib/server/gemini";

export const runtime = "nodejs";

const limits = {
  perIpPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 40),
  perDay: Number(process.env.DAILY_REQUEST_CAP ?? 1500),
};

/** Lets the client show "Gemini live" or "offline mode" before the first meeting. */
export async function GET() {
  const { apiKey, model } = geminiConfig();
  return NextResponse.json({ live: Boolean(apiKey), model: apiKey ? model : null });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > 24_000) return NextResponse.json({ error: "too large" }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const parsed = AgentCtxSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const ctx = parsed.data;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = checkLimits(ip, limits);
  if (!limit.ok) return NextResponse.json({ error: limit.reason }, { status: 429 });

  try {
    const out = await generateJson({
      system: systemPrompt(ctx),
      user: userPrompt(ctx),
      schema: responseSchema(ctx.task),
      maxOutputTokens: ctx.task === "statement" ? 500 : 300,
    });
    const checked = OUTPUT_SCHEMAS[ctx.task].safeParse(out);
    if (!checked.success) return NextResponse.json({ error: "model output did not match" }, { status: 502 });
    return NextResponse.json(checked.data);
  } catch (err) {
    const status = err instanceof GeminiError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
