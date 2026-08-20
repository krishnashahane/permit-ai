'use client';
import type { Verdict } from '@/lib/types';
import { Score, Bar } from '@/components/shared';

// Overview: a large score, a quiet breakdown, and category results as simple
// rows. Whitespace and type carry the hierarchy — not colored KPI boxes.
export default function ComplianceOverview({ verdict }: { verdict: Verdict }) {
  const pass = verdict.verdict === 'PASS';
  const s = verdict.summary;
  const notAssessed = verdict.checks.filter((c) => c.measured === 'not found in documents').length;
  return (
    <section className="fadeup">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_1fr] lg:gap-14">
        <div>
          <p className="text-meta font-medium uppercase tracking-wide text-ink3">Result</p>
          <h1 className={`mt-1 text-3xl font-semibold ${pass ? 'text-success' : 'text-danger'}`}>{pass ? 'Ready to submit' : 'Not ready'}</h1>
          <div className="mt-6"><Score score={verdict.readinessScore} /></div>
          <p className="mt-3 text-sm text-ink2">{verdict.rulesEvaluated} rules evaluated · {verdict.elapsedMs} ms</p>
          {notAssessed > 0 && <p className="mt-1 text-sm text-warning">{notAssessed} parameter{notAssessed > 1 ? 's' : ''} not found in documents — not assessed</p>}
          <p className="mt-1 text-meta text-ink3">{verdict.assessmentId}</p>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <Breakdown n={s.passed} label="Passed" c="#2f8f52" />
            <Breakdown n={s.failed} label="Issues" c="#c8443a" />
            <Breakdown n={s.warnings} label="Warnings" c="#b5730c" />
            <Breakdown n={s.informational} label="Informational" c="#3f6ea6" />
          </div>
        </div>

        <div>
          <p className="mb-4 text-meta font-medium uppercase tracking-wide text-ink3">By category</p>
          <div className="divide-y divide-line">
            {verdict.categoryScores.map((c) => (
              <div key={c.category} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[180px_1fr_auto]">
                <span className="text-sm text-ink">{c.label}{c.hasWarning && <span className="ml-1.5 text-warning" title="Near threshold" aria-label="near threshold">•</span>}</span>
                <div className="col-span-2 sm:col-span-1"><Bar value={c.score} /></div>
                <span className="text-sm tabular-nums text-ink2">{c.score}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Breakdown({ n, label, c }: { n: number; label: string; c: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-lg font-semibold tabular-nums" style={{ color: c }}>{n}</span>
      <span className="text-ink2">{label}</span>
    </span>
  );
}
