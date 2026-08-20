import type { RuleCheck, Verdict, Citation } from '@/lib/types';
import { retrieve, toCitations } from './retrieve';
import { aiEnabled, complete } from '@/lib/llm/client';

// Tier-2 reasoning. For each flagged/review item, retrieve the governing code
// chunks and produce a natural-language justification GROUNDED IN THOSE CHUNKS.
// Grounding contract: the model may only cite citations we retrieved; anything
// else is dropped. When AI is disabled, a templated justification is built
// directly from the retrieved chunk text (still fully grounded, no invention).

export interface ReasonedItem {
  checkId: string;
  label: string;
  justification: string;
  citations: Citation[];
  grounded: boolean;
}

function queryFor(check: RuleCheck): string {
  return `${check.label} ${check.category} requirement ${check.measured} vs ${check.required} ${check.codeSection}`;
}

const REASON_SYSTEM =
  'You are a code-compliance analyst. Using ONLY the provided code excerpts, explain in 2-3 ' +
  'plain-English sentences why the item passes, fails, or needs review, and what specifically ' +
  'the applicant must change. Cite code sections that appear in the excerpts. Do NOT invent ' +
  'citations or requirements not present in the excerpts. If the excerpts are insufficient, ' +
  'say so.';

export async function reasonAboutCheck(check: RuleCheck): Promise<ReasonedItem> {
  const chunks = retrieve(queryFor(check), { category: check.category, k: 3 });
  const citations = toCitations(chunks);
  const allowed = new Set(chunks.map((c) => c.citation));

  let justification: string;
  if (aiEnabled() && chunks.length > 0) {
    const excerpts = chunks.map((c) => `[${c.citation}] ${c.title}: ${c.text}`).join('\n\n');
    const out = await complete(
      REASON_SYSTEM,
      [
        {
          type: 'text',
          text:
            `ITEM: ${check.label} (${check.status.toUpperCase()})\n` +
            `Measured: ${check.measured} | Required: ${check.required}\n\n` +
            `CODE EXCERPTS:\n${excerpts}`,
        },
      ],
      { maxTokens: 320 },
    );
    justification = out?.trim() || templated(check, chunks);
  } else {
    justification = templated(check, chunks);
  }

  // Enforce grounding: keep only citations we actually retrieved.
  const grounded = citations.every((c) => allowed.has(c.citation));
  return {
    checkId: check.id,
    label: check.label,
    justification,
    citations: citations.filter((c) => allowed.has(c.citation)),
    grounded,
  };
}

function templated(check: RuleCheck, chunks: { citation: string; text: string }[]): string {
  if (chunks.length === 0) {
    return `No code excerpt was retrieved for "${check.label}", so no grounded citation can be provided. Measured ${check.measured} against required ${check.required} (${check.codeSection}).`;
  }
  const lead = chunks[0];
  const verb =
    check.status === 'fail'
      ? `does not meet the standard (measured ${check.measured}, required ${check.required})`
      : check.status === 'review'
        ? 'requires qualitative review against the standard'
        : `meets the standard (measured ${check.measured}, required ${check.required})`;
  const first = lead.text.split('. ')[0];
  return `Per ${lead.citation}, ${first.charAt(0).toLowerCase()}${first.slice(1)}. This item ${verb}.`;
}

export async function reasonAboutVerdict(verdict: Verdict): Promise<ReasonedItem[]> {
  const targets = [...verdict.violations, ...verdict.reviewItems];
  return Promise.all(targets.map(reasonAboutCheck));
}
