import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RunDetail } from '@/components/run-detail';
import { Shell } from '@/components/shell';
import '../../../app.css';
import { FIXTURE_STATES, fixture, type FixtureState } from '../fixtures';

/** Development only. Renders the run detail with synthetic states; nothing is stored. */
export default async function FixturePage({ params }: { readonly params: Promise<{ state: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { state } = await params;
  if (!(FIXTURE_STATES as readonly string[]).includes(state)) notFound();
  return (
    <>
      <div className="banner" role="note">
        Development fixture: simulated data, not evidence.{' '}
        {FIXTURE_STATES.map((s) => (
          <Link key={s} href={`/dev/fixtures/${s}`} style={{ marginLeft: 10 }}>
            {s}
          </Link>
        ))}
      </div>
      <Shell workspaceName="Fixture workspace" email="fixture@example.invalid">
        <RunDetail view={fixture(state as FixtureState)} previousRunId={state === 'running' ? undefined : 'other'} />
      </Shell>
    </>
  );
}
