import type { Metadata } from 'next';
import { PageBody, PageHeading, Topbar } from '@/components/app/topbar';
import { RepositoryForm } from './repository-form';

export const metadata: Metadata = { title: 'Register a repository' };

export default function NewRepositoryPage() {
  return (
    <>
      <Topbar crumbs={[{ label: 'Repositories', href: '/repositories' }, { label: 'Register' }]} />
      <PageBody className="max-w-[560px]">
        <PageHeading
          title="Register a repository"
          description="Records a name and an optional URL in your workspace. Nothing is fetched and no GitHub access is requested; verification runs from the CLI you link next."
        />
        <div className="rounded-lg border border-line bg-raised p-5 shadow-raised">
          <RepositoryForm />
        </div>
      </PageBody>
    </>
  );
}
