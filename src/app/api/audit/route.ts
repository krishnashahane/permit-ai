import { NextResponse } from 'next/server';
import { getAuditTrail, verifyAuditChain } from '@/lib/audit/log';
import { resolveRole, capabilitiesFor } from '@/lib/auth/rbac';

export const runtime = 'nodejs';

// Audit trail is visible to roles with internal-facts access (architect,
// official). Applicants do not see the raw immutable log.
export async function GET(req: Request) {
  const role = resolveRole(req);
  if (!capabilitiesFor(role).canViewInternalFacts) {
    return NextResponse.json({ error: 'Forbidden for this role.' }, { status: 403 });
  }
  const url = new URL(req.url);
  const submissionId = url.searchParams.get('submissionId') || undefined;
  return NextResponse.json({
    entries: getAuditTrail(submissionId),
    integrity: verifyAuditChain(),
  });
}
