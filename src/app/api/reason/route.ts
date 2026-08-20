import { reasonAboutCheck } from '@/lib/rag/reason';
import { rateLimit, clientKey } from '@/lib/security/ratelimit';
import type { RuleCheck } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// TIER-2 RAG reasoning, streamed as Server-Sent Events. This runs AFTER and
// SEPARATE FROM the fast-path verdict — it enriches but never blocks it. Each
// event carries one grounded, citation-backed justification.
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req));
  if (!rl.allowed) return new Response('rate limited', { status: 429 });

  const body = await req.json();
  const checks: RuleCheck[] = Array.isArray(body.checks) ? body.checks : [];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      send({ type: 'start', count: checks.length });
      for (const check of checks) {
        try {
          const item = await reasonAboutCheck(check);
          send({ type: 'item', item });
        } catch (err) {
          send({ type: 'error', checkId: check.id, message: (err as Error).message });
        }
      }
      send({ type: 'done' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
