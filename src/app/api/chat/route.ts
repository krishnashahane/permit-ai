import { NextResponse } from 'next/server';
import { retrieve, toCitations } from '@/lib/rag/retrieve';
import { aiEnabled, complete } from '@/lib/llm/client';
import { sanitizeDocumentText } from '@/lib/extract/sanitize';
import { rateLimit, clientKey } from '@/lib/security/ratelimit';
import { classifyRelevance } from '@/lib/agent/relevance';
import type { RuleCheck } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

// "Ask why" — grounded ONLY in retrieved code chunks. If nothing relevant is
// retrieved, the endpoint refuses to answer rather than hallucinate. Every
// answer ships with the exact citations it is grounded in.
const CHAT_SYSTEM =
  'You are a permit code-compliance assistant. Answer the user question using ONLY the ' +
  'provided code excerpts. Every claim must be supported by an excerpt and cite its section. ' +
  'If the excerpts do not cover the question, reply exactly: "I can\'t answer that from the ' +
  'retrieved code sections." Never invent citations, numbers, or requirements.';

export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req));
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limited.' }, { status: 429 });

  const body = await req.json();
  const question = sanitizeDocumentText(String(body.question || '')).clean.slice(0, 500);
  const check: RuleCheck | undefined = body.check;
  if (!question) return NextResponse.json({ error: 'Empty question.' }, { status: 400 });

  // SMART ROUTING (server-enforced): only run the retrieval pipeline when the
  // query is actually about a building-permit assessment. Off-topic input is
  // answered conversationally with NO retrieval, scan, or rule evaluation.
  const relevance = classifyRelevance(question, Boolean(check));
  if (!relevance.relevant) {
    return NextResponse.json({
      answer: "I'm the PermitAI compliance assistant — I can only help with building-permit topics like zoning, setbacks, height, FAR, parking, egress, fire separation, or this assessment's findings. Ask me one of those and I'll cite the exact code.",
      citations: [],
      grounded: true,
      offTopic: true,
      routed: relevance.reason,
    });
  }

  const query = check ? `${check.label} ${check.category} ${question}` : question;
  const chunks = retrieve(query, { category: check?.category, k: 4 });
  const citations = toCitations(chunks);

  if (chunks.length === 0) {
    return NextResponse.json({
      answer: "I can't answer that from the retrieved code sections.",
      citations: [],
      grounded: true,
    });
  }

  const excerpts = chunks.map((c) => `[${c.citation}] ${c.title}: ${c.text}`).join('\n\n');
  let answer: string;
  if (aiEnabled()) {
    const context = check
      ? `CONTEXT ITEM: ${check.label} — measured ${check.measured}, required ${check.required} (${check.codeSection}).\n\n`
      : '';
    answer =
      (await complete(
        CHAT_SYSTEM,
        [{ type: 'text', text: `${context}CODE EXCERPTS:\n${excerpts}\n\nQUESTION: ${question}` }],
        { maxTokens: 400 },
      ))?.trim() || fallbackAnswer(chunks);
  } else {
    answer = fallbackAnswer(chunks);
  }

  return NextResponse.json({ answer, citations, grounded: true });
}

function fallbackAnswer(chunks: { citation: string; text: string }[]): string {
  const top = chunks[0];
  return `Per ${top.citation}: ${top.text}`;
}
