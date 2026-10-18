import { z } from 'zod';

export const evidenceSourceSchema = z.object({
  id: z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
  title: z.string().trim().min(1).max(160),
  url: z.union([z.url().refine(url => /^https?:\/\//i.test(url)), z.literal('')]).optional(),
  content: z.string().trim().min(10).max(12000),
}).strict();

export const analysisRequestSchema = z.object({
  question: z.string().trim().min(4).max(3000),
  mode: z.enum(['LIGHT', 'MEDIUM', 'HEAVY', 'ADVERSARIAL']),
  sources: z.array(evidenceSourceSchema).max(8),
  context: z.string().max(4000).optional(),
}).strict().superRefine((input, ctx) => {
  const ids = new Set(input.sources.map(source => source.id));
  if (ids.size !== input.sources.length) ctx.addIssue({ code: 'custom', message: 'Source IDs must be unique.', path: ['sources'] });
});

export const analystSchema = z.object({
  frame: z.string(),
  assumptions: z.array(z.string()).max(8),
  hypotheses: z.array(z.string()).max(6),
  claims: z.array(z.object({
    text: z.string(),
    kind: z.enum(['observation', 'inference', 'speculation']),
    citations: z.array(z.object({ sourceId: z.string(), excerpt: z.string() })).max(6),
    explanation: z.string(),
  })).max(12),
  conclusion: z.string(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']),
  unknowns: z.array(z.string()).max(8),
});

export const challengeSchema = z.object({
  challenges: z.array(z.object({
    objection: z.string(),
    implication: z.string(),
    severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  })).max(8),
});

export const adjudicationSchema = z.object({
  conclusion: z.string(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']),
  unknowns: z.array(z.string()).max(8),
});

export type AnalystDraft = z.infer<typeof analystSchema>;
export type ChallengerDraft = z.infer<typeof challengeSchema>;
