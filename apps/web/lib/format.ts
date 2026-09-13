export function short(id: string): string {
  return id.slice(0, 7);
}

const absolute = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "13 Sep, 10:02" in the viewer's locale conventions; the full ISO string goes in a title. */
export function when(date: Date | string): string {
  return absolute.format(typeof date === 'string' ? new Date(date) : date);
}

export function iso(date: Date | string): string {
  return (typeof date === 'string' ? new Date(date) : date).toISOString();
}

/** Relative wording for recency, never for durations. */
export function ago(date: Date | string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(date).getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${String(minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${String(hours)} h ago`;
  const days = Math.round(hours / 24);
  return `${String(days)} d ago`;
}

export function duration(ms: number | undefined): string {
  if (ms === undefined) return '';
  return ms < 10_000 ? `${(ms / 1000).toFixed(1)} s` : `${String(Math.round(ms / 1000))} s`;
}

export function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? '' : 's'}`;
}
