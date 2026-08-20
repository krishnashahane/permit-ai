import { CORPUS } from './corpus';
import type { CodeChunk, Citation } from '@/lib/types';

// Lexical retrieval over the embedded corpus (TF-style scoring with a category
// boost). This stands in for pgvector cosine search; the interface — query in,
// ranked CodeChunks out — is identical, so swapping in real embeddings is a
// drop-in change. Grounding rule: every citation returned to the UI comes from
// a chunk actually retrieved here. No retrieval → no citation.

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'or', 'in', 'is', 'for', 'shall', 'not', 'be', 'this', 'that', 'with', 'per', 'than', 'less', 'more']);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export function retrieve(
  query: string,
  opts: { category?: string; k?: number } = {},
): CodeChunk[] {
  const k = opts.k ?? 4;
  const qTokens = tokenize(query);
  const scored = CORPUS.map((chunk) => {
    const hay = tokenize(chunk.title + ' ' + chunk.text + ' ' + chunk.citation);
    const set = new Set(hay);
    let score = 0;
    for (const t of qTokens) if (set.has(t)) score += 1;
    // Weight repeated matches lightly and boost same-category chunks.
    for (const t of qTokens) score += hay.filter((h) => h === t).length * 0.1;
    if (opts.category && chunk.category === opts.category) score += 3;
    return { chunk, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.chunk);
}

export function toCitations(chunks: CodeChunk[]): Citation[] {
  return chunks.map((c) => ({
    citation: c.citation,
    title: c.title,
    chunkId: c.id,
    excerpt: c.text.length > 240 ? c.text.slice(0, 237) + '…' : c.text,
  }));
}
