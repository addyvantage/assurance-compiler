import { describe, expect, it } from 'vitest';
import { layoutWidth, wrap, wrapAfter } from '../src/output/layout.js';

describe('wrap', () => {
  it('breaks between words without exceeding the width', () => {
    expect(wrap('a migration that succeeds on an empty database', 20)).toEqual([
      'a migration that',
      'succeeds on an empty',
      'database',
    ]);
  });

  it('never splits a word longer than the width', () => {
    expect(wrap('see prisma/migrations/20260913_add_age/migration.sql', 10)).toEqual([
      'see',
      'prisma/migrations/20260913_add_age/migration.sql',
    ]);
  });

  it('aligns continuation lines after a prefix', () => {
    expect(wrapAfter('· ', 2, 'one two three four', 10)).toEqual([
      '· one two',
      '  three',
      '  four',
    ]);
  });
});

describe('layoutWidth', () => {
  it('uses a stable width when output is not a terminal', () => {
    expect(layoutWidth(undefined)).toBe(72);
  });

  it('follows the terminal within comfortable bounds', () => {
    expect(layoutWidth(60)).toBe(60);
    expect(layoutWidth(20)).toBe(40);
    expect(layoutWidth(200)).toBe(80);
  });
});
