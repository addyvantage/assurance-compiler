'use client';

import type { CloudStage } from '@assurance-compiler/sync';
import { RotateCw, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { latestStages } from '@/lib/explain';
import { hms } from '@/lib/format';
import { Button } from '../ui/button';
import { StatusIcon } from '../ui/status';
import { ExecutionTrace } from './trace';

interface LiveEvent {
  readonly sequence: number;
  readonly at: string;
  readonly stage: CloudStage;
}

type Connection = 'connecting' | 'open' | 'reconnecting' | 'expired' | 'stale' | 'finished';

/**
 * Follows a running run over server-sent events. Only real stage transitions change the
 * trace. When the terminal report arrives the page is refreshed so the server renders the
 * authoritative result.
 */
export function RunLive({
  runId,
  initialEvents,
}: {
  readonly runId: string;
  readonly initialEvents: readonly LiveEvent[];
}) {
  const router = useRouter();
  const [events, setEvents] = useState<readonly LiveEvent[]>(initialEvents);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [lastHeard, setLastHeard] = useState<string | null>(initialEvents.at(-1)?.at ?? null);
  const attempts = useRef(0);

  useEffect(() => {
    let last = initialEvents.at(-1)?.sequence ?? 0;
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
        // The server now renders the page header as stale too.
        router.refresh();
      });
      source.onerror = () => {
        source?.close();
        if (cancelled) return;
        // The stream answers 401 once the session expires; EventSource cannot report the
        // status, so repeated immediate failures are treated as expiry.
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
    // The initial events seed the cursor once; later events come from the stream.
  }, [runId]);

  const since = lastHeard === null ? 'the start of the run' : hms(lastHeard);
  const notes: Record<Connection, { icon: ReactNode; text: string; action?: ReactNode }> = {
    connecting: { icon: <StatusIcon status="running" size={14} />, text: 'Connecting to the run.' },
    open: {
      icon: (
        <span className="size-1.5 animate-[live-pulse_1.6s_ease-in-out_infinite] rounded-full bg-accent" />
      ),
      text: `Receiving stage updates from the CLI${lastHeard === null ? '' : `, last at ${hms(lastHeard)}`}.`,
    },
    reconnecting: {
      icon: <WifiOff className="size-3.5 text-warn" />,
      text: `Connection lost. Showing progress up to ${since} while reconnecting.`,
    },
    expired: {
      icon: <WifiOff className="size-3.5 text-warn" />,
      text: 'Could not reconnect. Your session may have expired.',
      action: (
        <Button
          size="sm"
          onClick={() => {
            window.location.reload();
          }}
        >
          <RotateCw />
          Reload
        </Button>
      ),
    },
    stale: {
      icon: <StatusIcon status="stale" size={14} />,
      text: `The CLI has not reported since ${since}. The check may have stopped on that machine; nothing has failed.`,
    },
    finished: {
      icon: <StatusIcon status="succeeded" size={14} />,
      text: 'Final report received. Loading the result.',
    },
  };
  const note = notes[connection];

  return (
    <div className="grid gap-2.5">
      <div role="status" className="flex min-h-8 items-center gap-2.5 text-xs text-ink-2">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={connection}
            className="inline-grid size-4 place-items-center"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
          >
            {note.icon}
          </motion.span>
        </AnimatePresence>
        <span className="flex-1">{note.text}</span>
        {note.action}
      </div>
      <ExecutionTrace
        stages={latestStages(events)}
        live={connection !== 'stale' && connection !== 'expired'}
      />
    </div>
  );
}
