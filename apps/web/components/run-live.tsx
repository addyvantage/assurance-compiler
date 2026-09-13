'use client';

import type { CloudStage } from '@assurance-compiler/sync';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { latestStages } from '@/lib/explain';
import { StageList } from './stages';

interface LiveEvent {
  readonly sequence: number;
  readonly at: string;
  readonly stage: CloudStage;
}

type Connection = 'connecting' | 'open' | 'reconnecting' | 'expired' | 'stale' | 'finished';

/**
 * Follows a running run over server-sent events. Real stage transitions only: nothing here
 * advances on a timer. When the terminal report arrives the page is refreshed so the server
 * renders the final, authoritative view.
 */
export function RunLive({
  runId,
  initialEvents,
  startedAt,
}: {
  readonly runId: string;
  readonly initialEvents: readonly LiveEvent[];
  readonly startedAt: string;
}) {
  const router = useRouter();
  const [events, setEvents] = useState<readonly LiveEvent[]>(initialEvents);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [lastHeard, setLastHeard] = useState<string | null>(initialEvents.at(-1)?.at ?? null);
  const attempts = useRef(0);

  useEffect(() => {
    let last = events.at(-1)?.sequence ?? 0;
    let cancelled = false;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      source = new EventSource(`/api/runs/${runId}/stream?after=${String(last)}`);
      source.onopen = () => {
        attempts.current = 0;
        if (!cancelled) setConnection('open');
      };
      source.addEventListener('stage', (message) => {
        const event = JSON.parse((message as MessageEvent<string>).data) as LiveEvent;
        if (event.sequence <= last) return;
        last = event.sequence;
        setEvents((current) => [...current, event]);
        setLastHeard(event.at);
      });
      source.addEventListener('report', () => {
        setConnection('finished');
        source?.close();
        router.refresh();
      });
      source.addEventListener('stale', () => {
        setConnection('stale');
        source?.close();
      });
      source.onerror = () => {
        source?.close();
        if (cancelled) return;
        // The stream returns 401 once the session expires; EventSource cannot tell us the
        // status, so a reconnect that fails immediately and repeatedly is treated as expiry.
        attempts.current += 1;
        if (attempts.current > 6) {
          setConnection('expired');
          return;
        }
        setConnection('reconnecting');
        retry = setTimeout(connect, Math.min(1000 * 2 ** Math.min(attempts.current, 4), 15_000));
      };
    };
    connect();
    return () => {
      cancelled = true;
      if (retry !== null) clearTimeout(retry);
      source?.close();
    };
    // `events` is read once on mount to seed the cursor; later events come from the stream.
  }, [runId]);

  const stages = latestStages(events);
  return (
    <div>
      {/* Clock text is formatted in the viewer's zone, so the server's copy may differ. */}
      <div className="notice" role="status" style={{ marginBottom: 12 }} suppressHydrationWarning>
        {connection === 'open' || connection === 'connecting'
          ? `Following this run live. Started ${clock(startedAt)}${lastHeard === null ? '' : `, last update ${clock(lastHeard)}`}.`
          : connection === 'reconnecting'
            ? `Connection lost. Showing progress up to ${lastHeard === null ? 'the start' : clock(lastHeard)}; reconnecting.`
            : connection === 'expired'
              ? 'Could not reconnect. Your session may have expired: reload the page, or sign in again.'
              : connection === 'stale'
                ? `The CLI has not reported for a while${lastHeard === null ? '' : ` (last update ${clock(lastHeard)})`}. The check may have been stopped on that machine; nothing has failed. Reload later to check.`
                : 'The final report has arrived. Loading the result.'}
      </div>
      <StageList stages={stages} live />
    </div>
  );
}

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function clock(iso: string): string {
  return clockFormat.format(new Date(iso));
}
