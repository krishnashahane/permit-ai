import { NextResponse } from 'next/server';
import { getJurisdiction } from '@/lib/rules/engine';
import { CORPUS } from '@/lib/rag/corpus';

export const runtime = 'nodejs';

// Regulatory source metadata for the "Regulations Used" panel. Everything here
// comes from the project's own rule dataset + embedded code corpus — no
// fabricated versions or sections.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('jurisdiction') || 'springfield';
  const j = getJurisdiction(id);
  if (!j) return NextResponse.json({ error: 'Unknown jurisdiction.' }, { status: 400 });

  return NextResponse.json({
    jurisdiction: j.name,
    version: j.version,
    effectiveDate: j.effectiveDate,
    zones: Object.entries(j.zones).map(([code, z]) => ({ code, description: z.description })),
    sources: CORPUS.map((c) => ({
      citation: c.citation,
      title: c.title,
      category: c.category,
    })),
  });
}
