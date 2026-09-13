import { describe, expect, it } from 'vitest';
import { safeNext } from '../lib/safe-next';
import { runStatus } from '../lib/status-kind';

describe('safeNext', () => {
  it('keeps same-origin paths with their query', () => {
    expect(safeNext('/device?user_code=AB12CD34')).toBe('/device?user_code=AB12CD34');
  });

  it.each([
    '//evil.example',
    '/\t/evil.example',
    '/\\evil.example',
    'https://evil.example',
    undefined,
  ])('refuses %j', (value) => {
    expect(safeNext(value)).toBe('/repositories');
  });
});

describe('runStatus', () => {
  it('is green only for a proven requirement', () => {
    expect(runStatus('COMPLETE', 'reported', 'PROVEN').kind).toBe('proven');
    expect(runStatus('COMPLETE', 'reported', 'NONE').kind).toBe('nothing');
    expect(runStatus('COMPLETE', 'reported', 'NOT_APPLICABLE').kind).toBe('nothing');
  });

  it('never reads a stale or running run as failed', () => {
    expect(runStatus(null, 'stale', null).kind).toBe('stale');
    expect(runStatus(null, 'live', null).kind).toBe('running');
  });
});
