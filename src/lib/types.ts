// Shared domain types for Permit AI.

export type Role = 'applicant' | 'architect' | 'official';

export type ProjectType =
  | 'single_family'
  | 'multi_family'
  | 'commercial'
  | 'mixed_use'
  | 'accessory';

/**
 * Structured facts extracted from a permit submission. These are DATA, never
 * instructions — extracted plan text is sanitized before it ever reaches an
 * LLM context (see lib/extract/sanitize.ts).
 */
export interface ExtractedFacts {
  zoneType: string;               // e.g. "R-2"
  projectType: ProjectType;
  lotAreaSqFt: number;
  lotWidthFt: number;
  buildingHeightFt: number;
  stories: number;
  frontSetbackFt: number;
  rearSetbackFt: number;
  sideSetbackFt: number;
  floorAreaSqFt: number;          // gross building floor area
  far: number;                    // floor area ratio = floorArea / lotArea
  parkingSpaces: number;
  dwellingUnits: number;
  occupancyType: string;          // IBC occupancy classification, e.g. "R-3"
  egressWidthIn: number;          // clear egress width in inches
  fireSeparationDistanceFt: number;
  accessibleRoute: boolean | null; // qualitative — may be null / for RAG review
  _source: 'baseline' | 'vision' | 'manual' | 'sample';
  _notes?: string;
  // Per-parameter provenance. Present on SAMPLE projects and on real vision
  // extraction; absent on baseline. Never fabricated for real uploads.
  _meta?: Partial<Record<keyof ExtractedFactsNumeric, ParamMeta>>;
}

export interface ParamMeta {
  sourceSheet?: string;   // e.g. "A-102"
  confidence?: number;    // 0..1 — only from real extraction or labeled samples
}

// Keys eligible for provenance metadata (the measurable numeric parameters).
export type ExtractedFactsNumeric =
  Pick<ExtractedFacts,
    'lotAreaSqFt' | 'lotWidthFt' | 'buildingHeightFt' | 'stories' |
    'frontSetbackFt' | 'rearSetbackFt' | 'sideSetbackFt' | 'floorAreaSqFt' |
    'parkingSpaces' | 'egressWidthIn' | 'fireSeparationDistanceFt'>;

export type CheckStatus = 'pass' | 'fail' | 'review';

export interface RuleCheck {
  id: string;
  label: string;                  // "Rear setback"
  category: RuleCategory;
  status: CheckStatus;
  severity: 'high' | 'medium' | 'low';
  measured: string;               // "4 ft" — display
  required: string;               // "≥ 8 ft" — display
  measuredValue: number | null;   // exact number for the decision chain
  requiredValue: number | null;
  comparator: '>=' | '<=' | '==' | 'n/a';
  unit: string;                   // "ft", "in", "" (ratio), "spaces"
  difference: string | null;      // signed gap, e.g. "-0.3 ft" or null
  nearLimit: boolean;             // passes but within the warning margin
  codeSection: string;            // "Zoning Code §12.4"
  fixSuggestion?: string;
  costImpact?: string;
  timeImpact?: string;
  fixEffort: number;              // 1 (easy) .. 5 (hard) — used to rank violations
}

export type RuleCategory = 'zoning' | 'setbacks' | 'height' | 'far' | 'parking' | 'egress' | 'fire' | 'accessibility';

export interface CategoryScore {
  category: RuleCategory;
  label: string;
  score: number;                  // 0..100
  passed: number;
  total: number;
  hasWarning: boolean;
}

export interface VerdictSummary {
  passed: number;
  failed: number;
  warnings: number;
  informational: number;
  total: number;
}

export interface Verdict {
  submissionId: string;
  assessmentId: string;           // human-facing PA-2026-XXXXX
  jurisdiction: string;
  jurisdictionVersion: string;
  verdict: 'PASS' | 'FAIL';
  readinessScore: number;         // 0..100
  checks: RuleCheck[];
  violations: RuleCheck[];        // status 'fail', ranked by fixEffort
  warnings: RuleCheck[];          // status 'pass' but nearLimit
  reviewItems: RuleCheck[];       // qualitative items deferred to RAG layer
  categoryScores: CategoryScore[];
  summary: VerdictSummary;
  rulesEvaluated: number;
  facts: ExtractedFacts;
  elapsedMs: number;
  disclaimer: string;
  generatedAt: string;
}

export interface RuleThreshold {
  min?: number;
  max?: number;
  farMax?: number;
  codeSection: string;
  fixSuggestion?: string;
  costImpact?: string;
  timeImpact?: string;
  fixEffort?: number;
}

export interface JurisdictionRules {
  id: string;
  name: string;
  version: string;
  effectiveDate: string;
  zones: Record<
    string,
    {
      description: string;
      minLotAreaSqFt: number;
      minLotWidthFt: number;
      maxHeightFt: number;
      maxStories: number;
      minFrontSetbackFt: number;
      minRearSetbackFt: number;
      minSideSetbackFt: number;
      maxFar: number;
      minParkingPerUnit: number;
      codeSections: Record<string, string>;
    }
  >;
  building: {
    minEgressWidthIn: number;
    minFireSeparationFt: number;
    egressCodeSection: string;
    fireCodeSection: string;
  };
}

export interface CodeChunk {
  id: string;
  title: string;
  citation: string;               // "IBC §1005.1"
  category: string;
  text: string;
}

export interface Citation {
  citation: string;
  title: string;
  chunkId: string;
  excerpt: string;
}

export interface AuditEntry {
  seq: number;
  ts: string;
  actorRole: Role;
  action: string;
  submissionId: string;
  detail: Record<string, unknown>;
  prevHash: string;
  hash: string;
}
