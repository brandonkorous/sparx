'use client';

// The groups table: sortable headers, one row per group.
//
// Sorting is SERVER-side — the header only reports which column was pressed —
// and columns disclose by @container width, because a group pane is 320px beside
// an editor or the whole window.

import { Badge, Text, Tooltip } from '@wizeworks/silicaui-react';
import { faArrowDown, faArrowUp } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../components/table';
import type { CollectionSort, CollectionSummary, SortDir } from './collections-data';

/** The number beside a group, and the honest footnote when it is not the whole
 *  story.
 *
 *  The figure is what a SHOPPER would find in the group on this site, which is
 *  the question anybody reading this column is asking. It used to be a raw count
 *  of filing rows, so on a maker running seven websites "New arrivals" read 5
 *  over a group page holding nothing she sells here — all five were jewelry and
 *  fragrance from her other sites (issue 626). A truthful 0 alone would read as
 *  "my products have vanished", so where anything is filed-but-unshown the row
 *  says so and the tooltip says why.
 *
 *  This is the aisle list's `ProductCount` (issue 382), one screen over. It was
 *  written there and not here. */
function GroupCount({ row }: { row: CollectionSummary }) {
  const hidden = row.hiddenProductCount;
  if (hidden === 0) return <>{String(row.productCount)}</>;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      {String(row.productCount)}
      <Tooltip
        content={`${String(hidden)} more ${hidden === 1 ? 'product is' : 'products are'} in this group but not on your website: archived, still a draft, or kept for one of your other sites.`}
      >
        <Badge color="info" variant="soft" size="sm">
          {String(hidden)} not shown
        </Badge>
      </Tooltip>
    </span>
  );
}

export interface Sort {
  key: CollectionSort;
  dir: SortDir;
}

interface Modifiers {
  shiftKey: boolean;
  altKey: boolean;
}

/** A short, human "when" for the recency column — "Jul 20", or with the year for
 *  anything from a past year, so an old group reads unambiguously. */
function formatUpdated(iso: string): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

function SortHeader({
  sortKey,
  label,
  extra,
  sort,
  onToggle,
}: {
  sortKey: CollectionSort;
  label: string;
  extra?: string;
  sort: Sort;
  onToggle: (key: CollectionSort) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      className={extra}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="link link-hover inline-flex items-center gap-1"
        onClick={() => {
          onToggle(sortKey);
        }}
      >
        {label}
        {active ? (
          <Icon
            glyph={sort.dir === 'asc' ? faArrowUp : faArrowDown}
            className="size-3"
            aria-hidden
          />
        ) : null}
      </button>
    </th>
  );
}

export function CollectionsTable({
  rows,
  sort,
  onToggleSort,
  onOpen,
}: {
  rows: CollectionSummary[];
  sort: Sort;
  onToggleSort: (key: CollectionSort) => void;
  onOpen: (row: CollectionSummary, event: Modifiers) => void;
}) {
  const header = (key: CollectionSort, label: string, extra?: string) => (
    <SortHeader sortKey={key} label={label} extra={extra} sort={sort} onToggle={onToggleSort} />
  );

  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          {header('name', 'Name')}
          {header('type', 'How it fills', 'hidden @lg:table-cell')}
          <th>State</th>
          {header('productCount', 'Products', 'text-right')}
          {header('updatedAt', 'Updated', 'hidden text-right @2xl:table-cell')}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className="cursor-pointer"
            tabIndex={0}
            role="button"
            onClick={(event) => {
              onOpen(row, event);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              onOpen(row, event);
            }}
          >
            <td className="max-w-64 truncate font-medium">{row.name}</td>
            <td className="hidden @lg:table-cell">
              {row.type === 'rules' ? 'Automatic' : 'Hand-picked'}
            </td>
            <td>
              {/* A badge is state ON a thing; "not featured" is the absence of it, so
                  it reads as plain words rather than a second grey pill (RULE #4). */}
              {row.featured ? (
                <Badge color="warning" variant="soft" size="sm">
                  Featured
                </Badge>
              ) : (
                <Text as="span" className="text-sm">
                  Standard
                </Text>
              )}
            </td>
            <td className="text-right tabular-nums">
              <GroupCount row={row} />
            </td>
            <td className="hidden text-right text-sm tabular-nums @2xl:table-cell">
              {formatUpdated(row.updatedAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
