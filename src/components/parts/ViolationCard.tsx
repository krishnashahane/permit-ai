'use client';
import { useState } from 'react';
import type { RuleCheck } from '@/lib/types';
import type { ReasonedItem } from '@/lib/rag/reason';
import { SeverityText, StatusText, DecisionChain } from '@/components/shared';
import AskWhyChat from '@/components/AskWhyChat';

// A single explained issue. One restrained surface, a thin status edge, and a
// consistent Detected / Required / Difference line. Detail expands in place.
export default function ViolationCard({
  index, check, reasoned, reasoning, role, kind,
}: {
  index: number; check: RuleCheck; reasoned?: ReasonedItem; reasoning: boolean; role: string;
  kind: 'violation' | 'warning' | 'info';
}) {
  const [open, setOpen] = useState(false);
  const edge = kind === 'violation' ? '#c8443a' : kind === 'warning' ? '#b5730c' : '#3f6ea6';

  return (
    <div className="surface fadeup overflow-hidden">
      <div className="flex" style={{ borderLeft: `3px solid ${edge}` }}>
        <div className="min-w-0 flex-1">
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start justify-between gap-3 px-5 pt-4 text-left">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="text-meta tabular-nums text-ink3">Issue {String(index).padStart(2, '0')}</span>
                <SeverityText severity={check.severity} />
              </div>
              <h3 className="mt-0.5 text-lg font-semibold text-ink">{check.label}</h3>
              <p className="text-sm text-accent">{check.codeSection}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 pt-1">
              <StatusText status={check.status} />
              <span className="text-ink3" aria-hidden>{open ? '−' : '+'}</span>
            </div>
          </button>

          <dl className="flex flex-wrap gap-x-10 gap-y-1 px-5 py-4 text-sm">
            <Metric k="Detected" v={check.measured} />
            <Metric k="Required" v={check.required} />
            <Metric k="Difference" v={check.difference ?? '—'} danger={check.status === 'fail'} />
          </dl>

          {open && (
            <div className="space-y-6 border-t border-line px-5 py-5">
              <DecisionChain check={check} />

              <div>
                <p className="mb-1.5 text-meta font-medium text-ink3">Why this {check.status === 'fail' ? 'failed' : 'needs attention'}</p>
                {reasoned ? (
                  <>
                    <p className="text-base leading-relaxed text-ink">{reasoned.justification}</p>
                    {reasoned.citations.length > 0 && (
                      <p className="mt-2 text-sm text-ink2">Regulation: {reasoned.citations.map((c) => c.citation).join(', ')}</p>
                    )}
                    {!reasoned.grounded && <p className="mt-1 text-sm text-danger">Ungrounded claim withheld.</p>}
                  </>
                ) : reasoning ? (
                  <p className="blink text-sm text-ink2">Retrieving regulation and generating explanation…</p>
                ) : (
                  <p className="text-sm text-ink3">Queued for the reasoning layer.</p>
                )}
              </div>

              {check.fixSuggestion && (
                <div>
                  <p className="mb-1.5 text-meta font-medium text-ink3">Suggested correction</p>
                  <p className="text-base leading-relaxed text-ink">{check.fixSuggestion}</p>
                  {(check.costImpact || check.timeImpact) && <p className="mt-1 text-sm text-ink3">Estimated impact · {check.costImpact} · {check.timeImpact}</p>}
                </div>
              )}

              <AskWhyChat check={check} role={role} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ k, v, danger }: { k: string; v: string; danger?: boolean }) {
  return (
    <div>
      <dt className="text-meta text-ink3">{k}</dt>
      <dd className={`text-base font-medium tabular-nums ${danger ? 'text-danger' : 'text-ink'}`}>{v}</dd>
    </div>
  );
}
