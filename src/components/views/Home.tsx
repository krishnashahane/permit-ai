'use client';

interface Seed { id: string; label: string; description: string; }
interface Meta { seeds: Seed[]; jurisdictions: { id: string; name: string }[]; }

export default function Home({ meta, onStart, onSample }: { meta: Meta | null; onStart: () => void; onSample: (id: string) => void }) {
  return (
    <div>
      {/* Hero */}
      <section className="fadeup grid items-center gap-14 py-8 lg:grid-cols-[1.05fr_1fr] lg:py-16">
        <div>
          <p className="text-sm font-medium text-ink2">Preliminary building compliance</p>
          <h1 className="mt-4 text-hero font-semibold text-ink">Know what will fail before you submit.</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink2">
            Upload building plans. PermitAI extracts the relevant project information,
            evaluates jurisdiction-specific rules, and explains potential compliance
            issues — each tied to its regulatory basis — before you submit.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={onStart} className="btn btn-primary px-5 py-3 text-base">Start an assessment</button>
            <button onClick={() => onSample('six-violations')} className="btn btn-secondary px-5 py-3 text-base">Try a sample</button>
          </div>
        </div>
        <ResultPreview onSample={onSample} />
      </section>

      {/* How it works */}
      <section className="border-t border-line py-14">
        <p className="text-sm font-medium text-ink2">How it works</p>
        <div className="mt-8 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: '01', t: 'Upload plans', d: 'Submit building drawings and project details. Files are validated and scanned server-side.' },
            { n: '02', t: 'Extract project data', d: 'Setbacks, height, floor-area ratio, parking and more are read into structured parameters.' },
            { n: '03', t: 'Evaluate regulations', d: 'A deterministic engine checks each value against the jurisdiction’s rule set.' },
            { n: '04', t: 'Generate report', d: 'Every pass or fail is explained with its exact code section and a suggested correction.' },
          ].map((s) => (
            <div key={s.n}>
              <div className="text-sm font-medium tabular-nums text-accent">{s.n}</div>
              <h3 className="mt-2 text-lg font-semibold text-ink">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink2">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Samples */}
      <section className="border-t border-line py-14">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-ink">Explore a sample</h2>
            <p className="mt-1 text-sm text-ink2">Instant analysis, no upload required.</p>
          </div>
        </div>
        <div className="mt-8 divide-y divide-line border-t border-line">
          {(meta?.seeds || []).map((s) => (
            <button key={s.id} onClick={() => onSample(s.id)} className="group flex w-full items-center justify-between gap-6 py-5 text-left">
              <div className="min-w-0">
                <div className="text-lg font-medium text-ink group-hover:text-accent">{s.label}</div>
                <div className="mt-0.5 truncate text-sm text-ink2">{s.description}</div>
              </div>
              <span className="shrink-0 text-sm text-accent">Run →</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

// A realistic compliance surface used as the hero evidence — not decorative art.
function ResultPreview({ onSample }: { onSample: (id: string) => void }) {
  const rows = [
    { label: 'Rear setback', detected: '4 ft', required: '≥ 20 ft', status: 'Fail', c: '#c8443a' },
    { label: 'Off-street parking', detected: '1 space', required: '≥ 2', status: 'Fail', c: '#c8443a' },
    { label: 'Fire separation', detected: '6 ft', required: '≥ 5 ft', status: 'Pass', c: '#2f8f52' },
  ];
  return (
    <div className="surface fadeup shadow-card">
      <div className="flex items-end justify-between border-b border-line p-6">
        <div>
          <p className="text-meta uppercase tracking-wide text-ink3">Preliminary compliance</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-4xl font-semibold tabular-nums text-danger">45</span><span className="text-ink3">/100</span>
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="text-ink"><span className="font-semibold text-success">1</span> passed</div>
          <div className="text-ink"><span className="font-semibold text-danger">6</span> issues</div>
          <div className="text-ink"><span className="font-semibold text-warning">4</span> warnings</div>
        </div>
      </div>
      <div className="divide-y divide-line px-6">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 py-3.5 text-sm">
            <span className="text-ink">{r.label}</span>
            <span className="tabular-nums text-ink2">{r.detected} · {r.required}</span>
            <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: r.c }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.c }} />{r.status}
            </span>
          </div>
        ))}
      </div>
      <div className="border-t border-line p-4">
        <button onClick={() => onSample('six-violations')} className="btn-text text-sm">Open this assessment →</button>
      </div>
    </div>
  );
}
