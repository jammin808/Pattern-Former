import type { Account, AdminUser, AnalysisRequest, AnalysisResult, Investigation, EvidenceSource } from '../lib/types';
// Investigations stay in this browser, kept separately per signed-in user.
const storageKey = (userId: string) => `pattern-former:investigations:v1:${userId}`;
const LEGACY_STORAGE_KEY = 'pattern-former:investigations:v1';

export function readInvestigations(userId: string): Investigation[] {
  try {
    // Investigations saved before sign-in existed move to the first account used in this browser.
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy && !localStorage.getItem(storageKey(userId))) localStorage.setItem(storageKey(userId), legacy);
    if (legacy) localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? (value as Investigation[]).filter(i => i && typeof i.id === 'string' && Array.isArray(i.results)).slice(0, 25) : [];
  } catch { return []; }
}
export function saveInvestigations(userId: string, items: Investigation[]): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(items.slice(0, 25).map(i => ({ ...i, results: i.results.slice(0, 12), sources: i.sources.slice(0, 8) }))));
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: 'same-origin',
    signal: init.signal,
  });
  // Hosting platforms can answer with plain text or HTML (e.g. a crashed or timed-out function).
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { throw new ApiError(res.status, res.ok ? 'The server returned an unreadable response.' : `Server error (HTTP ${res.status}). Check the server logs.`); }
  if (!res.ok) {
    const message = typeof data === 'object' && data !== null && 'error' in data ? String(data.error) : `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const getConfig = () => api<{ googleClientId: string | null }>('/api/config');
export const getAccount = () => api<Account>('/api/me');
export const signInWithGoogle = (credential: string) => api<Account>('/api/auth/google', { method: 'POST', body: { credential } });
export const signOut = () => api<{ ok: true }>('/api/auth/logout', { method: 'POST', body: {} });
export const requestAnalysis = (input: AnalysisRequest, signal?: AbortSignal) =>
  api<AnalysisResult>('/api/analyze', { method: 'POST', body: input, signal });
export const getAdminData = () => api<{ defaultMonthlyTokenLimit: number; users: AdminUser[] }>('/api/admin');
export const updateAdminUser = (id: string, patch: { status?: 'active' | 'blocked'; monthly_token_limit?: number | null }) =>
  api<unknown>('/api/admin', { method: 'PATCH', body: { id, ...patch } });
export const setDefaultLimit = (limit: number) =>
  api<unknown>('/api/admin', { method: 'PUT', body: { defaultMonthlyTokenLimit: limit } });

export function exportJSON(investigation: Investigation): string {
  return JSON.stringify(investigation, null, 2);
}
const DEPTH_NAMES: Record<string, string> = { LIGHT: 'Quick', MEDIUM: 'Balanced', HEAVY: 'Thorough', ADVERSARIAL: 'Stress-test' };

// One question and its answer as Markdown, used for copying a single answer and for full exports.
export function resultMarkdown(run: AnalysisResult, sources: EvidenceSource[], heading = '##'): string {
  const sourceIndex = new Map(sources.map(s => [s.id, s]));
  const lines = [`${heading} ${run.question}`, '',
    `${DEPTH_NAMES[run.mode] ?? run.mode} answer · Confidence: ${run.confidence.toLowerCase()} · ${new Date(run.createdAt).toLocaleString()}`, '',
    `${heading}# Conclusion`, run.conclusion, '', `${heading}# Claims`];
  for (const claim of run.claims) {
    lines.push(`- **${claim.support}** ${claim.text}`);
    for (const c of claim.citations) lines.push(`  - ${sourceIndex.get(c.sourceId)?.title ?? c.sourceId}, quote ${c.quoteMatches ? 'found in source' : 'NOT found in source'}: "${c.excerpt}"`);
  }
  lines.push('', `${heading}# Objections`, ...run.challenges.map(c => `- **${c.severity.toLowerCase()}** ${c.objection} (${c.implication})`),
    '', `${heading}# Framing`, run.frame, '', `${heading}# Open questions`, ...run.unknowns.map(u => `- ${u}`), '');
  return lines.join('\n');
}

export function exportMarkdown(investigation: Investigation): string {
  return [`# ${investigation.name}`, '', 'Pattern-Former report. Sources were supplied by the user and are not independently authenticated.', '',
    ...investigation.results.map(run => resultMarkdown(run, investigation.sources))].join('\n');
}
