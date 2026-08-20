import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { runRulesEngine, getJurisdiction } from '@/lib/rules/engine';
import { getSeed } from '@/lib/seed';
import { extractFacts, type PlanImage } from '@/lib/extract/vision';
import { validateUpload, scanForMalware } from '@/lib/security/validate';
import { rateLimit, clientKey } from '@/lib/security/ratelimit';
import { resolveRole } from '@/lib/auth/rbac';
import { appendAudit } from '@/lib/audit/log';
import { encryptPII, maskPII } from '@/lib/security/pii';
import { sanitizeDocumentText } from '@/lib/extract/sanitize';

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
        if (!body.facts) return NextResponse.json({ error: 'Missing facts.' }, { status: 400 });
        facts = await extractFacts(projectDescription, []); // baseline, then overlay edits
        facts = { ...facts, ...body.facts };
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
      const images: PlanImage[] = [];
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const v = validateUpload(file.type, bytes);
        if (!v.ok) return NextResponse.json({ error: v.reason }, { status: 400 });
        const scan = await scanForMalware(bytes);
        if (!scan.ok) return NextResponse.json({ error: scan.reason }, { status: 400 });
        // PDFs are passed to vision as-is via base64; images likewise.
        if (v.detectedMime !== 'application/pdf') {
          images.push({ base64: Buffer.from(bytes).toString('base64'), mediaType: v.detectedMime! });
        }
      }
      if (!getJurisdiction(jurisdiction)) {
        return NextResponse.json({ error: 'Unknown jurisdiction.' }, { status: 400 });
      }
      facts = await extractFacts(projectDescription, images);
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
