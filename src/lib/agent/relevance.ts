// Smart-routing relevance gate. Decides whether a free-text query is actually
// about a building-permit compliance assessment BEFORE any retrieval / scan /
// rule-evaluation tool runs. Deterministic (no tokens, no latency): a domain
// lexicon match. Off-topic input (weather, jokes, general chit-chat) short-
// circuits so the expensive pipeline is never invoked on unrelated input.
//
// Pure and dependency-free so it is unit-testable in isolation.

const DOMAIN_TERMS: string[] = [
  'permit', 'building', 'construction', 'plan', 'plans', 'drawing', 'blueprint',
  'zoning', 'zone', 'setback', 'setbacks', 'yard', 'lot', 'parcel', 'frontage',
  'height', 'story', 'stories', 'far', 'floor area', 'floor-area', 'built-up', 'builtup',
  'parking', 'egress', 'exit', 'door', 'corridor', 'fire', 'separation', 'sprinkler',
  'occupancy', 'dwelling', 'variance', 'code', 'compliance', 'comply', 'violation',
  'requirement', 'minimum', 'maximum', 'jurisdiction', 'ordinance', 'ibc', 'irc',
  'ada', 'accessible', 'accessibility', 'ramp', 'assessment', 'inspection', 'submit',
  'submittal', 'ahj', 'district', 'residential', 'commercial', 'r-1', 'r-2', 'c-1',
  'square feet', 'sq ft', 'sqft', 'clearance', 'rating', 'rated', 'elevation', 'site plan',
];

// Obvious off-topic signals that override a stray keyword collision.
const OFF_TOPIC: RegExp[] = [
  /\bweather\b/i, /\bjoke\b/i, /\bpoem\b/i, /\brecipe\b/i, /\bsports?\b/i,
  /\bstock(s)?\b/i, /\bcrypto|bitcoin\b/i, /\bmovie|song|lyrics\b/i,
  /\bwho are you\b/i, /\bwhat can you do\b/i, /\bhello\b|\bhi\b(?!gh)/i,
];

export interface RelevanceResult {
  relevant: boolean;
  reason: string;
}

/**
 * @param text            the user's free-text query
 * @param hasCheckContext true when the query is attached to a specific
 *                        assessment item (a flagged rule) — always relevant.
 */
export function classifyRelevance(text: string, hasCheckContext = false): RelevanceResult {
  if (hasCheckContext) return { relevant: true, reason: 'about a specific assessment item' };
  const t = (text || '').toLowerCase().trim();
  if (!t) return { relevant: false, reason: 'empty query' };

  const domainHits = DOMAIN_TERMS.filter((term) => t.includes(term));
  const offTopic = OFF_TOPIC.some((rx) => rx.test(t));

  // Off-topic phrasing with no real domain content → not relevant.
  if (offTopic && domainHits.length === 0) {
    return { relevant: false, reason: 'off-topic (no building/permit terms)' };
  }
  if (domainHits.length === 0) {
    return { relevant: false, reason: 'no building/permit terms detected' };
  }
  return { relevant: true, reason: `matched: ${domainHits.slice(0, 4).join(', ')}` };
}

/**
 * Router: only invoke the retrieval/scan pipeline when the query is relevant.
 * `tools.retrieve` is the (potentially expensive) pipeline entry point. Returns
 * whether the pipeline ran, so callers/tests can assert routing behavior.
 */
export function routeQuery<T>(
  text: string,
  hasCheckContext: boolean,
  tools: { retrieve: () => T },
): { ran: boolean; result: T | null; reason: string } {
  const rel = classifyRelevance(text, hasCheckContext);
  if (!rel.relevant) return { ran: false, result: null, reason: rel.reason };
  return { ran: true, result: tools.retrieve(), reason: rel.reason };
}
