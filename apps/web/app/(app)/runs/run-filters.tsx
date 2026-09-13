'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Filters live in the URL so a filtered list can be reloaded and shared. */
export function RunFilters({
  repositories,
}: {
  readonly repositories: readonly { readonly id: string; readonly name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === '') next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.push(query === '' ? pathname : `${pathname}?${query}`);
  }

  return (
    <div className="filters" role="group" aria-label="Filter runs">
      <label className="sr-only" htmlFor="filter-repository">
        Repository
      </label>
      <select
        id="filter-repository"
        className="select"
        value={params.get('repository') ?? ''}
        onChange={(event) => {
          update('repository', event.target.value);
        }}
      >
        <option value="">All repositories</option>
        {repositories.map((repository) => (
          <option key={repository.id} value={repository.id}>
            {repository.name}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="filter-result">
        Result
      </label>
      <select
        id="filter-result"
        className="select"
        value={params.get('result') ?? ''}
        onChange={(event) => {
          update('result', event.target.value);
        }}
      >
        <option value="">Any result</option>
        <option value="FAILED">Failed</option>
        <option value="COMPLETE">Complete</option>
        <option value="INCOMPLETE">Incomplete</option>
        <option value="running">Still running</option>
      </select>
    </div>
  );
}
