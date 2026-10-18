import type { AnalysisRequest, AnalysisResult, Investigation, EvidenceSource } from '../lib/types';
const STORAGE_KEY = 'pattern-former:investigations:v1';

export function readInvestigations(): Investigation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as Investigation[]).filter(i => i && typeof i.id === 'string' && Array.isArray(i.results)).slice(0, 25) : [];
  } catch { return []; }
}
export function saveInvestigations(items: Investigation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 25).map(i => ({ ...i, results: i.results.slice(0, 12), sources: i.sources.slice(0, 8) }))));
}
export async function requestAnalysis(input: AnalysisRequest, signal?: AbortSignal): Promise<AnalysisResult> {
  const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal });
  // Hosting platforms can answer with plain text or HTML (e.g. a crashed or timed-out function).
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { throw new Error(res.ok ? 'The server returned an unreadable response.' : `Server error (HTTP ${res.status}). Check the server logs.`); }
  if (!res.ok) {
    const message = typeof data === 'object' && data !== null && 'error' in data ? String(data.error) : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data as AnalysisResult;
}
export function exportJSON(investigation: Investigation): string {
  return JSON.stringify(investigation, null, 2);
}
export function exportMarkdown(investigation: Investigation): string {
  const sourceIndex = new Map<string, EvidenceSource>(investigation.sources.map(s => [s.id, s]));
  const lines = [`# ${investigation.name}`, '', 'PATTERN-FORMER report. User-supplied sources are NOT independently authenticated.', ''];
  for (const run of investigation.results) {
    lines.push(`## ${run.question}`, '', `Mode: ${run.mode} | Confidence: ${run.confidence} | Date: ${run.createdAt}`, '',
      '### Framing', run.frame, '', '### Conclusion', run.conclusion, '', '### Claims');
    for (const claim of run.claims) {
      lines.push(`- **${claim.id} [${claim.support}]** ${claim.text}`);
      for (const c of claim.citations) lines.push(`  - Source: ${sourceIndex.get(c.sourceId)?.title ?? c.sourceId}; quote ${c.quoteMatches ? 'located' : 'NOT located'}: "${c.excerpt}"`);
    }
    lines.push('', '### Challenges', ...run.challenges.map(c => `- **${c.severity}** ${c.objection} (${c.implication})`), '', '### Uncertainties', ...run.unknowns.map(u => `- ${u}`), '');
  }
  return lines.join('\n');
}
