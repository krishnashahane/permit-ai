import type {
  ExtractedFacts,
  JurisdictionRules,
  RuleCheck,
  RuleCategory,
  CategoryScore,
  Verdict,
  VerdictSummary,
} from '@/lib/types';
import springfield from './jurisdictions/springfield.json';

// Registry of loaded jurisdictions. Adding a city = dropping a JSON file here.
const JURISDICTIONS: Record<string, JurisdictionRules> = {
  springfield: springfield as JurisdictionRules,
};

export function listJurisdictions() {
  return Object.values(JURISDICTIONS).map((j) => ({
    id: j.id,
    name: j.name,
    version: j.version,
    zones: Object.keys(j.zones),
  }));
}

export function getJurisdiction(id: string): JurisdictionRules | null {
  return JURISDICTIONS[id] ?? null;
}

export const ADVISORY_DISCLAIMER =
  'PermitAI provides a preliminary compliance assessment and does not replace approval by ' +
  'the Authority Having Jurisdiction (AHJ). Results are advisory, are not a permit, denial, ' +
  'or legal determination, and must be verified with a licensed design professional and the AHJ.';

const CATEGORY_LABELS: Record<RuleCategory, string> = {
  zoning: 'Zoning',
  setbacks: 'Setbacks',
  height: 'Building Height',
  far: 'Floor Area Ratio',
  parking: 'Parking',
  egress: 'Egress',
  fire: 'Fire Safety',
  accessibility: 'Accessibility',
};

// Base severity if a rule fails, by category. Life-safety categories are high.
const BASE_SEVERITY: Record<RuleCategory, 'high' | 'medium' | 'low'> = {
  fire: 'high', egress: 'high', accessibility: 'high',
  setbacks: 'medium', height: 'medium', far: 'medium', zoning: 'medium', parking: 'low',
};

// A passing value within this fraction of its threshold is flagged as a warning.
const WARN_MARGIN = 0.1;

function fmt(n: number, unit: string) {
  const v = Number.isInteger(n) ? `${n}` : n.toFixed(2);
  return unit ? `${v} ${unit}` : v;
}

interface RuleDef {
  id: string;
  label: string;
  category: RuleCategory;
  comparator: '>=' | '<=';
  measured: number;
  required: number;
  unit: string;
  codeSection: string;
  fix: string;
  cost: string;
  time: string;
  effort: number;
  field: string;        // the ExtractedFacts key this rule reads
}

// A parameter that could not be read from the documents is reported as
// "not assessed" — never a fabricated pass or fail.
function notAssessed(r: RuleDef): RuleCheck {
  return {
    id: r.id, label: r.label, category: r.category, status: 'review', severity: 'low',
    measured: 'not found in documents',
    required: `${r.comparator === '>=' ? '≥' : '≤'} ${fmt(r.required, r.unit)}`,
    measuredValue: null, requiredValue: r.required, comparator: r.comparator, unit: r.unit,
    difference: null, nearLimit: false, codeSection: r.codeSection,
    fixSuggestion: 'This value was not present in the submitted plans. Provide it to complete the check.',
    fixEffort: 1,
  };
}

function evalRule(r: RuleDef): RuleCheck {
  const pass = r.comparator === '>=' ? r.measured >= r.required : r.measured <= r.required;
  // signed gap from the limit (how far past/short of the requirement)
  const rawDiff = r.measured - r.required;
  const difference = fmtSigned(rawDiff, r.unit);
  // warning: passes, but within WARN_MARGIN of the threshold
  const margin = Math.abs(r.required) * WARN_MARGIN;
  const nearLimit = pass && Math.abs(rawDiff) <= margin && r.required !== 0;
  // severity escalates when a failure exceeds the requirement by >25%
  let severity = BASE_SEVERITY[r.category];
  if (!pass && r.required !== 0 && Math.abs(rawDiff) / Math.abs(r.required) > 0.25) severity = 'high';

  return {
    id: r.id,
    label: r.label,
    category: r.category,
    status: pass ? 'pass' : 'fail',
    severity,
    measured: fmt(r.measured, r.unit),
    required: `${r.comparator === '>=' ? '≥' : '≤'} ${fmt(r.required, r.unit)}`,
    measuredValue: r.measured,
    requiredValue: r.required,
    comparator: r.comparator,
    unit: r.unit,
    difference,
    nearLimit,
    codeSection: r.codeSection,
    ...(pass ? {} : { fixSuggestion: r.fix, costImpact: r.cost, timeImpact: r.time }),
    fixEffort: r.effort,
  };
}

function fmtSigned(n: number, unit: string): string {
  const v = Number.isInteger(n) ? `${Math.abs(n)}` : Math.abs(n).toFixed(2);
  const sign = n > 0 ? '+' : n < 0 ? '−' : '±';
  return unit ? `${sign}${v} ${unit}` : `${sign}${v}`;
}

/**
 * The FAST PATH. Pure, deterministic, no I/O — runs in well under a second.
 * Every check compares an extracted numeric fact against a jurisdiction
 * threshold and attaches the exact code section it derives from.
 */
export function runRulesEngine(
  facts: ExtractedFacts,
  jurisdictionId: string,
  submissionId: string,
): Verdict {
  const started = Date.now();
  const j = getJurisdiction(jurisdictionId);
  if (!j) throw new Error(`Unknown jurisdiction: ${jurisdictionId}`);

  const zone = j.zones[facts.zoneType];
  const checks: RuleCheck[] = [];

  if (!zone) {
    checks.push({
      id: 'zoning-zone', label: 'Zoning district', category: 'zoning', status: 'fail', severity: 'high',
      measured: facts.zoneType || '(none)', required: `one of ${Object.keys(j.zones).join(', ')}`,
      measuredValue: null, requiredValue: null, comparator: 'n/a', unit: '', difference: null, nearLimit: false,
      codeSection: 'Zoning Code §11.1',
      fixSuggestion: 'Confirm the parcel zoning with the assessor; project may require rezoning or a variance.',
      costImpact: '$1,500–$8,000', timeImpact: '8–16 weeks', fixEffort: 5,
    });
    return assemble(checks, facts, j, submissionId, started);
  }

  const cs = zone.codeSections;
  const reqParking = Math.ceil(facts.dwellingUnits * zone.minParkingPerUnit) || zone.minParkingPerUnit;

  const defs: RuleDef[] = [
    { id: 'lot-area', label: 'Lot area', category: 'zoning', comparator: '>=', measured: facts.lotAreaSqFt, required: zone.minLotAreaSqFt, unit: 'sq ft', codeSection: cs.lotArea, fix: 'Lot area is below the district minimum; a lot-size variance or a smaller footprint is required.', cost: '$2,000–$6,000', time: '6–12 weeks', effort: 5, field: 'lotAreaSqFt' },
    { id: 'lot-width', label: 'Lot width', category: 'zoning', comparator: '>=', measured: facts.lotWidthFt, required: zone.minLotWidthFt, unit: 'ft', codeSection: cs.lotWidth, fix: 'Lot width is under the minimum frontage; consider a variance or lot-line adjustment.', cost: '$2,000–$5,000', time: '6–10 weeks', effort: 5, field: 'lotWidthFt' },
    { id: 'height', label: 'Building height', category: 'height', comparator: '<=', measured: facts.buildingHeightFt, required: zone.maxHeightFt, unit: 'ft', codeSection: cs.height, fix: 'Reduce overall height (lower plate height or roof pitch) to meet the district cap.', cost: '$5,000–$25,000', time: '2–4 weeks', effort: 4, field: 'buildingHeightFt' },
    { id: 'stories', label: 'Stories', category: 'height', comparator: '<=', measured: facts.stories, required: zone.maxStories, unit: '', codeSection: cs.height, fix: 'Remove or reclassify a story, or seek a height/story variance.', cost: '$10,000–$40,000', time: '3–6 weeks', effort: 4, field: 'stories' },
    { id: 'front-setback', label: 'Front setback', category: 'setbacks', comparator: '>=', measured: facts.frontSetbackFt, required: zone.minFrontSetbackFt, unit: 'ft', codeSection: cs.frontSetback, fix: 'Shift the building envelope back from the front lot line to meet the required setback.', cost: '$3,000–$12,000', time: '1–3 weeks', effort: 3, field: 'frontSetbackFt' },
    { id: 'rear-setback', label: 'Rear setback', category: 'setbacks', comparator: '>=', measured: facts.rearSetbackFt, required: zone.minRearSetbackFt, unit: 'ft', codeSection: cs.rearSetback, fix: 'Increase distance between the structure and the rear lot line, or reduce the rear footprint.', cost: '$2,000–$9,000', time: '1–2 weeks', effort: 2, field: 'rearSetbackFt' },
    { id: 'side-setback', label: 'Side setback', category: 'setbacks', comparator: '>=', measured: facts.sideSetbackFt, required: zone.minSideSetbackFt, unit: 'ft', codeSection: cs.sideSetback, fix: 'Narrow the structure or shift it to restore the required side-yard clearance.', cost: '$2,000–$8,000', time: '1–2 weeks', effort: 2, field: 'sideSetbackFt' },
    { id: 'far', label: 'Floor Area Ratio (FAR)', category: 'far', comparator: '<=', measured: facts.far, required: zone.maxFar, unit: '', codeSection: cs.far, fix: 'Reduce gross floor area or increase lot area so FAR falls within the district maximum.', cost: '$4,000–$20,000', time: '2–4 weeks', effort: 4, field: 'floorAreaSqFt' },
    { id: 'parking', label: 'Off-street parking', category: 'parking', comparator: '>=', measured: facts.parkingSpaces, required: reqParking, unit: 'spaces', codeSection: cs.parking, fix: `Provide at least ${reqParking} off-street space(s) (${zone.minParkingPerUnit}/unit), or apply for a parking reduction.`, cost: '$5,000–$15,000/space', time: '2–5 weeks', effort: 3, field: 'parkingSpaces' },
    { id: 'egress', label: 'Egress clear width', category: 'egress', comparator: '>=', measured: facts.egressWidthIn, required: j.building.minEgressWidthIn, unit: 'in', codeSection: j.building.egressCodeSection, fix: 'Widen the required egress door/path to the code minimum clear width.', cost: '$1,500–$6,000/opening', time: '1–2 weeks', effort: 2, field: 'egressWidthIn' },
    { id: 'fire-separation', label: 'Fire separation distance', category: 'fire', comparator: '>=', measured: facts.fireSeparationDistanceFt, required: j.building.minFireSeparationFt, unit: 'ft', codeSection: j.building.fireCodeSection, fix: 'Increase distance to the property line, or add a rated wall assembly and limit openings.', cost: '$3,000–$18,000', time: '2–4 weeks', effort: 3, field: 'fireSeparationDistanceFt' },
  ];

  const missing = new Set(facts._missing ?? []);
  for (const d of defs) {
    // FAR needs both floor area and lot area; treat as not-assessed if either is missing.
    const farMissing = d.id === 'far' && (missing.has('floorAreaSqFt') || missing.has('lotAreaSqFt'));
    checks.push(missing.has(d.field) || farMissing ? notAssessed(d) : evalRule(d));
  }

  // Qualitative accessible-route item is deferred to the RAG reasoning layer.
  checks.push({
    id: 'accessible-route', label: 'Accessible route', category: 'accessibility', status: 'review', severity: 'low',
    measured: facts.accessibleRoute === null ? 'not determinable from plans' : facts.accessibleRoute ? 'route indicated' : 'no clear route',
    required: 'continuous accessible route per IBC Ch. 11 / ADA',
    measuredValue: null, requiredValue: null, comparator: 'n/a', unit: '', difference: null, nearLimit: false,
    codeSection: 'IBC §1104 / ADA 206',
    fixSuggestion: 'Reviewed in the reasoning layer against the accessibility code corpus.',
    fixEffort: 3,
  });

  return assemble(checks, facts, j, submissionId, started);
}

let seq = 1000;
function nextAssessmentId(): string {
  seq += 1;
  const rand = Math.floor(Math.random() * 900 + 100);
  return `PA-${new Date().getFullYear()}-${rand}${(seq % 100).toString().padStart(2, '0')}`;
}

function assemble(
  checks: RuleCheck[],
  facts: ExtractedFacts,
  j: JurisdictionRules,
  submissionId: string,
  started: number,
): Verdict {
  const violations = checks.filter((c) => c.status === 'fail').sort((a, b) => a.fixEffort - b.fixEffort);
  const warnings = checks.filter((c) => c.status === 'pass' && c.nearLimit);
  const reviewItems = checks.filter((c) => c.status === 'review');
  const hardChecks = checks.filter((c) => c.status !== 'review');
  const passed = hardChecks.filter((c) => c.status === 'pass').length;

  const readinessScore = hardChecks.length === 0 ? 0 : Math.round((passed / hardChecks.length) * 100);
  const verdict = violations.length === 0 ? 'PASS' : 'FAIL';

  // Category scores from the hard (numeric) checks.
  const cats = new Map<RuleCategory, { passed: number; total: number; warn: boolean }>();
  for (const c of hardChecks) {
    const e = cats.get(c.category) || { passed: 0, total: 0, warn: false };
    e.total += 1;
    if (c.status === 'pass') e.passed += 1;
    if (c.nearLimit) e.warn = true;
    cats.set(c.category, e);
  }
  const categoryScores: CategoryScore[] = [...cats.entries()].map(([category, e]) => ({
    category,
    label: CATEGORY_LABELS[category],
    score: e.total === 0 ? 0 : Math.round((e.passed / e.total) * 100),
    passed: e.passed,
    total: e.total,
    hasWarning: e.warn,
  }));

  const summary: VerdictSummary = {
    passed: hardChecks.filter((c) => c.status === 'pass' && !c.nearLimit).length,
    failed: violations.length,
    warnings: warnings.length,
    informational: reviewItems.length,
    total: checks.length,
  };

  return {
    submissionId,
    assessmentId: nextAssessmentId(),
    jurisdiction: j.name,
    jurisdictionVersion: j.version,
    verdict,
    readinessScore,
    checks,
    violations,
    warnings,
    reviewItems,
    categoryScores,
    summary,
    rulesEvaluated: hardChecks.length,
    facts,
    elapsedMs: Date.now() - started,
    disclaimer: ADVISORY_DISCLAIMER,
    generatedAt: new Date().toISOString(),
  };
}
