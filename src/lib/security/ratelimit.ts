// In-memory fixed-window rate limiter. In production this is backed by Redis
// (the same fast-path cache used for rules lookups); the interface is identical
// so swapping the store is a one-line change.

const WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function limit(): number {
  const n = Number(process.env.RATE_LIMIT_PER_MINUTE);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

export interface RateResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string): RateResult {
  const now = Date.now();
  const max = limit();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: max - 1, resetAt: now + WINDOW_MS };
  }
  if (b.count >= max) return { allowed: false, remaining: 0, resetAt: b.resetAt };
  b.count += 1;
  return { allowed: true, remaining: max - b.count, resetAt: b.resetAt };
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'local').slice(0, 64);
}
