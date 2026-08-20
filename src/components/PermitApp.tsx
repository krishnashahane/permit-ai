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

  useEffect(() => { fetch('/api/meta').then((r) => r.json()).then(setMeta).catch(() => {}); }, []);
  // Role comes from the server-verified session cookie, not local state.
  useEffect(() => { fetch('/api/session').then((r) => r.json()).then((d) => setRole(d.role || 'applicant')).catch(() => {}); }, []);

  // Attempt to assume a role. Privileged roles require an access code checked
  // server-side; returns an error string on failure, or null on success.
  async function assumeRole(next: string, code?: string): Promise<string | null> {
    try {
      if (next === 'applicant') { await fetch('/api/session', { method: 'DELETE' }); setRole('applicant'); return null; }
      const res = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: next, code }) });
      const data = await res.json();
      if (!res.ok) return data.error || 'Could not switch role.';
      setRole(data.role); return null;
    } catch { return 'Network error.'; }
  }

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
    runAnalysis(() => fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exampleId: id }) }), seed?.label || id);
  }
  function analyzeUpload(f: AssessForm) {
    setJurisdiction(f.jurisdiction);
    const fd = new FormData();
    fd.set('jurisdiction', f.jurisdiction); fd.set('description', f.description); fd.set('owner', f.owner);
    fd.set('address', f.address); fd.set('projectType', f.projectType); fd.set('sqFt', f.sqFt);
    f.files.forEach((file) => fd.append('files', file));
    runAnalysis(() => fetch('/api/analyze', { method: 'POST', body: fd }), f.address || f.projectType);
  }
  function reRun(edits: Partial<ExtractedFacts>) {
    if (!verdict) return;
    const mergedFacts = { ...verdict.facts, ...edits };
    runAnalysis(() => fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ facts: mergedFacts, jurisdiction, description: '', owner: '', address: '' }) }), 'revised submission');
  }
  async function streamReasoning(v: VerdictResp) {
    const checks = [...v.violations, ...v.warnings, ...v.reviewItems];
    if (checks.length === 0) return;
    setReasoning(true);
    try {
      const res = await fetch('/api/reason', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checks }) });
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
    const res = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(verdict) });
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `permitai-report-${verdict.assessmentId}.pdf`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-bg">
      <TopBar meta={meta} role={role} assumeRole={assumeRole} view={view} setView={setView} hasResult={!!verdict} />
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

function TopBar({ meta, role, assumeRole, view, setView, hasResult }: {
  meta: Meta | null; role: string; assumeRole: (r: string, code?: string) => Promise<string | null>;
  view: View; setView: (v: View) => void; hasResult: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const go = (v: View) => { setView(v); setMobileOpen(false); };
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-content items-center justify-between gap-4 px-6 sm:px-8">
        <button onClick={() => go('home')} className="flex items-center gap-2.5" aria-label="PermitAI home">
          <Mark />
          <span className="text-[0.95rem] font-semibold tracking-tight text-ink">PermitAI</span>
        </button>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.map((n) => {
            const disabled = n.id === 'result' && !hasResult;
            const active = view === n.id || (n.id === 'result' && view === 'pipeline');
            return (
              <button key={n.id} onClick={() => !disabled && go(n.id)} disabled={disabled} aria-current={active ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition ${active ? 'font-medium text-ink' : 'text-ink2 hover:text-ink'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}>
                {n.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <AiBadge meta={meta} />
          <div className="hidden md:block"><RoleMenu role={role} assumeRole={assumeRole} /></div>
          <button onClick={() => setMobileOpen((o) => !o)} aria-label="Menu" aria-expanded={mobileOpen}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line2 bg-surface md:hidden">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {mobileOpen ? <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></> : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-line bg-bg md:hidden">
          <nav className="mx-auto max-w-content px-6 py-3" aria-label="Mobile">
            {NAV.map((n) => {
              const disabled = n.id === 'result' && !hasResult;
              return (
                <button key={n.id} onClick={() => !disabled && go(n.id)} disabled={disabled}
                  className={`block w-full rounded-md px-2 py-2.5 text-left text-base ${view === n.id ? 'font-medium text-ink' : 'text-ink2'} ${disabled ? 'opacity-40' : ''}`}>
                  {n.label}
                </button>
              );
            })}
            <div className="mt-2 border-t border-line pt-3"><RoleMenu role={role} assumeRole={assumeRole} /></div>
          </nav>
        </div>
      )}
    </header>
  );
}

// Role menu with a server-verified access-code gate for privileged roles.
function RoleMenu({ role, assumeRole }: { role: string; assumeRole: (r: string, code?: string) => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  async function pick(next: string) {
    setErr('');
    if (next === 'applicant' || next === role) { await assumeRole(next); setOpen(false); setPending(null); return; }
    setPending(next);
  }
  async function submit() {
    if (!pending) return;
    const e = await assumeRole(pending, code);
    if (e) { setErr(e); return; }
    setCode(''); setPending(null); setOpen(false);
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-line2 bg-surface px-2.5 py-1.5 text-sm capitalize text-ink">
        {role}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1.5 w-64 rounded-lg border border-line bg-surface p-1.5 shadow-card">
          {['applicant', 'architect', 'official'].map((r) => (
            <button key={r} role="menuitem" onClick={() => pick(r)}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm capitalize hover:bg-surface2 ${r === role ? 'text-ink' : 'text-ink2'}`}>
              {r}
              {r !== 'applicant' && <span className="text-meta text-ink3">access code</span>}
              {r === role && <span className="text-success">✓</span>}
            </button>
          ))}
          {pending && (
            <div className="mt-1 border-t border-line p-2">
              <p className="mb-1.5 text-meta text-ink3">Enter the <span className="capitalize">{pending}</span> access code</p>
              <div className="flex gap-1.5">
                <input type="password" value={code} autoFocus onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="Access code" aria-label={`${pending} access code`} className="field flex-1 py-1.5" />
                <button onClick={submit} className="btn btn-primary px-3 py-1.5">Enter</button>
              </div>
              {err && <p className="mt-1.5 text-meta text-danger">{err}</p>}
              <p className="mt-1.5 text-meta text-ink3">Demo codes: architect <code>demo-architect</code>, official <code>demo-official</code>.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AiBadge({ meta }: { meta: Meta | null }) {
  if (!meta) return null;
  const on = meta.aiEnabled;
  return (
    <span
      title={on
        ? 'AI assists document extraction and generates grounded explanations. Every pass/fail decision is made by the deterministic rule engine.'
        : 'AI extraction unavailable — results come from the deterministic rule engine only. Verdicts are unaffected.'}
      className={`hidden items-center gap-1.5 rounded-md px-2 py-1 text-meta lg:inline-flex ${on ? 'text-ink2' : 'text-warning'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-success' : 'bg-warning'}`} />
      {on ? 'Assisted analysis' : 'Rule engine only'}
    </span>
  );
}

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
