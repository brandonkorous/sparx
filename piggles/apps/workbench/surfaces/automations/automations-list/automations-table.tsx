'use client';

import { faArrowDown, faArrowUp } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../../components/table';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import { targetFor } from '../target-for';
import { AutomationRow } from './automation-row';
import type { Dir, SortKey } from './rows';
import type { AutomationsList } from './use-automations-list';

/** A sortable column header: the whole label is the button. */
function sortHeader(
  sort: { key: SortKey; dir: Dir },
  toggleSort: (key: SortKey) => void,
  key: SortKey,
  label: string,
  extra: string
) {
  return (
    <th
      className={extra}
      aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="link link-hover inline-flex items-center gap-1"
        onClick={() => {
          toggleSort(key);
        }}
      >
        {label}
        {sort.key === key ? (
          sort.dir === 'asc' ? (
            <Icon glyph={faArrowUp} className="size-3" aria-hidden />
          ) : (
            <Icon glyph={faArrowDown} className="size-3" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );
}

export function AutomationsTable({ ctx, list }: { ctx: SurfaceContext; list: AutomationsList }) {
  const { sort, toggleSort, rows, clock } = list;
  const header = (key: SortKey, label: string, extra = '') =>
    sortHeader(sort, toggleSort, key, label, extra);

  const open = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('automations.detail', { id }, { target: targetFor(event) });
  };

  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          {header('name', 'Name')}
          {header('trigger', 'When it runs', 'hidden @lg:table-cell')}
          <th className="hidden @2xl:table-cell">Touches</th>
          {header('runs', 'Runs', 'hidden text-right @md:table-cell')}
          {header('lastRun', 'Last run', 'hidden @xl:table-cell')}
          {header('status', 'Status')}
        </tr>
      </thead>
      <tbody>
        {rows.map((automation) => (
          <AutomationRow key={automation.id} automation={automation} clock={clock} open={open} />
        ))}
      </tbody>
    </Table>
  );
}
