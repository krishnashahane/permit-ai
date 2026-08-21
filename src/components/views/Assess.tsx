'use client';
import { useEffect, useRef, useState } from 'react';

interface Meta { jurisdictions: { id: string; name: string; zones: string[] }[]; }
export interface AssessForm {
  files: File[]; jurisdiction: string; projectType: string; buildingType: string;
  address: string; owner: string; sqFt: string; floors: string; description: string;
}
const STEPS = ['Documents', 'Project details', 'Jurisdiction', 'Review'];

export default function Assess({ meta, onRun, error }: { meta: Meta | null; onRun: (f: AssessForm) => void; error: string }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<AssessForm>({
    files: [], jurisdiction: 'springfield', projectType: 'single_family', buildingType: 'residential',
    address: '', owner: '', sqFt: '', floors: 'G+2', description: '',
  });
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // A refused/failed analysis (e.g. non-building document) sends the user back
  // to the Documents step so they can add the right file.
  useEffect(() => { if (error) setStep(0); }, [error]);
  const set = (k: keyof AssessForm, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const addFiles = (l: FileList | null) => l && setF((p) => ({ ...p, files: [...p.files, ...Array.from(l)].slice(0, 5) }));
  const canNext = step === 0 ? f.files.length > 0 : true;
  const jur = meta?.jurisdictions.find((j) => j.id === f.jurisdiction);

  return (
    <div className="mx-auto max-w-2xl py-4">
      {error && (
        <div className="fadeup mb-6 flex items-start gap-3 rounded-lg border border-danger/30 bg-dangerSoft px-4 py-3.5" role="alert">
          <svg className="mt-0.5 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8443a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
          <div>
            <p className="text-sm font-medium text-danger">Couldn’t analyze this upload</p>
            <p className="mt-0.5 text-sm text-ink2">{error}</p>
          </div>
        </div>
      )}
      {/* Thin progress */}
      <div className="mb-10">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">{STEPS[step]}</p>
          <p className="text-meta text-ink3">Step {step + 1} of {STEPS.length}</p>
        </div>
        <div className="mt-3 flex gap-1.5">
          {STEPS.map((_, i) => <div key={i} className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${i <= step ? 'bg-accent' : 'bg-line2'}`} />)}
        </div>
      </div>

      {step === 0 && (
        <div className="fadeup">
          <H t="Upload building plans" s="PDF, PNG or JPG, up to 25 MB each. Files are validated and malware-scanned server-side before parsing." />
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            className={`flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center transition-all duration-150 ${dragOver ? 'scale-[1.01] border-accent bg-accentSoft' : 'border-line2 bg-surface'}`}
          >
            <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
            <DocIcon />
            <p className="mt-3 text-base text-ink">Drag plan sheets here, or <button onClick={() => fileRef.current?.click()} className="btn-text">choose files</button></p>
            <p className="mt-1 text-sm text-ink3">Maximum 5 files · 25 MB each</p>
          </div>
          {f.files.length > 0 && (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {f.files.map((file, i) => (
                <li key={i} className="fadeup flex items-center justify-between py-3 text-sm">
                  <span className="truncate text-ink">{file.name}</span>
                  <span className="flex items-center gap-4 text-ink3">
                    <span className="tabular-nums">{(file.size / 1024).toFixed(0)} KB</span>
                    <span className="text-success">Ready</span>
                    <button onClick={() => set('files', f.files.filter((_, j) => j !== i))} aria-label={`Remove ${file.name}`} className="text-ink3 hover:text-danger">Remove</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="helper mt-4">Uploads are processed server-side and not persisted. No document content is sent to analytics or used to train any model.</p>
        </div>
      )}

      {step === 1 && (
        <div className="fadeup space-y-8">
          <H t="Project details" s="Basic information used alongside the extracted plan parameters." />
          <Group title="Project">
            <div className="grid gap-5 sm:grid-cols-2">
              <L label="Project type"><select value={f.projectType} onChange={(e) => set('projectType', e.target.value)} className="field">
                <option value="single_family">Single-family</option><option value="multi_family">Multi-family</option>
                <option value="commercial">Commercial</option><option value="mixed_use">Mixed-use</option><option value="accessory">Accessory</option>
              </select></L>
              <L label="Building type"><select value={f.buildingType} onChange={(e) => set('buildingType', e.target.value)} className="field">
                <option value="residential">Residential</option><option value="commercial">Commercial</option>
                <option value="institutional">Institutional</option><option value="industrial">Industrial</option>
              </select></L>
              <L label="Floors"><input value={f.floors} onChange={(e) => set('floors', e.target.value)} placeholder="G+2" className="field" /></L>
              <L label="Built-up area" helper="Gross floor area in square feet"><input value={f.sqFt} onChange={(e) => set('sqFt', e.target.value)} placeholder="3100" className="field" /></L>
            </div>
          </Group>
          <Group title="Identifying information" note="Treated as PII — encrypted in process, masked in logs, never persisted or used for training.">
            <div className="grid gap-5 sm:grid-cols-2">
              <L label="Property address"><input value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="123 Main St" className="field" /></L>
              <L label="Owner name"><input value={f.owner} onChange={(e) => set('owner', e.target.value)} placeholder="Owner" className="field" /></L>
            </div>
            <div className="mt-5"><L label="Description"><textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="Short description of the work" className="field resize-none" /></L></div>
          </Group>
        </div>
      )}

      {step === 2 && (
        <div className="fadeup">
          <H t="Jurisdiction" s="Regulations are jurisdiction-dependent. The rule set and version below determine every threshold applied." />
          <ol className="space-y-0 border-t border-line">
            <Hier label="State / Region" value={<select className="field max-w-xs" defaultValue="sample"><option value="sample">Sample State</option></select>} />
            <Hier label="Authority having jurisdiction" value={
              <select value={f.jurisdiction} onChange={(e) => set('jurisdiction', e.target.value)} className="field max-w-xs">
                {(meta?.jurisdictions || []).map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>} />
            <Hier label="Building type" value={<span className="text-sm capitalize text-ink">{f.buildingType}</span>} />
            <Hier label="Zoning districts" value={<span className="text-sm text-ink2">{jur?.zones.join(', ')}</span>} />
            <Hier label="Applicable regulation set" value={<span className="text-sm font-medium text-ink">{jur?.name}</span>} last />
          </ol>
          <p className="helper mt-4">Additional jurisdictions are data-driven and can be added without code changes.</p>
        </div>
      )}

      {step === 3 && (
        <div className="fadeup">
          <H t="Review" s="Confirm before the deterministic engine evaluates your submission." />
          <dl className="divide-y divide-line border-y border-line">
            <Row k="Documents" v={f.files.map((x) => x.name).join(', ') || '—'} />
            <Row k="Project type" v={f.projectType} />
            <Row k="Building type" v={f.buildingType} />
            <Row k="Floors" v={f.floors} />
            <Row k="Built-up area" v={f.sqFt ? `${f.sqFt} sq ft` : '—'} />
            <Row k="Jurisdiction" v={jur?.name || f.jurisdiction} />
          </dl>
          <p className="mt-5 text-sm text-ink2">This produces an advisory preliminary assessment. It does not replace approval by the Authority Having Jurisdiction.</p>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn btn-text px-2 py-2 disabled:opacity-0">← Back</button>
        {step < STEPS.length - 1
          ? <button onClick={() => setStep((s) => s + 1)} disabled={!canNext} title={!canNext ? 'Add a building permit document to continue' : undefined} className="btn btn-primary px-5 py-2.5">Continue</button>
          : <button onClick={() => onRun(f)} className="btn btn-primary px-5 py-2.5">Run preliminary assessment</button>}
      </div>
      {step === 0 && f.files.length === 0 && (
        <p className="mt-3 text-right text-meta text-ink3">Add at least one building permit document to continue.</p>
      )}
    </div>
  );
}

function H({ t, s }: { t: string; s: string }) { return <div className="mb-8"><h1 className="text-2xl font-semibold text-ink">{t}</h1><p className="mt-2 text-base text-ink2">{s}</p></div>; }
function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <div><h2 className="mb-1 text-sm font-medium text-ink">{title}</h2>{note && <p className="mb-4 text-meta text-ink3">{note}</p>}{!note && <div className="mb-4" />}{children}</div>;
}
function L({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}{helper && <span className="helper">{helper}</span>}</label>;
}
function Hier({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return <li className={`flex items-center justify-between gap-4 py-4 ${last ? '' : 'border-b border-line'}`}><span className="text-sm text-ink2">{label}</span>{value}</li>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex items-baseline justify-between gap-4 py-3"><dt className="text-sm text-ink2">{k}</dt><dd className="truncate text-right text-sm text-ink">{v}</dd></div>;
}
function DocIcon() {
  return (<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8a909a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>);
}
