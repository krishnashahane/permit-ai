'use client';
import type { Verdict } from '@/lib/types';
import { Kpi } from '@/components/shared';

export interface HistoryItem { verdict: Verdict; applicant: string; projectType: string; when: string; }

// Reviewer / authority workflow. Two clearly separated zones: an illustrative
// operational view (labeled) and a real table of this session's assessments.
// No claim of a live municipal-system integration.
export default function Authority({ history, onOpen }: { history: HistoryItem[]; onOpen: (i: number) => void }) {
  const pass = history.filter((h) => h.verdict.verdict === 'PASS').length;

  return (
    <div className="space-y-16 py-2">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Authority dashboard</h1>
        <p className="mt-2 text-base text-ink2">A workflow view for reviewing officials. Not connected to a live municipal system.</p>
      </div>

      <section>
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-sm font-medium text-ink">Operational view</h2>
          <span className="text-meta text-ink3">Illustrative</span>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Applications today" value="184" />
          <Kpi label="Pre-checks passed" value="119" tone="pass" />
          <Kpi label="Potential issues" value="43" tone="fail" />
          <Kpi label="Manual review" value="22" tone="warn" />
          <Kpi label="Avg pre-check" value="2m 14s" />
          <Kpi label="Review effort" value="−61%" tone="pass" />
        </div>
        <p className="helper mt-6">Figures above illustrate scale and workflow value; they are not measured production data.</p>
      </section>

      <section>
        <div className="mb-6 flex items-baseline gap-3">
          <h2 className="text-sm font-medium text-ink">This session</h2>
          <span className="text-meta text-success">Live</span>
        </div>
        <div className="mb-8 flex gap-12">
          <Kpi label="Assessed" value={history.length} />
          <Kpi label="Ready" value={pass} tone="pass" />
          <Kpi label="Not ready" value={history.length - pass} tone="fail" />
        </div>

        {history.length === 0 ? (
          <p className="border-t border-line py-10 text-center text-sm text-ink2">No assessments yet this session. Run one from a sample project or a new assessment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line2 text-left text-meta text-ink3">
                  <th className="py-2.5 pr-4 font-medium">Assessment</th>
                  <th className="py-2.5 pr-4 font-medium">Applicant</th>
                  <th className="py-2.5 pr-4 font-medium">Project</th>
                  <th className="py-2.5 pr-4 font-medium">Score</th>
                  <th className="py-2.5 pr-4 font-medium">Issues</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 pr-4 font-medium">Time</th>
                  <th className="py-2.5" />
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => {
                  const v = h.verdict;
                  const [label, color] = v.verdict === 'PASS'
                    ? (v.summary.warnings > 0 ? ['Review', '#b5730c'] : ['Ready', '#2f8f52'])
                    : ['Not ready', '#c8443a'];
                  return (
                    <tr key={i} className="border-b border-line hover:bg-surface2">
                      <td className="py-3 pr-4 tabular-nums text-ink">{v.assessmentId}</td>
                      <td className="py-3 pr-4 text-ink2">{h.applicant || '—'}</td>
                      <td className="py-3 pr-4 text-ink2">{h.projectType}</td>
                      <td className="py-3 pr-4 tabular-nums text-ink">{v.readinessScore}</td>
                      <td className="py-3 pr-4 tabular-nums text-ink2">{v.summary.failed} · {v.summary.warnings}</td>
                      <td className="py-3 pr-4"><span className="inline-flex items-center gap-1.5 font-medium" style={{ color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}</span></td>
                      <td className="py-3 pr-4 text-ink3">{new Date(h.when).toLocaleTimeString()}</td>
                      <td className="py-3 text-right"><button onClick={() => onOpen(i)} className="btn-text">Open</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
