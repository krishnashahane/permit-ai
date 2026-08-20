import type { Role } from '@/lib/types';

// Role-based access control. Demo auth reads a role header/cookie; a real
// deployment swaps `resolveRole` for a session/JWT check (Clerk, Auth0, etc.).

export const ROLES: Role[] = ['applicant', 'architect', 'official'];

export interface Capabilities {
  canUpload: boolean;
  canViewVerdict: boolean;
  canViewInternalFacts: boolean; // raw extracted facts + audit trail
  canViewPII: boolean;           // decrypted owner/address
  canExportReport: boolean;
  canOverride: boolean;          // mark items reviewed — officials only
}

const MATRIX: Record<Role, Capabilities> = {
  applicant: {
    canUpload: true,
    canViewVerdict: true,
    canViewInternalFacts: false,
    canViewPII: true, // own submission only (enforced at data layer)
    canExportReport: true,
    canOverride: false,
  },
  architect: {
    canUpload: true,
    canViewVerdict: true,
    canViewInternalFacts: true,
    canViewPII: false,
    canExportReport: true,
    canOverride: false,
  },
  official: {
    canUpload: false,
    canViewVerdict: true,
    canViewInternalFacts: true,
    canViewPII: true,
    canExportReport: true,
    canOverride: true,
  },
};

export function capabilitiesFor(role: Role): Capabilities {
  return MATRIX[role] ?? MATRIX.applicant;
}

export function resolveRole(req: Request): Role {
  const raw = (req.headers.get('x-permit-role') || '').toLowerCase();
  return (ROLES as string[]).includes(raw) ? (raw as Role) : 'applicant';
}
