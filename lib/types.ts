export type AnalysisMode = 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'ADVERSARIAL';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface EvidenceSource {
  id: string;
  title: string;
  url?: string;
  content: string; // Text supplied by a user, not automatically authenticated or retrieved.
}
export interface AnalysisRequest {
  question: string;
  mode: AnalysisMode;
  sources: EvidenceSource[];
  context?: string;
}
export interface Citation {
  sourceId: string;
  excerpt: string;
  quoteMatches: boolean;
}
export interface Claim {
  id: string;
  text: string;
  kind: 'observation' | 'inference' | 'speculation';
  citations: Citation[];
  support: 'quote-matched' | 'inferred' | 'unverified';
  explanation: string;
}
export interface Challenge {
  objection: string;
  implication: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}
export interface AnalysisResult {
  id: string;
  question: string;
  mode: AnalysisMode;
  createdAt: string;
  frame: string;
  assumptions: string[];
  hypotheses: string[];
  claims: Claim[];
  challenges: Challenge[];
  conclusion: string;
  confidence: Confidence;
  unknowns: string[];
  // tokens is absent on results saved before usage tracking existed.
  methodology: { steps: string[]; model: string; durationMs: number; tokens?: { input: number; output: number } };
}
export interface Investigation {
  id: string;
  name: string;
  createdAt: string;
  sources: EvidenceSource[];
  results: AnalysisResult[];
}
export interface Allowance {
  monthTokens: number;
  limit: number | null; // null means unlimited (admins)
}
export interface Account {
  user: { id: string; email: string; name: string | null; picture: string | null; status: 'active' | 'blocked'; isAdmin: boolean };
  allowance: Allowance;
}
export interface AdminUser {
  id: string; email: string; name: string | null; picture: string | null; status: 'active' | 'blocked';
  monthly_token_limit: number | null; created_at: string; last_seen_at: string;
  month_tokens: number; month_runs: number; lifetime_tokens: number; isAdmin: boolean;
}
