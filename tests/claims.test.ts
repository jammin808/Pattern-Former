import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteIsPresent, normaliseClaims, formatEvidence } from '../lib/claims';
import { analysisRequestSchema } from '../lib/schema';

const source = { id: 's1', title: 'Study', content: 'The experiment involved 120 volunteers with no random assignment.' };
const draft = {
  frame: 'Study assessment', assumptions: [], hypotheses: [],
  claims: [
    { text: 'The experiment involved 120 people.', kind: 'observation' as const, explanation: '', citations: [{sourceId:'s1', excerpt:'The experiment involved 120 volunteers with no random assignment.'}] },
    { text: 'It proved causality.', kind: 'observation' as const, explanation: '', citations: [{sourceId:'s1', excerpt:'This study conclusively proved causality.'}] },
    { text: 'An alternative is possible.', kind: 'inference' as const, explanation: '', citations: [{sourceId:'s1', excerpt:'The experiment involved 120 volunteers with no random assignment.'}] },
    { text: 'Invented source.', kind: 'observation' as const, explanation: '', citations: [{sourceId:'ghost', excerpt:'An invented source that should never pass.'}] },
  ], conclusion: '', confidence:'LOW' as const, unknowns:[],
};

test('normalised quote verifies presence, not entailment', () => {
  assert.equal(quoteIsPresent(source.content, 'The experiment involved 120   volunteers with no random assignment.'), true);
  assert.equal(quoteIsPresent(source.content, '120 volunteers'), false); // Too short to be a meaningful quote check.
  assert.equal(quoteIsPresent(source.content, 'This study conclusively proved causality.'), false);
});
test('source IDs are allowlisted and non-matching quotations remain unverified', () => {
  const result = normaliseClaims(draft, [source]);
  assert.equal(result[0].support, 'quote-matched');
  assert.equal(result[1].support, 'unverified');
  assert.equal(result[2].support, 'inferred');
  assert.equal(result[3].citations.length, 0);
  assert.equal(result[3].support, 'unverified');
});
test('rejects duplicate source IDs, excessive input and malformed URLs', () => {
  const base = { question:'What happened?', mode:'HEAVY', sources:[source] };
  assert.equal(analysisRequestSchema.safeParse(base).success, true);
  assert.equal(analysisRequestSchema.safeParse({ ...base, sources:[source,source] }).success, false);
  assert.equal(analysisRequestSchema.safeParse({ ...base, question:'x'.repeat(3001) }).success, false);
  assert.equal(analysisRequestSchema.safeParse({ ...base, sources:[{ ...source, url:'file:///etc/passwd' }] }).success, false);
});
test('source text is visibly delimited as untrusted input', () => {
  assert.match(formatEvidence([source]), /UNTRUSTED EXCERPT/);
});
