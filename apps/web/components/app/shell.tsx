import type { ReactNode } from 'react';
import { CommandMenu } from './command-menu';
import { Sidebar } from './sidebar';
import type { ShellRepository, ShellRun } from './types';

/** The frame: navigation on the canvas, the page on a raised panel, and the command menu. */
export function AppShell({
  workspaceName,
  email,
  repositories,
  runs,
  children,
}: {
  readonly workspaceName: string;
  readonly email: string;
  readonly repositories: readonly ShellRepository[];
  readonly runs: readonly ShellRun[];
  readonly children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-canvas lg:flex">
      <Sidebar workspaceName={workspaceName} email={email} repositories={repositories} />
      <div className="min-w-0 flex-1 lg:py-2 lg:pr-2">
        <main
          id="main"
          className="min-h-[calc(100dvh-3rem)] bg-panel lg:min-h-[calc(100dvh-1rem)] lg:rounded-xl lg:border lg:border-line lg:shadow-raised"
        >
          {children}
        </main>
      </div>
      <CommandMenu repositories={repositories} runs={runs} />
    </div>
  );
}
