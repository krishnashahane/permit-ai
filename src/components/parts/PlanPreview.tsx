'use client';
import type { RuleCheck } from '@/lib/types';

// Schematic site diagram with issue markers. Marker positions are mapped by rule
// category (illustrative), not detected from image geometry — labeled as such so
// no false precision is implied. Layout is ready for real geometric overlays.
const POS: Record<string, { x: number; y: number }> = {
  'rear-setback': { x: 50, y: 90 }, 'side-setback': { x: 10, y: 50 }, 'front-setback': { x: 50, y: 12 },
  setbacks: { x: 50, y: 88 }, height: { x: 50, y: 50 }, far: { x: 68, y: 50 },
  parking: { x: 86, y: 82 }, egress: { x: 32, y: 62 }, fire: { x: 88, y: 30 }, accessibility: { x: 24, y: 82 },
};

export default function PlanPreview({ issues, onSelect }: { issues: RuleCheck[]; onSelect: (id: string) => void }) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold text-ink">Plan evidence</h2>
        <span className="text-meta text-ink3">Schematic · illustrative</span>
      </div>
      <div className="surface overflow-hidden">
        <svg viewBox="0 0 100 100" className="w-full" style={{ aspectRatio: '3/2' }} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Schematic site plan with issue markers">
          <rect x="4" y="4" width="92" height="92" fill="#fbfbf9" stroke="#d9d9d2" strokeWidth="0.5" />
          <rect x="16" y="16" width="68" height="68" fill="none" stroke="#c3ccdd" strokeWidth="0.4" strokeDasharray="2 1.5" />
          <rect x="28" y="30" width="44" height="40" fill="#eef1f5" stroke="#c9cfd8" strokeWidth="0.5" rx="1" />
          <text x="50" y="52" textAnchor="middle" fontSize="3.6" fill="#8a909a" fontFamily="sans-serif">Building</text>
          <text x="50" y="9" textAnchor="middle" fontSize="2.8" fill="#a2a7b0" fontFamily="sans-serif">Front (street)</text>
          {issues.map((c, i) => {
            const p = POS[c.id] || POS[c.category] || { x: 50, y: 50 };
            const col = c.status === 'fail' ? '#c8443a' : c.status === 'review' ? '#3f6ea6' : '#b5730c';
            return (
              <g key={c.id} className="cursor-pointer" onClick={() => onSelect(c.id)} role="button" aria-label={`Issue ${i + 1}: ${c.label}`}>
                <circle cx={p.x} cy={p.y} r="3.1" fill={col} />
                <text x={p.x} y={p.y + 1.3} textAnchor="middle" fontSize="3.4" fill="#fff" fontFamily="sans-serif" fontWeight="600">{i + 1}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
        {issues.map((c, i) => (
          <button key={c.id} onClick={() => onSelect(c.id)} title={`${c.label} — ${c.codeSection}`} className="flex items-center gap-2.5 border-b border-line py-2 text-left text-sm hover:text-accent">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-meta font-semibold text-white" style={{ background: c.status === 'fail' ? '#c8443a' : c.status === 'review' ? '#3f6ea6' : '#b5730c' }}>{i + 1}</span>
            <span className="truncate text-ink">{c.label}</span>
          </button>
        ))}
      </div>
      <p className="helper mt-3">Marker positions are illustrative (mapped by rule category). Geometric overlay from plan coordinates is a planned extension.</p>
    </section>
  );
}
