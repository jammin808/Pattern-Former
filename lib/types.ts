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
  methodology: { steps: string[]; model: string; durationMs: number };
}
export interface Investigation {
  id: string;
  name: string;
  createdAt: string;
  sources: EvidenceSource[];
  results: AnalysisResult[];
}
