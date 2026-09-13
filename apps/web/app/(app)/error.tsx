'use client';

import { RotateCw, TriangleAlert } from 'lucide-react';
import { PageBody } from '@/components/app/topbar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function ErrorPage({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <PageBody>
      <div className="rounded-lg border border-line bg-raised shadow-raised">
        <EmptyState
          icon={<TriangleAlert />}
          title="This page could not load"
          description={
            <>
              The server returned an error. Try again; if it keeps failing, check the server log
              {error.digest === undefined ? '' : ' for reference '}
              {error.digest === undefined ? null : (
                <code className="text-[12.5px] text-ink">{error.digest}</code>
              )}
              .
            </>
          }
        >
          <Button variant="primary" onClick={reset}>
            <RotateCw />
            Try again
          </Button>
        </EmptyState>
      </div>
    </PageBody>
  );
}
