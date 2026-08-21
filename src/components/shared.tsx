'use client';
import { useEffect, useRef, useState } from 'react';
import type { AgentRun, RuleCheck, Verdict } from '@/lib/types';

const SEM = { pass: '#2f8f52', warn: '#b5730c', fail: '#c8443a', info: '#3f6ea6' };
export function statusColor(s: number): string {
  return s >= 85 ? SEM.pass : s >= 60 ? SEM.warn : SEM.fail;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Counts from 0 to `value` once, unless reduced motion is requested. */
function useCountUp(value: number, ms = 700) {
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(value);
  const raf = useRef(0);
  useEffect(() => {
    if (reduced) { setN(value); return; }
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setN(Math.round((1 - Math.pow(1 - p, 3)) * value));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, ms, reduced]);
  return n;
}

/** Large, quiet score numeral with a subtle count-up — no ring, no gaming. */
export function Score({ score, label = 'Preliminary compliance' }: { score: number; label?: string }) {
  const n = useCountUp(score);
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className="text-[3.25rem] font-semibold leading-none tracking-tight tabular-nums" style={{ color: statusColor(score) }}>{n}</span>
        <span className="text-lg text-ink3">/100</span>
      </div>
      <div className="mt-1 text-sm text-ink2">{label}</div>
    </div>
  );
}

/** The agent's yes/no decision — the headline result. Reveals with a soft rise. */
export function DecisionBanner({ verdict }: { verdict: Verdict }) {
  const approve = verdict.verdict === 'PASS';
  const c = approve ? '#2f8f52' : '#c8443a';
  const bg = approve ? '#eef7f0' : '#fbeeec';
  return (
    <div className="fadeup overflow-hidden rounded-lg" style={{ background: bg }}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-l-4 px-6 py-5" style={{ borderColor: c }}>
        <div className="flex items-center gap-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: c }} aria-hidden>
            {approve
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>}
          </span>
          <div>
            <p className="text-meta font-medium uppercase tracking-wide" style={{ color: c }}>Agent decision</p>
            <h2 className="text-xl font-semibold" style={{ color: c }}>{approve ? 'Ready to submit' : `Not ready — ${verdict.violations.length} correction${verdict.violations.length === 1 ? '' : 's'} required`}</h2>
          </div>
        </div>
        <p className="text-sm text-ink2">Decided in {verdict.elapsedMs} ms · {verdict.rulesEvaluated} rules</p>
      </div>
    </div>
  );
}

/** The agent tool trace — makes the agentic workflow visible and auditable. */
export function AgentTrace({ agent }: { agent: AgentRun }) {
  return (
    <ol className="divide-y divide-line">
      {agent.steps.map((s, i) => (
        <li key={i} className="fadeup flex items-center gap-3 py-2.5" style={{ animationDelay: `${i * 60}ms` }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-successSoft" aria-hidden>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2f8f52" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
          <span className="flex-1 text-sm text-ink">{s.label}</span>
          {s.detail && <span className="text-meta text-ink3">{s.detail}</span>}
        </li>
      ))}
    </ol>
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
