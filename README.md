# Permit AI

Permit AI is an advisory building-permit pre-check application. It accepts building plan sheets (PDF/PNG/JPG), evaluates a deterministic jurisdiction ruleset, and can optionally use an LLM to extract plan facts and provide citation-grounded explanations.

> Not a permit, approval, or legal determination. The Authority Having Jurisdiction (AHJ) is the final decision-maker. Permit AI never submits applications to a municipal system.

## Architecture

Permit AI has two paths:

1. **Deterministic assessment** — validated inputs are passed to a pure rules engine. The readiness score and numeric compliance checks do not depend on an LLM.
2. **Optional AI reasoning/extraction** — Gemini or an AI Gateway model can extract facts from uploaded plans and explain violations using the embedded regulatory corpus. AI output never changes the deterministic rule decision.

## Quick start

Requirements:

- Node.js 20.9+
- npm

Install dependencies:

```bash
npm install
```

Run the tests:

```bash
npm test
```

Start development:

```bash
npm run dev
```

Open `http://localhost:3000`.

Production:

```bash
npm run build
npm start
```

Next.js 16.4.0 is the current stable release and the project is on the supported 16.x Active LTS line.

## Demo mode

The seeded sample projects work without an AI key:

- `clean-pass` — zero deterministic violations.
- `six-violations` — six deterministic violations.
- `edge-case` — values exactly on deterministic thresholds.

Uploaded documents are different: real plan extraction requires a configured multimodal model such as Gemini.

## Environment

Copy the template:

```bash
cp .env.example .env.local
```

For production, configure at least:

```env
AUTH_SECRET=<long-random-secret>
ARCHITECT_ACCESS_CODE=<strong-secret>
OFFICIAL_ACCESS_CODE=<strong-secret>
PII_ENCRYPTION_KEY=<32-byte-base64-key>
```

Add `GEMINI_API_KEY` when real plan extraction and AI reasoning are required.

The privileged architect/official roles do not have built-in demo passwords. They fail closed when their access codes are unset.

## Upload limits

The upload endpoint accepts up to five PDF/PNG/JPG files, but the total request is capped at 3 MiB. This stays below Vercel's documented 4.5 MB serverless request-body limit.

Each file is magic-number validated, checked against its declared MIME type, rejected if it matches known executable/archive signatures, and scanned for the EICAR test signature before model processing.

For larger plan sets, split the sheets into multiple assessments or deploy behind infrastructure that supports larger request bodies.

## Security controls

- Production requires an explicit `AUTH_SECRET`.
- Privileged role access codes have no insecure defaults.
- Role sessions are HMAC-signed, `HttpOnly`, `SameSite=Strict`, and expire after 8 hours.
- Rate limiting does not trust `X-Forwarded-For` / `X-Real-IP` unless `TRUST_PROXY=true`.
- PII encryption fails closed in production if `PII_ENCRYPTION_KEY` is missing.
- Uploaded files are validated by content signature, not only browser-provided MIME type.
- Prompt-injection patterns are stripped from untrusted document text before LLM context construction.
- Assessment PDF exports are HMAC-verified so a client cannot modify a verdict and export it as if it came from the rules engine.
- Security response headers and HSTS are enabled for production.
- Committed build/server log artifacts were removed.

## API

The Next.js route handlers include:

```text
POST /api/analyze
POST /api/reason
POST /api/chat
POST /api/report
POST /api/session
GET  /api/session
DELETE /api/session
GET  /api/audit
GET  /api/meta
GET  /api/regulations
```

The application is designed for a single Next.js deployment, including Vercel.

## Testing

The test command uses `tsx` so the TypeScript routing test executes correctly:

```bash
npm test
```

The test suite covers the deterministic rules contract and permit-topic query routing.

## Project structure

```text
permit-ai/
├── src/app/             # Next.js pages and route handlers
├── src/components/      # Assessment UI and result/report UX
├── src/lib/rules/       # Deterministic jurisdiction rules
├── src/lib/rag/         # Regulatory corpus and grounded retrieval
├── src/lib/extract/     # Document sanitization and vision extraction
├── src/lib/security/    # Upload, PII, rate-limit, and signing controls
├── src/lib/auth/        # HMAC role sessions and RBAC
├── src/seed/            # Deterministic sample submissions
├── tests/               # Rules and router tests
├── ARCHITECTURE.md
├── next.config.mjs
├── package.json
└── README.md
```

## Important production notes

The audit log and rate limiter are process-local. They are suitable for the demo and single-instance development, but they are not durable distributed infrastructure. A multi-instance deployment should replace them with durable storage and a shared rate limiter.

There is no persistent database in this repository. PII is encrypted while handled by the application, but it is not being written to a durable encrypted database here.

## License

MIT
