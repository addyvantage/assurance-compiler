import { describe, expect, it } from 'vitest';
import { reduceVerdict, type AssuranceState, type Verdict } from '../src/index.js';

describe('reduceVerdict', () => {
  it.each<{ name: string; states: AssuranceState[]; verdict: Verdict }>([
    { name: 'all PROVEN', states: ['PROVEN', 'PROVEN'], verdict: 'COMPLETE' },
    { name: 'one MISSING', states: ['PROVEN', 'MISSING'], verdict: 'INCOMPLETE' },
    { name: 'one NOT_PROVEN', states: ['PROVEN', 'NOT_PROVEN'], verdict: 'INCOMPLETE' },
    { name: 'one FAILED', states: ['PROVEN', 'FAILED'], verdict: 'FAILED' },
    { name: 'FAILED before MISSING', states: ['FAILED', 'MISSING'], verdict: 'FAILED' },
    { name: 'FAILED after NOT_PROVEN', states: ['NOT_PROVEN', 'FAILED'], verdict: 'FAILED' },
    {
      name: 'PROVEN and NOT_APPLICABLE',
      states: ['PROVEN', 'NOT_APPLICABLE'],
      verdict: 'COMPLETE',
    },
    {
      name: 'MISSING and NOT_APPLICABLE',
      states: ['NOT_APPLICABLE', 'MISSING'],
      verdict: 'INCOMPLETE',
    },
  ])('$name → $verdict', ({ states, verdict }) => {
    expect(reduceVerdict(states)).toBe(verdict);
  });

  it('is vacuously COMPLETE when no requirement applies', () => {
    expect(reduceVerdict([])).toBe('COMPLETE');
    expect(reduceVerdict(['NOT_APPLICABLE'])).toBe('COMPLETE');
  });

  it('never treats missing evidence as failed evidence', () => {
    expect(reduceVerdict(['MISSING', 'MISSING'])).toBe('INCOMPLETE');
  });
});
