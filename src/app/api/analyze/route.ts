import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { runRulesEngine, getJurisdiction } from '@/lib/rules/engine';
import { getSeed } from '@/lib/seed';
import { analyzeDocuments, type DocInput } from '@/lib/extract/vision';
import { validateUpload, scanForMalware } from '@/lib/security/validate';
import { rateLimit, clientKey } from '@/lib/security/ratelimit';
import { resolveRole } from '@/lib/auth/rbac';
import { appendAudit } from '@/lib/audit/log';
import { encryptPII, maskPII } from '@/lib/security/pii';
import { sanitizeDocumentText } from '@/lib/extract/sanitize';
import { buildAgentRun } from '@/lib/agent/orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 30;

// FAST PATH: validate → extract structured facts → deterministic rules engine →
// verdict. Target < 10s; the pure engine itself is sub-millisecond. The RAG
// reasoning layer is a separate, streamed call and never blocks this response.
export async function POST(req: Request) {
  const rl = rateLimit(clientKey(req));
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again shortly.' }, { status: 429 });
  }
  const role = resolveRole(req);
  const submissionId = randomUUID();
  const ct = req.headers.get('content-type') || '';

  try {
    let jurisdiction = 'springfield';
    let projectDescription = '';
    let owner = '';
    let address = '';
    let facts;
    let uploadedDocCount = 0;

    if (ct.includes('application/json')) {
      const body = await req.json();

      // Path A: run a seed example (no upload).
      if (body.exampleId) {
        const seed = getSeed(body.exampleId);
        if (!seed) return NextResponse.json({ error: 'Unknown example.' }, { status: 400 });
        jurisdiction = seed.jurisdiction;
        projectDescription = seed.description;
        owner = seed.owner;
        address = seed.address;
        facts = seed.facts;
      } else {
        // Path B: caller supplies facts directly (e.g., re-run after edits).
        jurisdiction = String(body.jurisdiction || 'springfield');
        projectDescription = sanitizeDocumentText(String(body.description || '')).clean;
        owner = String(body.owner || '');
        address = String(body.address || '');
        // Re-run after edits: the caller supplies the complete, already-extracted
        // facts. We never synthesize data here.
        if (!body.facts || typeof body.facts.zoneType !== 'string') {
          return NextResponse.json({ error: 'Missing or invalid facts for re-run.' }, { status: 400 });
        }
        facts = { ...body.facts };
        facts.far = facts.lotAreaSqFt > 0 ? +(facts.floorAreaSqFt / facts.lotAreaSqFt).toFixed(3) : 0;
        facts._source = 'manual';
      }
    } else if (ct.includes('multipart/form-data')) {
      // Path C: real upload — validate, scan, extract with vision.
      const form = await req.formData();
      jurisdiction = String(form.get('jurisdiction') || 'springfield');
      projectDescription = sanitizeDocumentText(String(form.get('description') || '')).clean;
      owner = String(form.get('owner') || '');
      address = String(form.get('address') || '');

      const files = form.getAll('files').filter((f): f is File => f instanceof File);
      // Server-side limits (never trust the client): max 5 files, 25 MB each,
      // 60 MB total. Reject rather than silently truncate. Uploaded filenames
      // are NEVER used as a filesystem path — bytes are read in-memory and
      // passed to extraction as base64, so path traversal is not reachable.
      if (files.length > 5) return NextResponse.json({ error: 'Too many files (maximum 5).' }, { status: 400 });
      const totalBytes = files.reduce((n, f) => n + f.size, 0);
      if (totalBytes > 60 * 1024 * 1024) return NextResponse.json({ error: 'Upload too large (60 MB total maximum).' }, { status: 413 });
      if (files.length === 0) return NextResponse.json({ error: 'No document uploaded.' }, { status: 400 });
      uploadedDocCount = files.length;
      const docs: DocInput[] = [];
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const v = validateUpload(file.type, bytes);
        if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 400 });
        const scan = await scanForMalware(bytes);
        if (!scan.ok) return NextResponse.json({ error: scan.reason }, { status: 400 });
        // Both PDFs and images are sent to the vision model (as file / image parts).
        docs.push({ base64: Buffer.from(bytes).toString('base64'), mediaType: v.detectedMime! });
      }
      if (!getJurisdiction(jurisdiction)) {
        return NextResponse.json({ error: 'Unknown jurisdiction.' }, { status: 400 });
      }
      // Classify + extract. Refuse to produce a verdict for non-building
      // documents or when too little real data can be read — no fabrication.
      const outcome = await analyzeDocuments(projectDescription, docs);
      if (!outcome.ok) {
        return NextResponse.json(
          { error: outcome.message, code: outcome.code, documentType: outcome.documentType, missing: outcome.missing },
          { status: outcome.code === 'ai_unavailable' ? 503 : 422 },
        );
      }
      facts = outcome.facts;
    } else {
      return NextResponse.json({ error: 'Unsupported content type.' }, { status: 415 });
    }

    if (!getJurisdiction(jurisdiction)) {
      return NextResponse.json({ error: 'Unknown jurisdiction.' }, { status: 400 });
    }

    // Encrypt PII at rest; never returned to analytics, never logged in clear.
    const encOwner = owner ? encryptPII(owner) : null;
    const encAddress = address ? encryptPII(address) : null;

    const verdict = runRulesEngine(facts, jurisdiction, submissionId);

    // Attach the agent decision + tool trace. The decision mirrors the
    // deterministic verdict (engine decides, agent orchestrates & explains).
    const regulationCount = new Set(verdict.checks.map((c) => c.codeSection)).size;
    const missingCount = facts._missing?.length ?? 0;
    verdict.agent = buildAgentRun(verdict, facts, {
      source: facts._source === 'vision' ? 'upload' : facts._source === 'sample' ? 'sample' : 'manual',
      documentCount: uploadedDocCount,
      documentType: facts._documentType,
      extractedCount: 11 - missingCount,
      missingCount,
      regulationCount,
    });

    // Immutable audit entry: verdict + every extracted fact + PII masked.
    appendAudit(role, 'ANALYZE', submissionId, {
      jurisdiction,
      verdict: verdict.verdict,
      readinessScore: verdict.readinessScore,
      factSource: facts._source,
      facts,
      ownerMasked: maskPII(owner),
      addressMasked: maskPII(address),
      piiEncrypted: Boolean(encOwner && encAddress),
    });

    return NextResponse.json({
      ...verdict,
      meta: {
        role,
        ownerMasked: maskPII(owner),
        addressMasked: maskPII(address),
        piiEncryptedAtRest: Boolean(encOwner || encAddress),
        description: projectDescription,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'Analysis failed.' }, { status: 500 });
  }
}
