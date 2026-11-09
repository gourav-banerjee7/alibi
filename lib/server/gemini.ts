import "server-only";

export const DEFAULT_MODEL = "gemini-3.5-flash";

export function geminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
  };
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** One structured-output call to the Gemini API. Returns the parsed JSON object. */
export async function generateJson(opts: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<unknown> {
  const { apiKey, model } = geminiConfig();
  if (!apiKey) throw new GeminiError("GEMINI_API_KEY is not set", 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: opts.maxOutputTokens ?? 400,
          responseMimeType: "application/json",
          responseSchema: opts.schema,
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      // Don't echo Google's error body to the browser; log it server-side only.
      console.error(`Gemini ${res.status}: ${body.slice(0, 500)}`);
      throw new GeminiError(res.status === 429 ? "Gemini quota reached" : "Gemini request failed", res.status === 429 ? 429 : 502);
    }
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const textOut = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    try {
      return JSON.parse(textOut);
    } catch {
      throw new GeminiError("Gemini returned malformed JSON", 502);
    }
  } catch (err) {
    if (err instanceof GeminiError) throw err;
    if ((err as Error).name === "AbortError") throw new GeminiError("Gemini timed out", 504);
    throw new GeminiError("Gemini request failed", 502);
  } finally {
    clearTimeout(timer);
  }
}
