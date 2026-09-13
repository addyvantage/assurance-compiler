'use client';

import { Command } from 'cmdk';
import {
  Activity,
  CornerDownLeft,
  FolderGit2,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings2,
  Sun,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Dialog as Primitive } from 'radix-ui';
import { useEffect, useState, type ReactNode } from 'react';
import { ago } from '@/lib/format';
import { Kbd } from '../ui/button';
import { OVERLAY } from '../ui/dialog';
import { StatusIcon } from '../ui/status';
import { signOut } from './sign-out';
import { applyTheme } from './theme';
import type { ShellRepository, ShellRun } from './types';

/** ⌘K: jump to any repository, recent run or setting without leaving the keyboard. */
export function CommandMenu({
  repositories,
  runs,
}: {
  readonly repositories: readonly ShellRepository[];
  readonly runs: readonly ShellRun[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    const onOpen = () => {
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('assure:command', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('assure:command', onOpen);
    };
  }, []);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  const go = (href: string) =>
    run(() => {
      router.push(href);
    });

  return (
    <Primitive.Root open={open} onOpenChange={setOpen}>
      <Primitive.Portal>
        <Primitive.Overlay className={OVERLAY} />
        <Primitive.Content className="fixed top-[14vh] left-1/2 z-50 w-[min(600px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-xl bg-raised shadow-overlay outline-none data-[state=closed]:animate-[fade-out_100ms_ease-in] data-[state=open]:animate-[pop-in_180ms_var(--ease-out-quint)]">
          <Primitive.Title className="sr-only">Search and navigate</Primitive.Title>
          <Primitive.Description className="sr-only">
            Type to find a repository, a recent run or an action.
          </Primitive.Description>
          <Command loop>
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
              <Command.Input
                autoFocus
                placeholder="Search repositories, runs and actions"
                className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
              />
              <Kbd>esc</Kbd>
            </div>
            <Command.List className="max-h-[min(400px,60vh)] overflow-y-auto p-1.5">
              <Command.Empty>No repository, run or action matches.</Command.Empty>
              <Command.Group heading="Go to">
                <Item icon={<FolderGit2 />} onSelect={go('/repositories')}>
                  Repositories
                </Item>
                <Item icon={<Activity />} onSelect={go('/runs')}>
                  Runs
                </Item>
                <Item icon={<Settings2 />} onSelect={go('/settings')}>
                  Settings
                </Item>
              </Command.Group>
              {repositories.length > 0 ? (
                <Command.Group heading="Repositories">
                  {repositories.map((repository) => (
                    <Command.Item
                      key={repository.id}
                      value={`repository ${repository.name} ${repository.id}`}
                      onSelect={go(`/repositories/${repository.id}`)}
                    >
                      <StatusIcon status={repository.kind} size={14} />
                      <span className="truncate">
                        {repository.name}
                        <span className="sr-only">, {repository.label}</span>
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {runs.length > 0 ? (
                <Command.Group heading="Recent runs">
                  {runs.map((entry) => (
                    <Command.Item
                      key={entry.id}
                      value={`run ${entry.id} ${entry.repositoryName} ${entry.label} ${entry.candidate}`}
                      onSelect={go(`/runs/${entry.id}`)}
                    >
                      <StatusIcon status={entry.kind} size={14} />
                      <span className="truncate text-ink">{entry.repositoryName}</span>
                      <span className="font-mono text-xs text-ink-3">{entry.candidate}</span>
                      <span className="text-xs text-ink-3">{entry.label}</span>
                      <span className="ml-auto text-xs whitespace-nowrap text-ink-3">
                        {ago(entry.startedAt)}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              <Command.Group heading="Actions">
                <Item icon={<Plus />} onSelect={go('/repositories/new')}>
                  Register a repository
                </Item>
                <Item
                  icon={<Monitor />}
                  onSelect={run(() => {
                    applyTheme('system');
                  })}
                >
                  Theme: match system
                </Item>
                <Item
                  icon={<Sun />}
                  onSelect={run(() => {
                    applyTheme('light');
                  })}
                >
                  Theme: light
                </Item>
                <Item
                  icon={<Moon />}
                  onSelect={run(() => {
                    applyTheme('dark');
                  })}
                >
                  Theme: dark
                </Item>
                <Item
                  icon={<LogOut />}
                  onSelect={run(() => {
                    void signOut(router);
                  })}
                >
                  Sign out
                </Item>
              </Command.Group>
            </Command.List>
            <div className="flex items-center gap-4 border-t border-line px-3.5 py-2 text-2xs text-ink-3">
              <span className="inline-flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                to move
              </span>
              <span className="inline-flex items-center gap-1">
                <Kbd>
                  <CornerDownLeft className="size-2.5" />
                </Kbd>
                to open
              </span>
            </div>
          </Command>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

function Item({
  icon,
  children,
  onSelect,
}: {
  readonly icon: ReactNode;
  readonly children: ReactNode;
  readonly onSelect: () => void;
}) {
  return (
    <Command.Item onSelect={onSelect}>
      <span className="inline-grid text-ink-3 [&_svg]:size-4" aria-hidden="true">
        {icon}
      </span>
      {children}
    </Command.Item>
  );
}
