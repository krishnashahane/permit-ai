import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import type { Role } from '@/lib/types';

// Server-signed role sessions. A role is only granted through an HMAC-signed,
// httpOnly cookie issued by /api/session. Privileged roles (architect, official)
// additionally require an access code verified server-side. The client can no
// longer grant itself a role by setting a header or local state — the signature
// is the authority. This is the enforcement boundary; swap the access-code check
// for real SSO/JWT without touching call sites.

export const SESSION_COOKIE = 'permit_session';
const TTL_SECONDS = 8 * 60 * 60; // 8h

function secret(): string {
  return process.env.AUTH_SECRET || 'permit-ai-dev-secret-change-me';
}

function b64url(b: Buffer): string {
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payload: string): string {
  return b64url(createHmac('sha256', secret()).update(payload).digest());
}

/** Mint a signed token for a role. */
export function signRole(role: Role): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const nonce = b64url(randomBytes(6));
  const payload = `${role}.${exp}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

/** Verify a token; returns the role only if the signature and expiry are valid. */
export function verifyRoleToken(token: string | undefined | null): Role | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [role, expStr, nonce, sig] = parts;
  const expected = sign(`${role}.${expStr}.${nonce}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  if (role !== 'applicant' && role !== 'architect' && role !== 'official') return null;
  return role as Role;
}

/** Parse a single cookie value from a Cookie header. */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Constant-time access-code check for a privileged role. */
export function accessCodeValid(role: Role, code: string): boolean {
  const expected =
    role === 'official' ? (process.env.OFFICIAL_ACCESS_CODE || 'demo-official')
    : role === 'architect' ? (process.env.ARCHITECT_ACCESS_CODE || 'demo-architect')
    : '';
  if (!expected) return false;
  const a = Buffer.from(String(code));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${TTL_SECONDS}`;
}

export function clearCookieHeader(): string {
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=0`;
}
