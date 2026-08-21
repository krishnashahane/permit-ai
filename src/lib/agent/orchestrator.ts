import type { AgentRun, AgentStep, ExtractedFacts, Verdict } from '@/lib/types';

// PermitAI compliance agent — orchestration + trace.
//
// The agent runs a fixed sequence of TOOLS and records what each did:
//   validate → classify → extract → retrieve regulations → evaluate rules →
//   decide (yes/no) → corrections.
//
// Design rule (non-negotiable): the DECISION is made by the deterministic rule
// engine, never by an LLM. The LLM is used only as tools inside the agent
// (reading plans, explaining results). This keeps every yes/no auditable and
// reproducible while still being "agentic".

export interface AgentContext {
  source: 'upload' | 'sample' | 'manual';
  documentCount?: number;
  documentType?: string;
  extractedCount?: number;
  missingCount?: number;
  regulationCount: number;
}

export function buildAgentRun(verdict: Verdict, facts: ExtractedFacts, ctx: AgentContext): AgentRun {
  const steps: AgentStep[] = [];

  if (ctx.source === 'upload') {
    steps.push({ tool: 'validate', label: 'Documents validated & scanned', status: 'ok', detail: `${ctx.documentCount ?? 0} file(s)` });
    steps.push({ tool: 'classify', label: 'Document classified as building plan', status: 'ok', detail: ctx.documentType || 'building document' });
    steps.push({ tool: 'extract', label: 'Building parameters extracted', status: 'ok', detail: `${ctx.extractedCount ?? 0} read${ctx.missingCount ? `, ${ctx.missingCount} not found` : ''}` });
  } else {
    steps.push({ tool: 'extract', label: ctx.source === 'sample' ? 'Sample project parameters loaded' : 'Provided parameters used', status: 'ok', detail: facts.zoneType });
  }

  steps.push({ tool: 'retrieve', label: 'Applicable regulations retrieved', status: 'ok', detail: `${ctx.regulationCount} sections` });
  steps.push({ tool: 'evaluate', label: 'Compliance rules evaluated', status: 'ok', detail: `${verdict.rulesEvaluated} rules` });

  const decision: AgentRun['decision'] = verdict.verdict === 'PASS' ? 'APPROVE' : 'REJECT';
  steps.push({
    tool: 'decide',
    label: decision === 'APPROVE' ? 'Decision: ready to submit' : 'Decision: corrections required',
    status: 'ok',
    detail: `${verdict.readinessScore}/100`,
  });

  if (decision === 'REJECT') {
    steps.push({ tool: 'correct', label: 'Required corrections identified', status: 'ok', detail: `${verdict.violations.length} item(s)` });
  }

  return { decision, corrections: verdict.violations.length, steps };
}
