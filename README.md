# Permit AI

**An advisory AI pre-check for building permit applications.** Upload plan sheets
(PDF/PNG/JPG), pick a jurisdiction, and get a **PASS / FAIL verdict with a 0–100
readiness score in seconds** — plus the exact code sections you're violating, the
measured-vs-required numbers, a plain-English fix, and estimated cost/time impact.

> **Advisory only.** Permit AI is a preliminary self-assessment. It is **not** the
> final permit authority, it never submits anything to a municipal system, and it
> makes no auto-actions. Only the authority having jurisdiction (AHJ) can approve a
> permit. This disclaimer appears in the UI and is stamped into every PDF export.

## Two-tier speed architecture

1. **Fast path (< 10s, deterministic).** Validate & virus-scan the upload →
   sanitize document text (prompt-injection defense) → extract structured facts
   with Claude vision → run a **pure, deterministic rules engine** of numeric
   thresholds per jurisdiction → return an instant verdict. The judging math has
   no LLM in the loop.
2. **RAG reasoning path (parallel, streamed).** For each violation and each
   qualitative item, retrieve governing code sections and have Claude write a
   justification **grounded only in retrieved chunks**, streamed in over SSE. It
   enriches the verdict but **never blocks** the 10-second response.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the diagram.

## Quick start

```bash
npm install
npm run test      # rules-engine contract tests (4 pass, no deps)
npm run dev       # http://localhost:3000
```

Runs fully in **demo mode with zero configuration** (deterministic extraction +
templated, still-grounded citations). Add a key to light up real Claude vision +
RAG:

```bash
cp .env.example .env.local
# set AI_GATEWAY_API_KEY (preferred on Vercel) or ANTHROPIC_API_KEY
```

## Try it

- **Seeded examples** (buttons on the landing page, no upload needed):
  - `clean-pass` → **READY TO SUBMIT** (0 violations)
  - `six-violations` → **NOT YET** with **exactly 6** ranked violation cards
  - `edge-case` → every dimension exactly on the code limit; numeric checks pass
    at the boundary and the decision shifts to the qualitative reasoning layer
- **Role switcher** (top-right): `applicant` / `architect` / `official` change what
  is visible (raw extracted facts and the audit trail are gated to non-applicants).
- **Ask why** on any card → grounded chat that refuses to answer without a citation.
- **Export fix report (PDF)** → hand-off document for the architect, disclaimer stamped in.

## Security & trust

| Control | Implementation |
|---|---|
| Advisory-only, no auto-submit | UI banner + PDF stamp; no municipal-system integration exists |
| RBAC | `src/lib/auth/rbac.ts` — capability matrix per role |
| Immutable audit trail | `src/lib/audit/log.ts` — append-only, SHA-256 hash-chained, tamper-detectable |
| PII at rest | `src/lib/security/pii.ts` — AES-256-GCM; masked in logs; never sent to analytics or used for training |
| Prompt-injection defense | `src/lib/extract/sanitize.ts` — strips instruction-like text, wraps plan text as untrusted data |
| Upload safety | `src/lib/security/validate.ts` — magic-number sniff + size cap + mock virus (EICAR) gate |
| Rate limiting | `src/lib/security/ratelimit.ts` — per-IP fixed window (Redis-shaped) |
| Grounded citations | retrieval allow-set; no citation → claim dropped; chat refuses ungrounded |
| Security headers | strict CSP, HSTS, nosniff, frame-deny in `next.config.mjs` |

## Deliverables map

- Rules engine + jurisdiction table → `src/lib/rules/`
- RAG corpus + retrieval + grounded reasoning → `src/lib/rag/`
- Seed jurisdiction (City of Springfield) → `src/lib/rules/jurisdictions/springfield.json`
- 3 example submissions → `src/seed/submissions/`
- API (fast path, reasoning SSE, grounded chat, PDF, audit, meta) → `src/app/api/`
- UI (intake, scanning animation, verdict, violation cards, ask-why, diff) → `src/components/`

## Production swap-in

Every external seam is behind a small interface, so moving from the in-process
demo to managed services is mechanical:

| Demo (in-process) | Production |
|---|---|
| Lexical retrieval over corpus array | Postgres + **pgvector** cosine search |
| In-memory rate-limit / cache | **Redis** (Upstash on Vercel Marketplace) |
| In-memory hash-chained audit array | Append-only Postgres table (no UPDATE/DELETE grant) |
| AES-GCM in `pii.ts` | **pgcrypto** columns / KMS |
| Next.js Route Handlers | Same handlers, or lift to standalone **FastAPI** (contract is 1:1) |

## Deploy

Single Vercel project (frontend + API in one Next.js app). Push to a Git repo,
import to Vercel, add `AI_GATEWAY_API_KEY` (optional — demo mode works without),
deploy. Node runtime / Fluid Compute; SSE streaming works with zero config.
