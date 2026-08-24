'use client';

// The stock-counts table. The columns disclose with @container: docked narrow
// you see the location, its number and its state, with the progress and the
// difference folded under the name; given room they come back as their own
// right-aligned numeric columns. The name cell is the one that GIVES
// (`max-w-0 w-full`), so the State badge is never shoved off the right edge.

import { Badge, Timestamp } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { countState, type CountRow } from './counts-data';
import { differenceLabel, summaryLine } from './counts-list-summary';

interface Modifiers {
  shiftKey: boolean;
  altKey: boolean;
}

export function CountsListTable({
  rows,
  onOpen,
}: {
  rows: CountRow[];
  onOpen: (count: CountRow, event: Modifiers) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Count</th>
          <th className="hidden text-right whitespace-nowrap @lg:table-cell">Counted</th>
          <th className="hidden text-right whitespace-nowrap @xl:table-cell">Difference</th>
          <th className="hidden @3xl:table-cell">Started</th>
          <th>State</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((count) => (
          <CountRowCells key={count.id} count={count} onOpen={onOpen} />
        ))}
      </tbody>
    </Table>
  );
}

function CountRowCells({
  count,
  onOpen,
}: {
  count: CountRow;
  onOpen: (count: CountRow, event: Modifiers) => void;
}) {
  const state = countState(count.status);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(count, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(count, event);
      }}
    >
      <td className="w-full max-w-0">
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{count.warehouseName ?? 'Stock count'}</span>
          <span className="truncate font-mono text-sm">{count.number}</span>
          {/* Below @lg the Counted and Difference columns are gone, so the
              plain-language summary folds back here; below @3xl the Started
              column folds back too.

              It WRAPS rather than truncating. This line is the only place those
              two numbers appear at this width, so cutting it off does not
              shorten the row — it deletes the row's content and leaves the
              chrome. Two lines is the cap.

              The count TYPE is deliberately not here. It never had a column to
              fold back from, and at 360px "Everything at this location · " ate
              the half of the line the numbers needed. It is on the count. */}
          <span className="line-clamp-2 text-sm @lg:hidden">{summaryLine(count)}</span>
          <span className="truncate text-sm @3xl:hidden">
            Started <Timestamp value={count.createdAt} format="relative" />
          </span>
        </span>
      </td>
      <td className="hidden text-right whitespace-nowrap tabular-nums @lg:table-cell">
        {count.countedLineCount}/{count.lineCount}
      </td>
      {/* Not `tabular-nums`: this cell is a number most of the time and a short
          phrase when nothing has a cost to value it with. */}
      <td className="hidden text-right whitespace-nowrap @xl:table-cell">
        {differenceLabel(count)}
      </td>
      <td className="hidden whitespace-nowrap @3xl:table-cell">
        <Timestamp value={count.createdAt} format="relative" />
      </td>
      <td>
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </td>
    </tr>
  );
}
