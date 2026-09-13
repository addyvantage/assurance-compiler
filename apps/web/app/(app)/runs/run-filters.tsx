'use client';

import { ChevronDown, FolderGit2, LoaderCircle } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from '@/components/ui/menu';
import { Segmented } from '@/components/ui/segmented';

type Result = 'all' | 'FAILED' | 'INCOMPLETE' | 'COMPLETE' | 'running';

const RESULTS: readonly { value: Result; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'INCOMPLETE', label: 'Incomplete' },
  { value: 'COMPLETE', label: 'Complete' },
  { value: 'running', label: 'Running' },
];

/** Filters live in the URL, so a filtered list survives reload and can be shared. */
export function RunFilters({
  repositories,
  repository,
  result,
}: {
  readonly repositories: readonly { readonly id: string; readonly name: string }[];
  readonly repository: string;
  readonly result: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === 'all') next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    startTransition(() => {
      router.push(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
    });
  }

  const current = repositories.find((entry) => entry.id === repository);
  const selected = RESULTS.some((entry) => entry.value === result) ? (result as Result) : 'all';

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Segmented
        label="Result"
        options={RESULTS}
        value={selected}
        onChange={(value) => {
          update('result', value);
        }}
      />
      <Menu>
        <MenuTrigger asChild>
          <Button aria-label={`Repository: ${current?.name ?? 'all repositories'}`}>
            <FolderGit2 className="text-ink-3" />
            <span className="max-w-[180px] truncate">{current?.name ?? 'All repositories'}</span>
            <ChevronDown className="text-ink-3" />
          </Button>
        </MenuTrigger>
        <MenuContent>
          <MenuRadioGroup
            value={current === undefined ? 'all' : current.id}
            onValueChange={(value) => {
              update('repository', value);
            }}
          >
            <MenuRadioItem value="all">All repositories</MenuRadioItem>
            {repositories.map((entry) => (
              <MenuRadioItem key={entry.id} value={entry.id}>
                <span className="truncate">{entry.name}</span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuContent>
      </Menu>
      {pending ? (
        <LoaderCircle className="size-4 animate-spin text-ink-3" aria-label="Updating" />
      ) : null}
    </div>
  );
}
