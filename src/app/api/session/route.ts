import { NextResponse } from 'next/server';
import { signRole, verifyRoleToken, readCookie, accessCodeValid, sessionCookieHeader, clearCookieHeader, SESSION_COOKIE } from '@/lib/auth/session';
import { rateLimit, clientKey } from '@/lib/security/ratelimit';
import type { Role } from '@/lib/types';

export const runtime = 'nodejs';

// GET: report the caller's currently-verified role (from the signed cookie).
export async function GET(req: Request) {
  const role = verifyRoleToken(readCookie(req, SESSION_COOKIE)) ?? 'applicant';
  return NextResponse.json({ role });
}

// POST { role, code? }: assume a role. Applicant is public. Architect and
// official require a valid access code, checked server-side (constant-time).
// On success, an HMAC-signed httpOnly cookie is set — this is the only way to
// obtain a privileged role. Rate-limited to blunt code brute-forcing.
export async function POST(req: Request) {
  const rl = rateLimit('session:' + clientKey(req));
  if (!rl.allowed) return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const role = String(body.role || '').toLowerCase() as Role;
  if (!['applicant', 'architect', 'official'].includes(role)) {
    return NextResponse.json({ error: 'Unknown role.' }, { status: 400 });
  }

  if (role !== 'applicant') {
    if (!accessCodeValid(role, String(body.code || ''))) {
      return NextResponse.json({ error: 'Invalid access code for this role.' }, { status: 401 });
    }
  }

  const res = NextResponse.json({ role });
  res.headers.set('Set-Cookie', sessionCookieHeader(signRole(role)));
  return res;
}

// DELETE: drop back to the public applicant role.
export async function DELETE() {
  const res = NextResponse.json({ role: 'applicant' });
  res.headers.set('Set-Cookie', clearCookieHeader());
  return res;
}
