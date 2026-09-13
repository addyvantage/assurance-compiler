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

/** A duration for people: 850 ms, 4.2 s, 38 s, 3 min 12 s. */
export function formatMs(ms: number): string {
  if (ms < 1000) return `${String(Math.round(ms))} ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  if (ms < 120_000) return `${String(Math.round(ms / 1000))} s`;
  return `${String(Math.floor(ms / 60_000))} min ${String(Math.round((ms % 60_000) / 1000))} s`;
}

/** Milliseconds from the first stage start to the last stage end, or null before any stage ran. */
export function traceSpan(
  stages: readonly { readonly startedAt?: string; readonly durationMs?: number }[],
): number | null {
  const timed = stages.flatMap((stage) =>
    stage.startedAt === undefined
      ? []
      : [
          {
            start: Date.parse(stage.startedAt),
            end: Date.parse(stage.startedAt) + (stage.durationMs ?? 0),
          },
        ],
  );
  if (timed.length === 0) return null;
  return Math.max(...timed.map((t) => t.end)) - Math.min(...timed.map((t) => t.start));
}

const hourMinute = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

const hourMinuteSecond = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function hms(date: Date | string): string {
  return hourMinuteSecond.format(typeof date === 'string' ? new Date(date) : date);
}

export function hm(date: Date | string): string {
  return hourMinute.format(typeof date === 'string' ? new Date(date) : date);
}

/** "Today", "Yesterday", or a date, for grouping lists by day. */
export function dayLabel(date: Date, now = new Date()): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return dayMonth.format(date);
}
