import type { ReactNode } from 'react';
import { Shell } from '@/components/shell';
import { requireWorkspace } from '@/lib/session';
import '../app.css';

export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const { user, workspace } = await requireWorkspace();
  return (
    <Shell workspaceName={workspace.name} email={user.email}>
      {children}
    </Shell>
  );
}
