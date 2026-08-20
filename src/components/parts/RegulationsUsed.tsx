'use client';
import { useEffect, useState } from 'react';

interface RegData {
  jurisdiction: string; version: string; effectiveDate: string;
  zones: { code: string; description: string }[];
  sources: { citation: string; title: string; category: string }[];
}

// Every regulatory source that governed this assessment. Applied sources are
// marked quietly. Values come from the project's own rule dataset.
export default function RegulationsUsed({ jurisdictionId, usedSections }: { jurisdictionId: string; usedSections: string[] }) {
  const [data, setData] = useState<RegData | null>(null);
  useEffect(() => {
    fetch(`/api/regulations?jurisdiction=${encodeURIComponent(jurisdictionId)}`).then((r) => r.json()).then(setData).catch(() => {});
  }, [jurisdictionId]);
  if (!data) return null;

  return (
    <section>
      <p className="text-sm text-ink2">{data.jurisdiction}</p>
      <p className="mt-0.5 text-sm text-ink3">Regulation set version {data.version} · effective {data.effectiveDate}</p>

      <div className="mt-5 divide-y divide-line">
        {data.sources.map((s) => {
          const applied = usedSections.some((u) => u.includes(s.citation.split(' ')[0]) || s.citation.includes(u.split(' ')[0]));
          return (
            <div key={s.citation} title={`${s.citation} — ${s.title}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
              <div className="min-w-0">
                <span className="text-sm font-medium text-ink">{s.citation}</span>
                <span className="ml-2 text-sm text-ink2">{s.title}</span>
              </div>
              {applied && <span className="shrink-0 text-meta text-success">Applied</span>}
            </div>
          );
        })}
      </div>
      <p className="helper mt-4">Sample regulatory corpus modeled on local zoning, IBC/IRC, and fire code. Extensible per jurisdiction.</p>
    </section>
  );
}
