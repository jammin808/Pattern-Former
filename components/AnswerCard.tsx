import { useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, ChevronDown, Copy, CornerDownRight } from 'lucide-react';
import type { AnalysisMode, AnalysisResult, Claim, EvidenceSource } from '../lib/types';
import { deeperThan, depthOf } from './depth';
import { formatTokens } from './AdminPanel';
import { resultMarkdown } from '../services/client';

type Support = Claim['support'];
const SUPPORT: Record<Support, { label: string; summary: (n: number) => string }> = {
  'quote-matched': { label: 'Quoted', summary: n => `${n} quoted from your sources` },
  inferred: { label: 'Inferred', summary: n => `${n} inferred` },
  unverified: { label: 'Unverified', summary: n => `${n} unverified` },
};
const SUPPORT_ORDER: Support[] = ['quote-matched', 'inferred', 'unverified'];
const CONFIDENCE_STEPS = { LOW: 1, MEDIUM: 2, HIGH: 3, UNKNOWN: 0 } as const;

export function Prose({ text }: { text: string }) {
  return <div className="prose"><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div>;
}

function Disclosure({ title, count, defaultOpen = false, children }: { title: string; count?: number; defaultOpen?: boolean; children: ReactNode }) {
  return <details className="disclosure" open={defaultOpen}>
    <summary><span>{title}{count !== undefined && <span className="count">{count}</span>}</span><ChevronDown size={16} aria-hidden="true"/></summary>
    <div className="disclosure-body">{children}</div>
  </details>;
}

function ClaimItem({ claim, sources }: { claim: Claim; sources: Map<string, EvidenceSource> }) {
  return <li className="claim">
    <div className="claim-row"><p>{claim.text}</p><span className={`support support-${claim.support}`}>{SUPPORT[claim.support].label}</span></div>
    {claim.citations.map((c, i) => <blockquote key={`${c.sourceId}-${i}`} className={c.quoteMatches ? 'quote' : 'quote quote-missing'}>
      <span>“{c.excerpt}”</span>
      <cite>{sources.get(c.sourceId)?.title ?? 'Removed source'} · {c.quoteMatches ? 'found word for word in your source' : 'not found in your source'}</cite>
    </blockquote>)}
    {claim.explanation && <p className="claim-note">{claim.explanation}</p>}
  </li>;
}

interface AnswerCardProps {
  result: AnalysisResult;
  sources: EvidenceSource[];
  isLatest: boolean;
  onFollowUp: (question: string, mode?: AnalysisMode) => void;
}

export function AnswerCard({ result, sources, isLatest, onFollowUp }: AnswerCardProps) {
  const [filter, setFilter] = useState<Support | null>(null);
  const [claimsOpen, setClaimsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const sourceMap = useMemo(() => new Map(sources.map(s => [s.id, s])), [sources]);
  const counts = useMemo(() => SUPPORT_ORDER.map(s => ({ support: s, n: result.claims.filter(c => c.support === s).length })), [result.claims]);
  const depth = depthOf(result.mode);
  const deeper = deeperThan(result.mode);
  const reviewed = result.methodology.steps.length > 2;
  const challenged = result.methodology.steps.length > 1;
  const steps = CONFIDENCE_STEPS[result.confidence];
  const shownClaims = filter ? result.claims.filter(c => c.support === filter) : result.claims;
  const topObjection = [...result.challenges].sort((a, b) => (a.severity === 'HIGH' ? -1 : 0) - (b.severity === 'HIGH' ? -1 : 0))[0];

  const suggestions: { label: string; question: string; mode?: AnalysisMode }[] = [];
  if (topObjection) suggestions.push({ label: 'Answer the strongest objection', question: `Respond to this objection and say what evidence would resolve it: ${topObjection.objection}` });
  if (result.unknowns[0]) suggestions.push({ label: result.unknowns[0], question: `Look into this open question: ${result.unknowns[0]}` });
  if (deeper) suggestions.push({ label: `Ask again as ${depthOf(deeper).label.toLowerCase()}`, question: result.question, mode: deeper });

  function pickFilter(support: Support) {
    setFilter(filter === support ? null : support);
    setClaimsOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(resultMarkdown(result, sources));
      setCopied(true); window.setTimeout(() => setCopied(false), 2000);
    } catch { /* Clipboard blocked: the export menu still works. */ }
  }

  return <article className="answer" aria-label={`Answer to: ${result.question}`}>
    <header className="answer-head">
      <span className="muted">{depth.label} answer{reviewed ? ' · challenged and reviewed' : challenged ? ' · challenged independently' : ''}</span>
      <span className="confidence" title="How strongly the analysis supports its conclusion. Not a probability.">
        Confidence: {result.confidence.toLowerCase()}
        <span className="confidence-meter" aria-hidden="true">{[1, 2, 3].map(i => <span key={i} className={i <= steps ? 'on' : ''}/>)}</span>
      </span>
    </header>

    <div className="conclusion"><Prose text={result.conclusion}/></div>

    {result.claims.length > 0 ? <section className="evidence-summary" aria-label="Evidence behind this answer">
      <div className="evidence-summary-head"><strong>Evidence behind this answer</strong><span className="muted small">{result.claims.length} claims</span></div>
      <div className="evidence-bar" role="img" aria-label={counts.map(c => SUPPORT[c.support].summary(c.n)).join(', ')}>
        {counts.filter(c => c.n).map(c => <span key={c.support} className={`seg-${c.support}`} style={{ flexGrow: c.n }}/>)}
      </div>
      <div className="evidence-filters">
        {counts.filter(c => c.n).map(c => <button key={c.support} type="button" aria-pressed={filter === c.support}
          className={`support support-${c.support}${filter === c.support ? ' active' : ''}`} onClick={() => pickFilter(c.support)}>{SUPPORT[c.support].summary(c.n)}</button>)}
      </div>
    </section> : <p className="evidence-empty muted small">No claims were recorded for this answer.</p>}

    {result.claims.length > 0 && <details className="disclosure" open={claimsOpen} onToggle={e => setClaimsOpen((e.target as HTMLDetailsElement).open)}>
      <summary><span>Claims and evidence<span className="count">{filter ? `${shownClaims.length} of ${result.claims.length}` : result.claims.length}</span></span><ChevronDown size={16} aria-hidden="true"/></summary>
      <div className="disclosure-body">
        {filter && <button type="button" className="link-button" onClick={() => setFilter(null)}>Show all claims</button>}
        <ul className="claims">{shownClaims.map(c => <ClaimItem key={c.id} claim={c} sources={sourceMap}/>)}</ul>
        <p className="muted small">“Quoted” means the words appear in the text you supplied. It does not prove the source is accurate or that the claim follows.</p>
      </div>
    </details>}

    {result.challenges.length > 0 && <Disclosure title={result.mode === 'ADVERSARIAL' ? 'Hostile objections' : 'Objections from the independent challenge'} count={result.challenges.length}>
      <ul className="objections">{result.challenges.map((c, i) => <li key={i}>
        <div className="claim-row"><p><strong>{c.objection}</strong></p><span className={`severity severity-${c.severity.toLowerCase()}`}>{c.severity.toLowerCase()}</span></div>
        <p className="muted">{c.implication}</p>
        <button type="button" className="link-button" onClick={() => onFollowUp(`Respond to this objection and say what evidence would resolve it: ${c.objection}`)}><CornerDownRight size={14}/> Ask about this</button>
      </li>)}</ul>
    </Disclosure>}

    <Disclosure title="How the question was framed">
      <Prose text={result.frame}/>
      {result.hypotheses.length > 0 && <><h4>Competing explanations</h4><ul className="plain-list">{result.hypotheses.map((h, i) => <li key={i}>{h}</li>)}</ul></>}
      {result.assumptions.length > 0 && <><h4>Assumptions</h4><ul className="plain-list">{result.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></>}
    </Disclosure>

    {result.unknowns.length > 0 && <Disclosure title="Open questions" count={result.unknowns.length}>
      <ul className="objections">{result.unknowns.map((u, i) => <li key={i}>
        <p>{u}</p>
        <button type="button" className="link-button" onClick={() => onFollowUp(`Look into this open question: ${u}`)}><CornerDownRight size={14}/> Ask about this</button>
      </li>)}</ul>
    </Disclosure>}

    {isLatest && suggestions.length > 0 && <section className="suggestions" aria-label="Suggested follow-ups">
      <span className="small strong">Ask next</span>
      <div className="chips">{suggestions.map(s => <button key={s.label} type="button" className="chip" onClick={() => onFollowUp(s.question, s.mode)}>{s.label}</button>)}</div>
    </section>}

    <footer className="answer-foot">
      <span>{result.methodology.model} · {(result.methodology.durationMs / 1000).toFixed(0)} s{result.methodology.tokens ? ` · ${formatTokens(result.methodology.tokens.input + result.methodology.tokens.output)} tokens` : ''}</span>
      <button type="button" className="link-button" onClick={() => void copy()}>{copied ? <><Check size={14}/> Copied</> : <><Copy size={14}/> Copy answer</>}</button>
    </footer>
  </article>;
}
