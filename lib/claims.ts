import type { AnalystDraft } from './schema.js';
import type { Claim, EvidenceSource } from './types.js';

// Matching a literal excerpt to supplied material confirms quotation presence only.
// It does not confirm that the material is authentic, accurate, or entails the claim.
export function quoteIsPresent(sourceContent: string, excerpt: string): boolean {
  const normalise = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
  const needle = normalise(excerpt);
  return needle.length >= 20 && normalise(sourceContent).includes(needle);
}

export function normaliseClaims(draft: AnalystDraft, sources: EvidenceSource[]): Claim[] {
  const byId = new Map(sources.map(source => [source.id, source]));
  return draft.claims.map((claim, index) => {
    const citations = claim.citations
      .filter(citation => byId.has(citation.sourceId))
      .map(citation => ({
        sourceId: citation.sourceId,
        excerpt: citation.excerpt,
        quoteMatches: quoteIsPresent(byId.get(citation.sourceId)!.content, citation.excerpt),
      }));
    const verifiedQuote = citations.some(citation => citation.quoteMatches);
    const support: Claim['support'] = claim.kind === 'inference'
      ? 'inferred'
      : claim.kind === 'speculation' ? 'unverified'
      : verifiedQuote ? 'quote-matched' : 'unverified';
    return { id: `C-${String(index + 1).padStart(3, '0')}`, text: claim.text, kind: claim.kind, citations, support, explanation: claim.explanation };
  });
}

export function formatEvidence(sources: EvidenceSource[]): string {
  if (sources.length === 0) return 'No source documents were provided. Do not claim to have verified outside facts.';
  return sources.map(s => `SOURCE_ID: ${s.id}\nTITLE: ${s.title}\nURL (UNVERIFIED): ${s.url || 'Not supplied'}\nUNTRUSTED EXCERPT:\n<source>\n${s.content}\n</source>`).join('\n\n');
}
