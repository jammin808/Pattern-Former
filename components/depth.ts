import type { AnalysisMode, Investigation } from '../lib/types';

export interface Depth {
  mode: AnalysisMode;
  label: string;
  summary: string;
  calls: string;
  stages: string[];
}

// Plain-language names for the API's analysis modes. Call counts mirror lib/reasoning.ts.
export const DEPTHS: Depth[] = [
  { mode: 'LIGHT', label: 'Quick', summary: 'One pass. Fastest and cheapest.', calls: '1 model call',
    stages: ['Building the answer and its claims'] },
  { mode: 'MEDIUM', label: 'Balanced', summary: 'Adds an independent challenge.', calls: '2 model calls, run together',
    stages: ['Building the answer and its claims', 'Challenging it independently, in parallel'] },
  { mode: 'HEAVY', label: 'Thorough', summary: 'Challenge, then a review that can revise the conclusion.', calls: '3 model calls',
    stages: ['Building the answer and its claims', 'Challenging it independently, in parallel', 'Reviewing the conclusion against the objections'] },
  { mode: 'ADVERSARIAL', label: 'Stress-test', summary: 'Thorough, with deliberately hostile objections.', calls: '3 model calls',
    stages: ['Building the answer and its claims', 'Raising hostile objections, in parallel', 'Reviewing the conclusion against the objections'] },
];

export const depthOf = (mode: AnalysisMode): Depth => DEPTHS.find(d => d.mode === mode) ?? DEPTHS[1];

export function deeperThan(mode: AnalysisMode): AnalysisMode | null {
  const index = DEPTHS.findIndex(d => d.mode === mode);
  return index >= 0 && index < DEPTHS.length - 1 ? DEPTHS[index + 1].mode : null;
}

// Median duration of this browser's recent runs at a depth, so waiting times come from real history.
export function typicalSeconds(items: Investigation[], mode: AnalysisMode): number | null {
  const durations = items.flatMap(i => i.results).filter(r => r.mode === mode)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10)
    .map(r => r.methodology.durationMs).sort((a, b) => a - b);
  if (!durations.length) return null;
  return Math.round(durations[Math.floor(durations.length / 2)] / 1000);
}
