import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app/shell';
import { RunDetail } from '@/components/run/run-detail';
import { FIXTURE_STATES, fixture, type FixtureState } from '../fixtures';

/** Development only. Renders the run detail with synthetic states; nothing is stored. */
export default async function FixturePage({ params }: { readonly params: Promise<{ state: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { state } = await params;
  if (!(FIXTURE_STATES as readonly string[]).includes(state)) notFound();
  return (
    <>
      <div
        role="note"
        className="relative z-40 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-warn-soft px-4 py-2 text-xs text-warn-ink"
      >
        <span className="font-semibold">Development fixture: simulated data, not evidence.</span>
        {FIXTURE_STATES.map((name) => (
          <Link key={name} href={`/dev/fixtures/${name}`} className={name === state ? 'font-semibold underline' : 'hover:underline'}>
            {name}
          </Link>
        ))}
      </div>
      <AppShell
        workspaceName="Fixture workspace"
        email="fixture@example.invalid"
        repositories={[{ id: 'fixture-repo', name: 'billing-service (fixture)', kind: 'nothing', label: 'No runs yet' }]}
        runs={[]}
      >
        <RunDetail view={fixture(state as FixtureState)} />
      </AppShell>
    </>
  );
}
