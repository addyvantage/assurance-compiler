import { and, desc, eq, lt } from 'drizzle-orm';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RunDetail } from '@/components/run-detail';
import { db, schema } from '@/lib/db';
import { toRunView } from '@/lib/run-view';
import { getRun } from '@/lib/runs';
import { requireWorkspace } from '@/lib/session';

export const metadata: Metadata = { title: 'Run' };

export default async function RunPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;
  const found = await getRun(workspace.id, id);
  if (found === undefined) notFound();
  const previous = await db.query.run.findFirst({
    columns: { id: true },
    where: and(
      eq(schema.run.workspaceId, workspace.id),
      eq(schema.run.repositoryId, found.run.repositoryId),
      eq(schema.run.status, 'reported'),
      lt(schema.run.startedAt, found.run.startedAt),
    ),
    orderBy: desc(schema.run.startedAt),
  });
  return (
    <>
      <div className="crumbs">
        <a href="/runs">Runs</a> /
      </div>
      <RunDetail
        view={toRunView(found)}
        previousRunId={found.run.status === 'reported' ? previous?.id : undefined}
      />
    </>
  );
}
