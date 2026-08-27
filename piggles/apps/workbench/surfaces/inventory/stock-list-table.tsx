'use client';

// The stock table itself — the one case where the house "short lists are cards"
// rule does not apply, because the whole job of this screen is comparing four
// numbers down a column and cards turn a scan into a read.
//
// The columns disclose with @container so a pane docked at 320px still shows the
// two that matter — what it is and how many can be sold — rather than six
// columns of two characters each.

import { Badge, Button, Tooltip } from '@wizeworks/silicaui-react';
import { faArrowDown, faArrowUp, faShieldCheck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../components/table';
import {
  levelState,
  locationLabel,
  sellable,
  type SortDirection,
  type StockLevel,
  type StockSortKey,
} from './data';
import { humanDuration, stockAgeTone } from './integrity-data';

interface Modifiers {
  shiftKey: boolean;
  altKey: boolean;
}

interface TableProps {
  rows: StockLevel[];
  sort: { key: StockSortKey; dir: SortDirection };
  onSort: (key: StockSortKey) => void;
  onOpen: (level: StockLevel, event: Modifiers) => void;
  onExplain: (level: StockLevel) => void;
}

export function StockListTable({ rows, sort, onSort, onOpen, onExplain }: TableProps) {
  const header = (key: StockSortKey, label: string, extra = '') => (
    <th
      className={extra}
      aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="link link-hover inline-flex items-center gap-1"
        onClick={() => {
          onSort(key);
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

  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          {header('product', 'Item')}
          <th className="hidden @lg:table-cell">Location</th>
          {header('available', 'To sell', 'text-right whitespace-nowrap')}
          <th className="hidden text-right @xl:table-cell">On the shelf</th>
          <th className="hidden text-right @3xl:table-cell">Spoken for</th>
          <th className="hidden @md:table-cell">State</th>
          {/* An icon-only column: the header is for screen readers, and a word
              here would claim width the numbers need more. */}
          <th className="w-8">
            <span className="sr-only">Where the number came from</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((level) => (
          <StockRow
            key={`${level.variantId}:${level.warehouseId}`}
            level={level}
            onOpen={onOpen}
            onExplain={onExplain}
          />
        ))}
      </tbody>
    </Table>
  );
}

function StockRow({
  level,
  onOpen,
  onExplain,
}: {
  level: StockLevel;
  onOpen: (level: StockLevel, event: Modifiers) => void;
  onExplain: (level: StockLevel) => void;
}) {
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(level, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(level, event);
      }}
    >
      {/* `max-w-0 w-full` is load-bearing, not decoration. A table cell sizes to
          its content, so at 380px the product name kept pushing the row wider
          and shoved the state badge off the right edge — the one column that
          must never be the one to go. Zeroing the max width makes this the cell
          that GIVES, which is what lets the truncation below actually bite. */}
      <td className="w-full max-w-0">
        {/* Identity is two facts and they are not equals: the product name is
            what a person recognises, the code is how the shelf is labelled. */}
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{level.productTitle ?? 'Untitled product'}</span>
          <span className="truncate font-mono text-sm">{level.sku ?? 'No code'}</span>
          {/* Below @lg the Location column is gone, so it comes back here — a
              stock row without a place is not an answer. */}
          <span className="truncate text-sm @lg:hidden">{locationLabel(level)}</span>
          {/* And below @md the State column goes the same way. It was taking
              126px of a 360px row while the name it describes had 64 and read
              "Th…" — the header above promises the two that matter are what it
              is and how many can be sold, and this is what kept that promise
              from being true on a phone. */}
          <span className="mt-1 @md:hidden">
            <StateBadges level={level} />
          </span>
        </span>
      </td>
      <td className="hidden max-w-48 truncate @lg:table-cell">{locationLabel(level)}</td>
      <td className="text-right font-medium whitespace-nowrap tabular-nums">{sellable(level)}</td>
      <td className="hidden text-right tabular-nums @xl:table-cell">{level.onHand}</td>
      <td className="hidden text-right tabular-nums @3xl:table-cell">{level.allocated}</td>
      <td className="hidden @md:table-cell">
        <StateBadges level={level} />
      </td>
      <td>
        {/* `stopPropagation` because the row itself is a button: without it this
            opens the item pane AND the explanation, and the one that lands
            second wins — the opposite of what was clicked. */}
        <Tooltip content="Where this number came from">
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Where the number for ${level.sku ?? 'this item'} came from`}
            onClick={(event) => {
              event.stopPropagation();
              onExplain(level);
            }}
          >
            <Icon glyph={faShieldCheck} className="size-4" aria-hidden />
          </Button>
        </Tooltip>
      </td>
    </tr>
  );
}

/** What this level IS, plus how long since anybody checked. One component
 *  because the row shows it in a column when there is room and under the
 *  product name when there is not. */
function StateBadges({ level }: { level: StockLevel }) {
  const state = levelState(level);
  return (
    <span className="flex flex-wrap items-center gap-1">
      <Badge color={state.tone} variant="soft" size="sm">
        {state.label}
      </Badge>
      {/* Only when the number has actually gone stale. A row of "2 hours"
          beside every healthy line is noise that trains people to stop reading
          the column before it ever means anything. */}
      {stockAgeTone(level.ageSeconds) !== 'success' ? (
        <Badge color={stockAgeTone(level.ageSeconds)} variant="soft" size="sm">
          {humanDuration(level.ageSeconds)} old
        </Badge>
      ) : null}
    </span>
  );
}
