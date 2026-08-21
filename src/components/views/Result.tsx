'use client';
import { useRef } from 'react';
import type { ExtractedFacts, Verdict } from '@/lib/types';
import type { ReasonedItem } from '@/lib/rag/reason';
import ComplianceOverview from '@/components/parts/ComplianceOverview';
import ExtractedParams from '@/components/parts/ExtractedParams';
import ViolationCard from '@/components/parts/ViolationCard';
import RegulationsUsed from '@/components/parts/RegulationsUsed';
import PlanPreview from '@/components/parts/PlanPreview';
import { SectionHeading, DecisionBanner, AgentTrace } from '@/components/shared';

export type VerdictResp = Verdict & {
  meta: { role: string; ownerMasked: string; addressMasked: string; piiEncryptedAtRest: boolean };
};

export default function Result({
  verdict, prevScore, reasoned, reasoning, role, jurisdictionId, onReRun, onExport, onNew,
}: {
  verdict: VerdictResp; prevScore: number | null;
  reasoned: Record<string, ReasonedItem>; reasoning: boolean; role: string; jurisdictionId: string;
  onReRun: (edits: Partial<ExtractedFacts>) => void; onExport: () => void; onNew: () => void;
}) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const issues = [...verdict.violations, ...verdict.warnings, ...verdict.reviewItems];
  const usedSections = Array.from(new Set(verdict.checks.map((c) => c.codeSection)));
  const canEdit = role !== 'official';
  const delta = prevScore === null ? null : verdict.readinessScore - prevScore;

  const scrollTo = (id: string) => {
    const el = refs.current[id];
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.animate([{ backgroundColor: 'rgba(31,95,214,0.06)' }, { backgroundColor: 'transparent' }], { duration: 1400 }); }
  };

  return (
    <div className="stagger space-y-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-meta uppercase tracking-wide text-ink3">Compliance assessment</p>
          <p className="mt-1 text-sm text-ink2">{verdict.jurisdiction} · {verdict.meta.addressMasked || 'address withheld'}</p>
        </div>
        <div className="flex items-center gap-2">
          {delta !== null && (
            <span className={`text-sm ${delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-ink2'}`}>
              {delta > 0 ? '↑ +' : delta < 0 ? '↓ ' : ''}{delta} vs previous
            </span>
          )}
          <button onClick={onExport} className="btn btn-secondary px-3.5 py-2">Download report</button>
          <button onClick={onNew} className="btn btn-primary px-3.5 py-2">New assessment</button>
        </div>
      </div>

      {verdict.agent && <DecisionBanner verdict={verdict} />}

      <ComplianceOverview verdict={verdict} />

      <hr className="divider" />
      <div className="grid gap-14 lg:grid-cols-2">
        {issues.length > 0 && <PlanPreview issues={issues} onSelect={scrollTo} />}
        <ExtractedParams facts={verdict.facts} onReRun={onReRun} canEdit={canEdit} />
      </div>

      {verdict.violations.length > 0 && (
        <div>
          <hr className="divider mb-12" />
          <SectionHeading title="Key findings" description="Blocking issues, ranked by fix effort" />
          <div className="space-y-4">
            {verdict.violations.map((c, i) => (
              <div key={c.id} ref={(el) => { refs.current[c.id] = el; }}>
                <ViolationCard index={i + 1} check={c} reasoned={reasoned[c.id]} reasoning={reasoning} role={role} kind="violation" />
              </div>
            ))}
          </div>
        </div>
      )}

      {verdict.warnings.length > 0 && (
        <div>
          <SectionHeading title="Warnings" description="Passing but close to the limit — review recommended" />
          <div className="space-y-4">
            {verdict.warnings.map((c, i) => (
              <div key={c.id} ref={(el) => { refs.current[c.id] = el; }}>
                <ViolationCard index={i + 1} check={c} reasoned={reasoned[c.id]} reasoning={reasoning} role={role} kind="warning" />
              </div>
            ))}
          </div>
        </div>
      )}

      {verdict.reviewItems.length > 0 && (
        <div>
          <SectionHeading title="Informational" description="Qualitative items handled by the reasoning layer" />
          <div className="space-y-4">
            {verdict.reviewItems.map((c, i) => (
              <div key={c.id} ref={(el) => { refs.current[c.id] = el; }}>
                <ViolationCard index={i + 1} check={c} reasoned={reasoned[c.id]} reasoning={reasoning} role={role} kind="info" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <hr className="divider mb-12" />
        <div className="grid gap-14 lg:grid-cols-2">
          <div><SectionHeading title="Regulations used" /><RegulationsUsed jurisdictionId={jurisdictionId} usedSections={usedSections} /></div>
          <div><SectionHeading title="Audit trail" description="Append-only, hash-chained — tamper-evident" /><AuditPanel verdict={verdict} /></div>
        </div>
      </div>

      {verdict.agent && (
        <div>
          <hr className="divider mb-12" />
          <SectionHeading title="How the agent decided" description="Each tool the agent ran, in order — the decision is made by the deterministic rule engine" />
          <AgentTrace agent={verdict.agent} />
        </div>
      )}
    </div>
  );
}

function AuditPanel({ verdict }: { verdict: VerdictResp }) {
  const rows: [string, string][] = [
    ['Assessment ID', verdict.assessmentId],
    ['Submission', verdict.submissionId.slice(0, 18) + '…'],
    ['Timestamp', new Date(verdict.generatedAt).toLocaleString()],
    ['Regulation set', `${verdict.jurisdiction} v${verdict.jurisdictionVersion}`],
    ['Rules evaluated', String(verdict.rulesEvaluated)],
    ['Results', `${verdict.summary.passed} passed · ${verdict.summary.failed} failed · ${verdict.summary.warnings} warnings · ${verdict.summary.informational} info`],
    ['Extraction source', verdict.facts._source],
    ['PII handling', verdict.meta.piiEncryptedAtRest ? 'Encrypted in process; not persisted' : 'None supplied'],
  ];
  return (
    <dl className="divide-y divide-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-6 py-2.5">
          <dt className="text-sm text-ink2">{k}</dt>
          <dd className="text-right text-sm tabular-nums text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
