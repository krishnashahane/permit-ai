import { createHash } from 'crypto';
import type { AuditEntry, Role } from '@/lib/types';

// Append-only, hash-chained audit log. Each entry embeds the hash of the prior
// entry, so any retroactive edit breaks the chain and is detectable. In
// production this maps to an append-only Postgres table (no UPDATE/DELETE
// grants) with the same hash-chain columns.

const chain: AuditEntry[] = [];

function hashEntry(e: Omit<AuditEntry, 'hash'>): string {
  return createHash('sha256')
    .update(JSON.stringify({ seq: e.seq, ts: e.ts, actorRole: e.actorRole, action: e.action, submissionId: e.submissionId, detail: e.detail, prevHash: e.prevHash }))
    .digest('hex');
}

export function appendAudit(
  actorRole: Role,
  action: string,
  submissionId: string,
  detail: Record<string, unknown>,
): AuditEntry {
  const prev = chain[chain.length - 1];
  const partial: Omit<AuditEntry, 'hash'> = {
    seq: chain.length,
    ts: new Date().toISOString(),
    actorRole,
    action,
    submissionId,
    detail,
    prevHash: prev ? prev.hash : 'GENESIS',
  };
  const entry: AuditEntry = { ...partial, hash: hashEntry(partial) };
  chain.push(entry);
  return entry;
}

export function getAuditTrail(submissionId?: string): AuditEntry[] {
  return submissionId ? chain.filter((e) => e.submissionId === submissionId) : [...chain];
}

/** Verify the hash chain is intact (tamper detection). */
export function verifyAuditChain(): { ok: boolean; brokenAt?: number } {
  let prevHash = 'GENESIS';
  for (const e of chain) {
    const expected = hashEntry({ ...e });
    if (e.prevHash !== prevHash || e.hash !== expected) return { ok: false, brokenAt: e.seq };
    prevHash = e.hash;
  }
  return { ok: true };
}
