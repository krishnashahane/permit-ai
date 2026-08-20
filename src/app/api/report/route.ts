import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { ADVISORY_DISCLAIMER } from '@/lib/rules/engine';
import { appendAudit } from '@/lib/audit/log';
import { resolveRole } from '@/lib/auth/rbac';
import type { Verdict } from '@/lib/types';

export const runtime = 'nodejs';

// Exportable preliminary compliance report. The advisory disclaimer is stamped
// into the document itself. Suitable to hand to an architect/applicant/reviewer;
// it is explicitly NOT an official permit approval.
export async function POST(req: Request) {
  const role = resolveRole(req);
  const v = (await req.json()) as Verdict & { meta?: { addressMasked?: string; ownerMasked?: string } };

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  const W = 595, contentW = W - margin * 2;
  let page = pdf.addPage([W, 842]);
  let y = 812;

  const NAVY = rgb(0.06, 0.09, 0.14);
  const MUT = rgb(0.42, 0.46, 0.52);
  const PASS = rgb(0.13, 0.65, 0.35), FAIL = rgb(0.88, 0.28, 0.23), WARN = rgb(0.85, 0.53, 0.05);

  const nl = (h: number) => { y -= h; if (y < 60) { page = pdf.addPage([W, 842]); y = 812; } };
  const text = (s: string, size = 10, f: PDFFont = font, color = NAVY, x = margin) => {
    for (const ln of wrap(ascii(s), f, size, contentW - (x - margin))) { if (y < 56) { page = pdf.addPage([W, 842]); y = 812; } page.drawText(ln, { x, y, size, font: f, color }); y -= size + 4; }
  };
  const rule = () => { nl(6); page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.5, color: rgb(0.85, 0.87, 0.9) }); nl(10); };
  const heading = (s: string) => { nl(6); text(s, 12, bold, NAVY); nl(2); };

  // Banner
  const pass = v.verdict === 'PASS';
  page.drawRectangle({ x: 0, y: 812, width: W, height: 30, color: rgb(0.18, 0.43, 0.96) });
  page.drawText('PermitAI - Preliminary Compliance Report', { x: margin, y: 820, size: 13, font: bold, color: rgb(1, 1, 1) });
  y = 792;

  text(`${pass ? 'READY' : 'NOT READY'}   -   Readiness ${v.readinessScore}/100`, 16, bold, pass ? PASS : FAIL);
  text(`Assessment ID: ${v.assessmentId}`, 9, font, MUT);
  text(`Jurisdiction: ${v.jurisdiction} (v${v.jurisdictionVersion})`, 9, font, MUT);
  text(`Generated: ${new Date(v.generatedAt).toLocaleString()}`, 9, font, MUT);
  if (v.meta?.addressMasked) text(`Property (masked): ${v.meta.addressMasked}`, 9, font, MUT);

  // Disclaimer box
  nl(6);
  page.drawRectangle({ x: margin - 6, y: y - 42, width: contentW + 12, height: 50, color: rgb(0.99, 0.96, 0.89), borderColor: rgb(0.85, 0.62, 0.15), borderWidth: 1 });
  nl(2); text('ADVISORY DISCLAIMER', 9, bold, WARN); text(ADVISORY_DISCLAIMER, 8, font, rgb(0.4, 0.32, 0.12)); nl(6);

  // Summary
  rule(); heading('Compliance Summary');
  text(`Passed: ${v.summary.passed}    Failed: ${v.summary.failed}    Warnings: ${v.summary.warnings}    Informational: ${v.summary.informational}    (Rules evaluated: ${v.rulesEvaluated})`, 10, font, NAVY);
  nl(4);
  for (const c of v.categoryScores) drawBar(page, margin, (y -= 16), contentW, c.label, c.score, bold, font, NAVY);
  nl(6);

  // Extracted parameters
  rule(); heading('AI-Extracted Parameters');
  const f = v.facts;
  const params: [string, string][] = [
    ['Plot area', `${f.lotAreaSqFt} sq ft`], ['Built-up area', `${f.floorAreaSqFt} sq ft`], ['FAR', `${f.far}`],
    ['Front setback', `${f.frontSetbackFt} ft`], ['Rear setback', `${f.rearSetbackFt} ft`], ['Side setback', `${f.sideSetbackFt} ft`],
    ['Building height', `${f.buildingHeightFt} ft`], ['Floors', `${f.stories}`], ['Parking', `${f.parkingSpaces} spaces`],
    ['Egress width', `${f.egressWidthIn} in`], ['Fire separation', `${f.fireSeparationDistanceFt} ft`], ['Zone', f.zoneType],
  ];
  for (let i = 0; i < params.length; i += 2) {
    const line = params.slice(i, i + 2).map(([k, val]) => `${k}: ${val}`).join('        ');
    text(line, 9, font, NAVY);
  }

  // Violations
  if (v.violations.length) {
    rule(); heading(`Violations (${v.violations.length})`);
    v.violations.forEach((c, i) => {
      text(`${i + 1}. ${c.label}  [${c.severity.toUpperCase()}]  -  ${c.codeSection}`, 10, bold, FAIL);
      text(`Detected ${c.measured}   Required ${c.required}   Difference ${c.difference ?? '-'}`, 9, font, NAVY);
      if (c.fixSuggestion) text(`Suggested correction: ${c.fixSuggestion}`, 9, font, MUT);
      nl(4);
    });
  } else { rule(); heading('Violations'); text('No blocking violations. All deterministic checks passed.', 10, font, PASS); }

  if (v.warnings.length) { rule(); heading(`Warnings (${v.warnings.length})`); v.warnings.forEach((c) => text(`- ${c.label}: ${c.measured} (near limit ${c.required}) - ${c.codeSection}`, 9, font, WARN)); }
  if (v.reviewItems.length) { rule(); heading(`Informational (${v.reviewItems.length})`); v.reviewItems.forEach((c) => text(`- ${c.label} - ${c.codeSection}`, 9, font, NAVY)); }

  // Regulations used
  rule(); heading('Regulations Used');
  const secs = Array.from(new Set(v.checks.map((c) => c.codeSection)));
  secs.forEach((s) => text(`- ${s}`, 9, font, NAVY));

  // Audit
  rule(); heading('Audit Information');
  text(`Assessment ID: ${v.assessmentId}`, 9, font, MUT);
  text(`Submission UUID: ${v.submissionId}`, 9, font, MUT);
  text(`Regulation set: ${v.jurisdiction} v${v.jurisdictionVersion}   Rules evaluated: ${v.rulesEvaluated}`, 9, font, MUT);
  text(`Extraction source: ${v.facts._source}   Fast-path: ${v.elapsedMs} ms`, 9, font, MUT);

  nl(10);
  text('This report is a preliminary self-assessment and is not a permit, approval, or legal determination by any authority.', 8, font, MUT);

  appendAudit(role, 'EXPORT_REPORT', v.submissionId, { assessmentId: v.assessmentId, verdict: v.verdict, readinessScore: v.readinessScore });

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="permitai-report-${v.assessmentId}.pdf"` },
  });
}

function drawBar(page: PDFPage, x: number, y: number, w: number, label: string, score: number, bold: PDFFont, font: PDFFont, navy: ReturnType<typeof rgb>) {
  page.drawText(ascii(label), { x, y, size: 9, font, color: navy });
  const barX = x + 140, barW = w - 180;
  page.drawRectangle({ x: barX, y: y - 1, width: barW, height: 7, color: rgb(0.9, 0.92, 0.94) });
  const col = score >= 85 ? rgb(0.13, 0.65, 0.35) : score >= 60 ? rgb(0.85, 0.53, 0.05) : rgb(0.88, 0.28, 0.23);
  page.drawRectangle({ x: barX, y: y - 1, width: (barW * score) / 100, height: 7, color: col });
  page.drawText(`${score}%`, { x: barX + barW + 8, y, size: 9, font: bold, color: navy });
}

function ascii(s: string): string {
  return s.replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[–—]/g, '-').replace(/[·•]/g, '-').replace(/→/g, '->').replace(/…/g, '...').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[−]/g, '-').replace(/✓/g, 'ok').replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '');
}
function wrap(t: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = t.split(/\s+/); const lines: string[] = []; let cur = '';
  for (const w of words) { const test = cur ? cur + ' ' + w : w; if (font.widthOfTextAtSize(test, size) > maxWidth && cur) { lines.push(cur); cur = w; } else cur = test; }
  if (cur) lines.push(cur); return lines.length ? lines : [''];
}
