import type { ExtractedFacts, ProjectType } from '@/lib/types';
import cleanPass from '@/seed/submissions/clean-pass.json';
import sixViolations from '@/seed/submissions/six-violations.json';
import edgeCase from '@/seed/submissions/edge-case.json';

export interface SeedSubmission {
  id: string;
  label: string;
  jurisdiction: string;
  projectType: ProjectType;
  address: string;
  owner: string;
  sqFt: number;
  description: string;
  facts: ExtractedFacts;
}

const SEEDS: Record<string, SeedSubmission> = {
  'clean-pass': cleanPass as SeedSubmission,
  'six-violations': sixViolations as SeedSubmission,
  'edge-case': edgeCase as SeedSubmission,
};

export function listSeeds() {
  return Object.values(SEEDS).map((s) => ({
    id: s.id,
    label: s.label,
    description: s.description,
    jurisdiction: s.jurisdiction,
  }));
}

export function getSeed(id: string): SeedSubmission | null {
  return SEEDS[id] ?? null;
}
