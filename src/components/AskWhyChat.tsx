'use client';
import { useState } from 'react';
import type { RuleCheck, Citation } from '@/lib/types';

// Grounded follow-up for a single issue. Every answer is backed by retrieved
// code citations; the endpoint refuses when nothing is retrieved.
export default function AskWhyChat({ check, role }: { check: RuleCheck; role: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<{ q: string; a: string; citations: Citation[] }[]>([]);

  async function ask() {
    if (!q.trim() || loading) return;
    const question = q.trim(); setQ(''); setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-permit-role': role },
        body: JSON.stringify({ question, check }),
      });
      const data = await res.json();
      setMsgs((m) => [...m, { q: question, a: data.answer, citations: data.citations || [] }]);
    } catch {
      setMsgs((m) => [...m, { q: question, a: 'Request failed.', citations: [] }]);
    } finally { setLoading(false); }
  }

  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn-text text-sm">
        {open ? 'Hide question' : 'Ask a question'}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {msgs.map((m, i) => (
            <div key={i} className="rounded-md bg-surface2 p-3.5 text-sm">
              <p className="mb-1 text-ink3">{m.q}</p>
              <p className="text-ink">{m.a}</p>
              {m.citations.length > 0 && (
                <p className="mt-2 text-meta text-ink2">Grounded in {m.citations.map((c) => c.citation).join(', ')}</p>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()}
              placeholder="e.g. Why is this the minimum?" aria-label="Ask a question about this issue" className="field flex-1" />
            <button onClick={ask} disabled={loading} className="btn btn-secondary px-3.5 py-2">{loading ? '…' : 'Ask'}</button>
          </div>
          <p className="helper">Answers are grounded only in retrieved code sections.</p>
        </div>
      )}
    </div>
  );
}
