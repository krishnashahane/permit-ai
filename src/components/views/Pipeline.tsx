'use client';
import { useEffect, useState } from 'react';

// Focused processing view. Stages map to the real backend sequence; the last
// stage only completes when the API actually responds (`done`). No fake motion.
const STAGES = [
  { k: 'validate', label: 'Document validation' },
  { k: 'extract', label: 'Building information extraction' },
  { k: 'jurisdiction', label: 'Jurisdiction matching' },
  { k: 'retrieve', label: 'Regulation retrieval' },
  { k: 'evaluate', label: 'Regulatory evaluation' },
  { k: 'report', label: 'Report generation' },
];

export default function Pipeline({ done, project }: { done: boolean; project: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (done) { setStep(STAGES.length); return; }
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STAGES.length - 1)), 520);
    return () => clearInterval(t);
  }, [done]);

  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="text-2xl font-semibold text-ink">The agent is reviewing your application</h1>
      <p className="mt-2 text-base text-ink2">{project}</p>

      <ol className="mt-10 space-y-0 border-t border-line" aria-live="polite">
        {STAGES.map((s, i) => {
          const st = done || i < step ? 'done' : i === step ? 'run' : 'wait';
          return (
            <li key={s.k} className="flex items-center gap-3.5 border-b border-line py-4">
              <Mark state={st} />
              <span className={`text-base ${st === 'wait' ? 'text-ink3' : st === 'run' ? 'text-ink' : 'text-ink'}`}>{s.label}</span>
              {st === 'run' && <span className="blink ml-auto text-meta text-ink3">Processing…</span>}
              {st === 'done' && <span className="ml-auto text-meta text-success">Done</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Mark({ state }: { state: 'done' | 'run' | 'wait' }) {
  if (state === 'done') return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-successSoft" aria-hidden>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2f8f52" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </span>
  );
  if (state === 'run') return <span className="blink h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />;
  return <span className="h-2.5 w-2.5 rounded-full border border-line2" aria-hidden />;
}
