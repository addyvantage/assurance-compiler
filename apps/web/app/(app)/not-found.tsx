import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { PageBody, Topbar } from '@/components/app/topbar';
import { buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function NotFound() {
  return (
    <>
      <Topbar crumbs={[{ label: 'Not found' }]} />
      <PageBody>
        <div className="rounded-lg border border-line bg-raised shadow-raised">
          <EmptyState
            icon={<SearchX />}
            title="Nothing here"
            description="This page does not exist in your workspace. It may belong to another workspace, or it was removed."
          >
            <Link href="/repositories" className={buttonClass('primary', 'md')}>
              Go to repositories
            </Link>
          </EmptyState>
        </div>
      </PageBody>
    </>
  );
}
