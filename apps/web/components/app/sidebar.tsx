'use client';

import {
  Activity,
  ChevronsUpDown,
  FolderGit2,
  LogOut,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings2,
  Sun,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Dialog as Primitive } from 'radix-ui';
import { useState } from 'react';
import { Button, Kbd } from '../ui/button';
import { cn } from '../ui/cn';
import { OVERLAY } from '../ui/dialog';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '../ui/menu';
import { StatusIcon } from '../ui/status';
import { Mark } from './mark';
import { signOut } from './sign-out';
import { applyTheme, useThemeChoice, type ThemeChoice } from './theme';
import type { ShellRepository } from './types';

const NAV = [
  { href: '/repositories', label: 'Repositories', icon: FolderGit2 },
  { href: '/runs', label: 'Runs', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings2 },
] as const;

function noop(): void {
  // Desktop navigation has nothing to close.
}

export function openCommandMenu(): void {
  window.dispatchEvent(new Event('assure:command'));
}

interface SidebarProps {
  readonly workspaceName: string;
  readonly email: string;
  readonly repositories: readonly ShellRepository[];
}

export function Sidebar(props: SidebarProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 lg:block">
        <SidebarBody {...props} group="desktop" />
      </aside>
      <div className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-canvas/90 px-2 backdrop-blur-md lg:hidden">
        <Primitive.Root open={open} onOpenChange={setOpen}>
          <Primitive.Trigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open navigation">
              <MenuIcon />
            </Button>
          </Primitive.Trigger>
          <Primitive.Portal>
            <Primitive.Overlay className={OVERLAY} />
            <Primitive.Content className="fixed inset-y-0 left-0 z-50 w-[272px] bg-canvas shadow-overlay outline-none data-[state=closed]:animate-[fade-out_120ms_ease-in] data-[state=open]:animate-[sheet-in_220ms_var(--ease-out-quint)]">
              <Primitive.Title className="sr-only">Navigation</Primitive.Title>
              <Primitive.Description className="sr-only">
                Workspace navigation
              </Primitive.Description>
              <SidebarBody
                {...props}
                group="mobile"
                onNavigate={() => {
                  setOpen(false);
                }}
              />
            </Primitive.Content>
          </Primitive.Portal>
        </Primitive.Root>
        <Mark size={18} />
        <span className="truncate text-sm font-semibold tracking-[-0.01em]">
          {props.workspaceName}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          className="ml-auto"
          onClick={openCommandMenu}
        >
          <Search />
        </Button>
      </div>
    </>
  );
}

function SidebarBody({
  workspaceName,
  email,
  repositories,
  group,
  onNavigate = noop,
}: SidebarProps & { readonly group: string; readonly onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useThemeChoice();

  return (
    <div className="flex h-full flex-col px-3 py-3">
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-hover data-[state=open]:bg-hover"
          >
            <Mark size={20} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[-0.01em]">
              {workspaceName}
            </span>
            <ChevronsUpDown className="size-3.5 text-ink-3" />
          </button>
        </MenuTrigger>
        <MenuContent className="w-[248px]">
          <MenuLabel>{email}</MenuLabel>
          <MenuItem asChild>
            <Link href="/settings" onClick={onNavigate}>
              <Settings2 />
              Workspace settings
            </Link>
          </MenuItem>
          <MenuSeparator />
          <MenuLabel>Theme</MenuLabel>
          <MenuRadioGroup
            value={theme}
            onValueChange={(value) => {
              applyTheme(value as ThemeChoice);
            }}
          >
            <MenuRadioItem value="system">
              <Monitor />
              Match system
            </MenuRadioItem>
            <MenuRadioItem value="light">
              <Sun />
              Light
            </MenuRadioItem>
            <MenuRadioItem value="dark">
              <Moon />
              Dark
            </MenuRadioItem>
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuItem
            onSelect={() => {
              void signOut(router);
            }}
          >
            <LogOut />
            Sign out
          </MenuItem>
        </MenuContent>
      </Menu>

      <button
        type="button"
        onClick={() => {
          onNavigate();
          openCommandMenu();
        }}
        className="mt-2 flex h-8 w-full items-center gap-2 rounded-md border border-line bg-raised px-2 text-sm text-ink-3 shadow-raised transition-colors hover:text-ink-2"
      >
        <Search className="size-3.5" />
        Search
        <Kbd className="ml-auto">⌘K</Kbd>
      </button>

      <nav aria-label="Primary" className="mt-4 grid gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium transition-colors',
                active ? 'text-ink' : 'text-ink-2 hover:bg-hover hover:text-ink',
              )}
            >
              {active ? (
                <motion.span
                  layoutId={`nav-active-${group}`}
                  className="absolute inset-0 rounded-md border border-line bg-raised shadow-raised"
                />
              ) : null}
              <Icon className={cn('relative size-4', active ? 'text-ink' : 'text-ink-3')} />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 mb-1 px-2 text-2xs font-medium text-ink-3">Repositories</div>
      <div className="grid gap-0.5 overflow-y-auto">
        {repositories.slice(0, 12).map((repository) => {
          const href = `/repositories/${repository.id}`;
          const active = pathname === href;
          return (
            <Link
              key={repository.id}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex h-7 min-w-0 items-center gap-2.5 rounded-md px-2 text-sm transition-colors',
                active ? 'bg-hover text-ink' : 'text-ink-2 hover:bg-hover hover:text-ink',
              )}
            >
              <StatusIcon status={repository.kind} size={13} />
              <span className="truncate">
                {repository.name}
                <span className="sr-only">, {repository.label}</span>
              </span>
            </Link>
          );
        })}
        {repositories.length === 0 ? (
          <Link
            href="/repositories/new"
            onClick={onNavigate}
            className="flex h-7 items-center gap-2.5 rounded-md px-2 text-sm text-ink-3 transition-colors hover:bg-hover hover:text-ink"
          >
            <Plus className="size-3.5" />
            Register a repository
          </Link>
        ) : null}
      </div>
    </div>
  );
}
