// Thin LLM wrapper. Priority: (1) Google Gemini via a direct API key
// (GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY) — capable multimodal models
// for plan extraction + reasoning; (2) Vercel AI Gateway via a plain
// "provider/model" string (OIDC on Vercel, or AI_GATEWAY_API_KEY); (3) demo-off
// fallback so callers use deterministic grounded output. No key is ever required
// for the app to produce a verdict.

type ModelSpec =
  | { kind: 'gemini'; model: string }
  | { kind: 'gateway'; model: string }
  | null;

function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

export function aiEnabled(): boolean {
  return resolveModel() !== null;
}

/** Which backend + model to use, honoring PERMIT_AI_MODEL when set. */
export function resolveModel(): ModelSpec {
  const override = process.env.PERMIT_AI_MODEL;
  if (geminiKey()) {
    // Default to a strong, fast multimodal Gemini model with a generous free tier.
    const model = override && !override.includes('/') ? override : override?.startsWith('google/') ? override.slice(7) : 'gemini-2.5-flash';
    return { kind: 'gemini', model };
  }
  if (process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL) {
    return { kind: 'gateway', model: override && override.includes('/') ? override : 'anthropic/claude-3-haiku' };
  }
  return null;
}

export function modelLabel(): string {
  const m = resolveModel();
  return m ? (m.kind === 'gemini' ? `google/${m.model}` : m.model) : 'rules-only';
}

async function buildModel(spec: NonNullable<ModelSpec>) {
  if (spec.kind === 'gemini') {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    const google = createGoogleGenerativeAI({ apiKey: geminiKey()! });
    return google(spec.model);
  }
  return spec.model; // gateway: plain provider/model string
}

export interface VisionPart {
  type: 'image';
  image: string; // base64 (no data: prefix needed) or data URL
  mediaType: string;
}
type TextPart = { type: 'text'; text: string };
type Part = TextPart | VisionPart;

/** generateText wrapper. Returns null when AI is unavailable or on any error. */
export async function complete(
  system: string,
  parts: Part[],
  opts: { maxTokens?: number } = {},
): Promise<string | null> {
  const spec = resolveModel();
  if (!spec) return null;
  try {
    const { generateText } = await import('ai');
    const model = await buildModel(spec);
    const content = parts.map((p) =>
      p.type === 'text'
        ? { type: 'text' as const, text: p.text }
        : { type: 'image' as const, image: p.image, mediaType: p.mediaType },
    );
    const res = await generateText({
      model: model as never,
      system,
      messages: [{ role: 'user', content: content as never }],
      maxOutputTokens: opts.maxTokens ?? 1200,
    });
    return res.text;
  } catch (err) {
    console.error('[permit-ai] LLM complete failed:', (err as Error).message);
    return null;
  }
}

/** streamText wrapper yielding text deltas. Yields nothing when unavailable. */
export async function* stream(
  system: string,
  prompt: string,
  opts: { maxTokens?: number } = {},
): AsyncGenerator<string> {
  const spec = resolveModel();
  if (!spec) return;
  try {
    const { streamText } = await import('ai');
    const model = await buildModel(spec);
    const res = streamText({
      model: model as never,
      system,
      prompt,
      maxOutputTokens: opts.maxTokens ?? 1400,
    });
    for await (const delta of res.textStream) yield delta;
  } catch (err) {
    console.error('[permit-ai] LLM stream failed:', (err as Error).message);
  }
}
