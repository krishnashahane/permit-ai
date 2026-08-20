# Permit AI — Architecture (1-page)

## The core idea: two tiers, one never blocks the other

```
                         ┌─────────────────────────────────────────┐
   Upload (PDF/PNG/JPG)  │              FAST PATH  (< 10s)          │
   + jurisdiction        │                                         │
   + project form        │  1. validate file  ── magic-number +    │
        │                │     size + mock virus scan              │
        ▼                │  2. sanitize text  ── strip injection   │
  ┌───────────┐          │  3. extract facts  ── Claude vision →   │
  │  /analyze │─────────▶│     structured JSON (demo fallback)     │
  └───────────┘          │  4. RULES ENGINE   ── pure, deterministic│
        │                │     numeric thresholds per jurisdiction │
        │                │  5. VERDICT        ── PASS/FAIL + score  │
        │                └──────────────────┬──────────────────────┘
        │                                   │  returns immediately
        ▼                                   ▼
  ┌───────────┐          ┌─────────────────────────────────────────┐
  │  /reason  │  (SSE)   │        RAG PATH  (parallel, streamed)    │
  │  stream   │─────────▶│                                         │
  └───────────┘          │  for each violation / review item:      │
        │                │   • retrieve code chunks (pgvector-      │
        │                │     shaped lexical search over corpus)  │
        │                │   • Claude writes a justification        │
        │                │     GROUNDED ONLY in retrieved chunks    │
        │                │   • emit {justification, citations[]}    │
        ▼                └─────────────────────────────────────────┘
   enriches the cards already on screen — never delays the verdict
```

## Why the split

- **Determinism where it matters.** Whether a rear setback of 4 ft violates an
  8 ft minimum is arithmetic, not a language task. Tier 1 is a pure function
  (`src/lib/rules/engine.ts`) — no I/O, sub-millisecond, auditable, reproducible.
  The only non-deterministic step in the fast path is *reading* the plan
  (vision extraction); the *judging* is deterministic.
- **Language where it helps.** Explaining *why* a rule exists, handling
  qualitative rules (accessible route, design review, material standards), and
  answering "ask why" is where the LLM adds value. That work is slower and is
  therefore streamed in **after** the verdict via Server-Sent Events, so it can
  never make the applicant wait past the 10-second promise.

## Grounding contract (no citation, no claim)

The reasoning layer and the "Ask why" chat may only cite code sections that were
actually retrieved for that query (`src/lib/rag/retrieve.ts` → `reason.ts` /
`api/chat`). Retrieved citations are held in an allow-set; any citation the model
emits that is not in the set is dropped, and if nothing is retrieved the endpoint
refuses to answer. This is what makes the tool safe for a government-adjacent
audit.

## Fast-path cache (Redis)

Rules-table lookups and the per-IP rate limiter share the same key/value shape
(`src/lib/security/ratelimit.ts`). In-memory in this demo; the interface is a
drop-in for Redis so the hot path stays hot under load.

## Data & trust boundaries

| Concern              | Where                                   |
|----------------------|-----------------------------------------|
| Untrusted input      | `extract/sanitize.ts` — strip/wrap before any LLM context |
| File safety          | `security/validate.ts` — magic-number + size + virus gate |
| PII at rest          | `security/pii.ts` — AES-256-GCM, masked in logs, never to analytics/training |
| Immutable audit      | `audit/log.ts` — append-only, SHA-256 hash-chained |
| RBAC                 | `auth/rbac.ts` — applicant / architect / official capability matrix |
| Advisory disclaimer  | UI banner + stamped into every PDF export |

## Stack as shipped vs. as specified

The brief specifies Next.js frontend + a separate FastAPI backend + Postgres/
pgvector + Redis. To ship a **single deploy-ready unit on Vercel**, the backend
is implemented as Next.js Route Handlers (Node runtime, Fluid Compute) that
mirror the FastAPI contract 1:1. Every seam that would be an external service in
production — pgvector retrieval, the Redis cache, pgcrypto PII columns, the
append-only audit table — is behind a small interface here, so swapping the
in-process implementation for the managed service is local and mechanical. See
the README "Production swap-in" table.
