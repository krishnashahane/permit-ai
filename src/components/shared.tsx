'use client';
import type { RuleCheck } from '@/lib/types';

const SEM = { pass: '#2f8f52', warn: '#b5730c', fail: '#c8443a', info: '#3f6ea6' };
export function statusColor(s: number): string {
  return s >= 85 ? SEM.pass : s >= 60 ? SEM.warn : SEM.fail;
}

/** Large, quiet score numeral — no ring, no dashboard gaming. */
export function Score({ score, label = 'Preliminary compliance' }: { score: number; label?: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className="text-[3.25rem] font-semibold leading-none tracking-tight tabular-nums" style={{ color: statusColor(score) }}>{score}</span>
        <span className="text-lg text-ink3">/100</span>
      </div>
      <div className="mt-1 text-sm text-ink2">{label}</div>
    </div>
  );
}

/** Thin, restrained progress indicator. */
export function Bar({ value, color }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div className="barfill h-full rounded-full" style={{ width: `${value}%`, background: color || statusColor(value) }} />
    </div>
  );
}

/** Metric: big value + quiet label. Typography, not a colored KPI box. */
export function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'pass' | 'fail' | 'warn' | 'info' }) {
  const c = tone === 'pass' ? 'text-success' : tone === 'fail' ? 'text-danger' : tone === 'warn' ? 'text-warning' : tone === 'info' ? 'text-info' : 'text-ink';
  return (
    <div>
      <div className={`text-2xl font-semibold tabular-nums ${c}`}>{value}</div>
      <div className="mt-0.5 text-sm text-ink2">{label}</div>
    </div>
  );
}

export function StatusText({ status }: { status: RuleCheck['status'] }) {
  const map = { pass: ['#2f8f52', 'Passed'], fail: ['#c8443a', 'Failed'], review: ['#3f6ea6', 'Review'] } as const;
  const [c, t] = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: c }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} aria-hidden />{t}
    </span>
  );
}

export function SeverityText({ severity }: { severity: RuleCheck['severity'] }) {
  const c = severity === 'high' ? '#c8443a' : severity === 'medium' ? '#b5730c' : '#8a909a';
  const t = severity === 'high' ? 'High' : severity === 'medium' ? 'Medium' : 'Low';
  return <span className="text-meta font-medium" style={{ color: c }}>{t} severity</span>;
}

/** Editorial section heading: title, optional description and action. */
export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink2">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** The explainable decision chain — a clean technical explanation, not an LLM bubble. */
export function DecisionChain({ check }: { check: RuleCheck }) {
  const passed = check.status === 'pass';
  const cmp = check.comparator === '>=' ? '≥' : check.comparator === '<=' ? '≤' : '=';
  const comparison =
    check.measuredValue !== null && check.requiredValue !== null
      ? `${check.measured}  ${passed ? cmp : cmp === '≥' ? '<' : '>'}  ${check.requiredValue}${check.unit ? ' ' + check.unit : ''}`
      : `${check.measured} vs ${check.required}`;
  const rows: { k: string; v: string; accent?: 'pass' | 'fail' | 'info' }[] = [
    { k: 'Detected', v: check.measured },
    { k: 'Required', v: check.required },
    { k: 'Comparison', v: comparison },
    { k: 'Decision', v: check.status === 'review' ? 'Needs review' : passed ? 'Pass' : 'Fail', accent: check.status === 'review' ? 'info' : passed ? 'pass' : 'fail' },
    { k: 'Source', v: check.codeSection },
  ];
  return (
    <div>
      <p className="mb-2 text-meta font-medium text-ink3">Decision chain</p>
      <dl className="divide-y divide-line">
        {rows.map((r) => (
          <div key={r.k} className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="text-sm text-ink2">{r.k}</dt>
            <dd className={`text-sm tabular-nums ${r.accent === 'fail' ? 'font-semibold text-danger' : r.accent === 'pass' ? 'font-semibold text-success' : r.accent === 'info' ? 'font-semibold text-info' : 'text-ink'}`}>{r.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="text-meta text-ink3">
      PermitAI provides a preliminary compliance assessment and does not replace approval by the Authority Having Jurisdiction. It performs no official submission.
    </p>
  );
}
