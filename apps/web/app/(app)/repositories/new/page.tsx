import type { Metadata } from 'next';
import { PageHeader } from '@/components/shell';
import { RepositoryForm } from './repository-form';

export const metadata: Metadata = { title: 'Register a repository' };

export default function NewRepositoryPage() {
  return (
    <>
      <PageHeader
        title="Register a repository"
        description="Registration records a name and an optional URL in your workspace. Nothing is fetched and no GitHub access is granted; verification runs from the CLI you link next."
        crumbs={[{ href: '/repositories', label: 'Repositories' }]}
      />
      <RepositoryForm />
    </>
  );
}
