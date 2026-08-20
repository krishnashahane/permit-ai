'use client';
import { useState } from 'react';
import type { ExtractedFacts } from '@/lib/types';

const FIELDS: { key: keyof ExtractedFacts; label: string; unit: string; step?: number }[] = [
  { key: 'lotAreaSqFt', label: 'Plot area', unit: 'sq ft' },
  { key: 'floorAreaSqFt', label: 'Built-up area', unit: 'sq ft' },
  { key: 'lotWidthFt', label: 'Lot width', unit: 'ft' },
  { key: 'frontSetbackFt', label: 'Front setback', unit: 'ft', step: 0.1 },
  { key: 'rearSetbackFt', label: 'Rear setback', unit: 'ft', step: 0.1 },
  { key: 'sideSetbackFt', label: 'Side setback', unit: 'ft', step: 0.1 },
  { key: 'buildingHeightFt', label: 'Building height', unit: 'ft', step: 0.1 },
  { key: 'stories', label: 'Floors', unit: '' },
  { key: 'parkingSpaces', label: 'Parking', unit: 'spaces' },
  { key: 'egressWidthIn', label: 'Egress width', unit: 'in', step: 0.5 },
  { key: 'fireSeparationDistanceFt', label: 'Fire separation', unit: 'ft', step: 0.1 },
];

// What the system detected — a clean, editable list. Source sheet and confidence
// are shown as quiet metadata, only when present. Nothing is fabricated.
export default function ExtractedParams({
  facts, onReRun, canEdit,
}: { facts: ExtractedFacts; onReRun: (edited: Partial<ExtractedFacts>) => void; canEdit: boolean }) {
  const [edits, setEdits] = useState<Partial<ExtractedFacts>>({});
  const dirty = Object.keys(edits).length > 0;
  const val = (k: keyof ExtractedFacts) => (edits[k] ?? facts[k]) as number;
  const far = facts.lotAreaSqFt > 0 ? (val('floorAreaSqFt') / val('lotAreaSqFt')).toFixed(3) : '0';
  const sourceLabel =
    facts._source === 'vision' ? 'Extracted from uploaded plans'
    : facts._source === 'sample' ? 'Sample project data'
    : facts._source === 'manual' ? 'Provided values'
    : 'Baseline values';

  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Extracted parameters</h2>
          <p className="mt-1 text-sm text-ink2">{sourceLabel}{canEdit ? ' · editable' : ''}</p>
        </div>
        {dirty && canEdit && <button onClick={() => onReRun(edits)} className="btn btn-primary px-3.5 py-2">Re-run with edits</button>}
      </div>

      <div className="grid gap-x-10 gap-y-0 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const meta = facts._meta?.[f.key as never] as { sourceSheet?: string; confidence?: number } | undefined;
          return (
            <div key={String(f.key)} className="flex items-center justify-between gap-4 border-b border-line py-3">
              <div className="min-w-0">
                <div className="text-sm text-ink">{f.label}</div>
                {(meta?.sourceSheet || meta?.confidence != null) && (
                  <div className="mt-0.5 text-meta text-ink3">
                    {meta?.sourceSheet}{meta?.sourceSheet && meta?.confidence != null ? ' · ' : ''}{meta?.confidence != null ? `${Math.round(meta.confidence * 100)}% confidence` : ''}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-baseline gap-1.5">
                {canEdit ? (
                  <input type="number" step={f.step || 1} value={val(f.key)} aria-label={f.label}
                    onChange={(e) => setEdits((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
                    className="w-24 rounded-md border border-line2 bg-white px-2 py-1 text-right text-sm tabular-nums text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15" />
                ) : (
                  <span className="text-base font-medium tabular-nums text-ink">{val(f.key)}</span>
                )}
                <span className="w-12 text-left text-sm text-ink3">{f.unit}</span>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between gap-4 border-b border-line py-3">
          <div className="text-sm text-ink">Floor area ratio<div className="mt-0.5 text-meta text-ink3">computed = built-up ÷ plot</div></div>
          <div className="flex shrink-0 items-baseline gap-1.5"><span className="text-base font-medium tabular-nums text-ink">{far}</span><span className="w-12" /></div>
        </div>
      </div>
      {canEdit && <p className="helper mt-3">Correct any mis-detected value and re-run — the deterministic engine re-evaluates instantly.</p>}
    </section>
  );
}
