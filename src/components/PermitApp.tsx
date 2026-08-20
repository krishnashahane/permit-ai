'use client';
import { useEffect, useRef, useState } from 'react';
import type { ExtractedFacts } from '@/lib/types';
import type { ReasonedItem } from '@/lib/rag/reason';
import Home from './views/Home';
import Assess, { type AssessForm } from './views/Assess';
import Pipeline from './views/Pipeline';
import Result, { type VerdictResp } from './views/Result';
import Authority, { type HistoryItem } from './views/Authority';
import { Disclaimer } from './shared';

type View = 'home' | 'assess' | 'pipeline' | 'result' | 'authority';
interface Meta {
  jurisdictions: { id: string; name: string; zones: string[] }[];
  seeds: { id: string; label: string; description: string }[];
  aiEnabled: boolean; model?: string; roles: string[];
}
const NAV: { id: View; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'assess', label: 'Assess' },
  { id: 'result', label: 'Analysis' },
  { id: 'authority', label: 'Authority' },
];

export default function PermitApp() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [role, setRole] = useState('applicant');
  const [view, setView] = useState<View>('home');
  const [scanDone, setScanDone] = useState(false);
  const [pipelineProject, setPipelineProject] = useState('project');
  const [verdict, setVerdict] = useState<VerdictResp | null>(null);
  const [prevScore, setPrevScore] = useState<number | null>(null);
  const [jurisdiction, setJurisdiction] = useState('springfield');
  const [reasoned, setReasoned] = useState<Record<string, ReasonedItem>>({});
  const [reasoning, setReasoning] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const roleRef = useRef(role); roleRef.current = role;

  useEffect(() => { fetch('/api/meta').then((r) => r.json()).then(setMeta).catch(() => {}); }, []);

  async function runAnalysis(doFetch: () => Promise<Response>, projectLabel: string) {
    setError(''); setScanDone(false); setReasoned({}); setPipelineProject(projectLabel); setView('pipeline');
    const started = Date.now();
    try {
      const res = await doFetch();
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Request failed (${res.status})`); }
      const data: VerdictResp = await res.json();
      const elapsed = Date.now() - started;
      if (elapsed < 1900) await new Promise((r) => setTimeout(r, 1900 - elapsed));
      setScanDone(true);
      setPrevScore(verdict && verdict.submissionId !== data.submissionId ? verdict.readinessScore : verdict ? prevScore : null);
      setVerdict(data);
      setHistory((h) => [{ verdict: data, applicant: data.meta.ownerMasked || '—', projectType: data.facts.projectType, when: new Date().toISOString() }, ...h].slice(0, 30));
      setView('result');
      streamReasoning(data);
    } catch (e) { setError((e as Error).message); setView('assess'); }
  }

  function analyzeSample(id: string) {
    const seed = meta?.seeds.find((s) => s.id === id);
    runAnalysis(() => fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-permit-role': roleRef.current }, body: JSON.stringify({ exampleId: id }) }), seed?.label || id);
  }
  function analyzeUpload(f: AssessForm) {
    setJurisdiction(f.jurisdiction);
    const fd = new FormData();
    fd.set('jurisdiction', f.jurisdiction); fd.set('description', f.description); fd.set('owner', f.owner);
    fd.set('address', f.address); fd.set('projectType', f.projectType); fd.set('sqFt', f.sqFt);
    f.files.forEach((file) => fd.append('files', file));
    runAnalysis(() => fetch('/api/analyze', { method: 'POST', headers: { 'x-permit-role': roleRef.current }, body: fd }), f.address || f.projectType);
  }
  function reRun(edits: Partial<ExtractedFacts>) {
    if (!verdict) return;
    const mergedFacts = { ...verdict.facts, ...edits };
    runAnalysis(() => fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-permit-role': roleRef.current }, body: JSON.stringify({ facts: mergedFacts, jurisdiction, description: '', owner: '', address: '' }) }), 'revised submission');
  }
  async function streamReasoning(v: VerdictResp) {
    const checks = [...v.violations, ...v.warnings, ...v.reviewItems];
    if (checks.length === 0) return;
    setReasoning(true);
    try {
      const res = await fetch('/api/reason', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-permit-role': roleRef.current }, body: JSON.stringify({ checks }) });
      const reader = res.body?.getReader(); if (!reader) return;
      const dec = new TextDecoder(); let buf = '';
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop() || '';
        for (const p of parts) { const l = p.trim(); if (!l.startsWith('data:')) continue; const evt = JSON.parse(l.slice(5).trim()); if (evt.type === 'item') setReasoned((r) => ({ ...r, [evt.item.checkId]: evt.item })); }
      }
    } catch { /* best-effort */ } finally { setReasoning(false); }
  }
  async function exportPdf() {
    if (!verdict) return;
    const res = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-permit-role': roleRef.current }, body: JSON.stringify(verdict) });
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `permitai-report-${verdict.assessmentId}.pdf`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-bg">
      <TopBar meta={meta} role={role} setRole={setRole} view={view} setView={setView} hasResult={!!verdict} />
      <main className="mx-auto max-w-content px-6 py-10 sm:px-8">
        {view === 'home' && <Home meta={meta} onStart={() => setView('assess')} onSample={analyzeSample} />}
        {view === 'assess' && <Assess meta={meta} onRun={analyzeUpload} error={error} />}
        {view === 'pipeline' && <Pipeline done={scanDone} project={pipelineProject} />}
        {view === 'result' && verdict && <Result verdict={verdict} prevScore={prevScore} reasoned={reasoned} reasoning={reasoning} role={role} jurisdictionId={jurisdiction} onReRun={reRun} onExport={exportPdf} onNew={() => setView('assess')} />}
        {view === 'result' && !verdict && <Empty onStart={() => setView('assess')} onSample={() => analyzeSample('six-violations')} />}
        {view === 'authority' && <Authority history={history} onOpen={(i) => { setVerdict(history[i].verdict as VerdictResp); setView('result'); }} />}
      </main>
      <footer className="mx-auto max-w-content px-6 pb-12 sm:px-8">
        <hr className="divider mb-6" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Disclaimer />
          <p className="text-meta text-ink3">Extraction · deterministic rules · grounded citations</p>
        </div>
      </footer>
    </div>
  );
}

function TopBar({ meta, role, setRole, view, setView, hasResult }: {
  meta: Meta | null; role: string; setRole: (r: string) => void; view: View; setView: (v: View) => void; hasResult: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-content items-center justify-between gap-4 px-6 sm:px-8">
        <button onClick={() => setView('home')} className="flex items-center gap-2.5" aria-label="PermitAI home">
          <Mark />
          <span className="text-[0.95rem] font-semibold tracking-tight text-ink">PermitAI</span>
        </button>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((n) => {
            const disabled = n.id === 'result' && !hasResult;
            const active = view === n.id || (n.id === 'result' && view === 'pipeline');
            return (
              <button key={n.id} onClick={() => !disabled && setView(n.id)} disabled={disabled}
                aria-current={active ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition ${active ? 'font-medium text-ink' : 'text-ink2 hover:text-ink'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}>
                {n.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {meta?.aiEnabled && <span className="hidden text-meta text-ink3 lg:inline">Assisted analysis</span>}
          <label className="sr-only" htmlFor="role">Role</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border border-line2 bg-surface px-2.5 py-1.5 text-sm capitalize text-ink outline-none focus:border-accent">
            {(meta?.roles || ['applicant', 'architect', 'official']).map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
          </select>
        </div>
      </div>
    </header>
  );
}

// Simple geometric mark — a plan sheet with a compliance check. No AI iconography.
function Mark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent" aria-hidden>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l5 5v13a0 0 0 0 1 0 0H6a0 0 0 0 1 0 0z" /><path d="M9 13l2.5 2.5L16 11" /></svg>
    </span>
  );
}

function Empty({ onStart, onSample }: { onStart: () => void; onSample: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h2 className="text-xl font-semibold text-ink">No assessment yet</h2>
      <p className="mt-2 text-base text-ink2">Start with a building plan, or explore a sample project.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={onStart} className="btn btn-primary px-5 py-2.5">Start assessment</button>
        <button onClick={onSample} className="btn btn-secondary px-5 py-2.5">Try a sample</button>
      </div>
    </div>
  );
}
