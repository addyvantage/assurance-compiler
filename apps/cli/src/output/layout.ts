const DEFAULT_WIDTH = 72;
const MIN_WIDTH = 40;
const MAX_WIDTH = 80;

/** Layout width for a terminal: comfortable to read, and stable when output is piped. */
export function layoutWidth(columns: number | undefined): number {
  return Math.min(Math.max(columns ?? DEFAULT_WIDTH, MIN_WIDTH), MAX_WIDTH);
}

/** Greedy word wrap. Words longer than `width`, such as long paths, are never split. */
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter((part) => part !== '')) {
    if (line === '') {
      line = word;
    } else if (line.length + 1 + word.length <= width) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/**
 * Wraps `text` after a prefix, aligning continuation lines with the text.
 * `prefixWidth` is the visible width of `prefix`, which may contain colour codes.
 */
export function wrapAfter(
  prefix: string,
  prefixWidth: number,
  text: string,
  width: number,
): string[] {
  const continuation = ' '.repeat(prefixWidth);
  return wrap(text, Math.max(width - prefixWidth, 1)).map(
    (line, index) => `${index === 0 ? prefix : continuation}${line}`,
  );
}

export function indent(lines: readonly string[], spaces = 2): string[] {
  const padding = ' '.repeat(spaces);
  return lines.map((line) => (line === '' ? line : `${padding}${line}`));
}

export function countOf(count: number, singular: string, plural = `${singular}s`): string {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}
