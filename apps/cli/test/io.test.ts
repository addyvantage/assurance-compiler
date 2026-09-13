import { describe, expect, it } from 'vitest';
import { terminalOutput, type OutputStream } from '../src/io.js';

const terminal: OutputStream = { isTTY: true, columns: 120, write: () => true };
/** Node leaves `isTTY` and `columns` undefined on pipes and redirected files. */
const pipe: OutputStream = { write: () => true };

describe('terminalOutput', () => {
  it('uses colour and the terminal width on a terminal', () => {
    expect(terminalOutput(terminal, {})).toMatchObject({ color: true, columns: 120 });
  });

  it('uses neither colour nor a width when output is piped', () => {
    expect(terminalOutput(pipe, {})).toMatchObject({ color: false, columns: undefined });
  });

  it('honours NO_COLOR', () => {
    expect(terminalOutput(terminal, { NO_COLOR: '1' }).color).toBe(false);
  });

  it('honours FORCE_COLOR, including for piped output', () => {
    expect(terminalOutput(pipe, { FORCE_COLOR: '1' }).color).toBe(true);
    expect(terminalOutput(terminal, { FORCE_COLOR: '0' }).color).toBe(false);
  });

  it('disables colour for dumb terminals', () => {
    expect(terminalOutput(terminal, { TERM: 'dumb' }).color).toBe(false);
  });

  it('writes through to the stream', () => {
    const chunks: string[] = [];

    terminalOutput({ write: (text: string) => chunks.push(text) }, {}).write('plan');

    expect(chunks).toEqual(['plan']);
  });
});
