'use client';

import { useState } from 'react';
import { cn } from '@/components/ui/cn';
import { Segmented } from '@/components/ui/segmented';

export interface CompareRow {
  readonly label: string;
  readonly left: string;
  readonly right: string;
  readonly mono?: boolean;
}

export function CompareTable({
  rows,
  leftTitle,
  rightTitle,
}: {
  readonly rows: readonly CompareRow[];
  readonly leftTitle: string;
  readonly rightTitle: string;
}) {
  const [show, setShow] = useState<'all' | 'diff'>('all');
  const visible = show === 'all' ? rows : rows.filter((row) => row.left !== row.right);
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Segmented
          label="Rows"
          value={show}
          onChange={setShow}
          options={[
            { value: 'all', label: 'All fields' },
            { value: 'diff', label: 'Only differences' },
          ]}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-raised shadow-raised">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-sunken text-left text-xs text-ink-3">
              <th scope="col" className="w-[180px] px-4 py-2 font-medium">
                Field
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                {leftTitle}
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                {rightTitle}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((row) => {
              const differs = row.left !== row.right;
              return (
                <tr key={row.label} className="align-top">
                  <th scope="row" className="px-4 py-2.5 text-left font-normal text-ink-2">
                    <span className="flex items-center gap-2">
                      {row.label}
                      {differs ? (
                        <span className="rounded-full bg-warn-soft px-1.5 text-2xs font-medium text-warn-ink">
                          Differs
                        </span>
                      ) : null}
                    </span>
                  </th>
                  {[row.left, row.right].map((value, index) => (
                    <td
                      key={index}
                      className={cn(
                        'px-4 py-2.5 break-words whitespace-pre-wrap',
                        row.mono === true && 'font-mono text-[12.5px]',
                        differs ? 'text-ink' : 'text-ink-2',
                      )}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
