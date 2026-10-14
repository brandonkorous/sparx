'use client';

// The page results table. Every page, including the ones nobody visited: a row with
// 0 views is the most actionable line, a page nothing links to or search never found.

import { Badge } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import {
  formatCount,
  formatLoad,
  formatMoney,
  loadTone,
  seoTone,
  type PageResultRow,
} from './page-results-data';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

// A collection template shows the total across every item it renders, so it says
// so out loud or its numbers look wrong next to its own address.
function subtitleOf(row: PageResultRow): string {
  if (row.pathPrefix) {
    return row.pathsCovered === 0
      ? `Every page under ${row.pathPrefix}: none of them visited yet`
      : `Every page under ${row.pathPrefix} (${formatCount(row.pathsCovered)} of them visited)`;
  }
  return row.path;
}

function SearchCell({ row }: { row: PageResultRow }) {
  return (
    <td className="hidden @3xl:table-cell">
      {row.noindex ? (
        <Badge color="neutral" variant="soft" size="sm">
          Hidden on purpose
        </Badge>
      ) : (
        <Badge color={seoTone(row.seoScore)} variant="soft" size="sm">
          {row.seoScore == null ? 'Not checked yet' : `${String(row.seoScore)} / 100`}
        </Badge>
      )}
    </td>
  );
}

function SalesCells({ row, untraced }: { row: PageResultRow; untraced: boolean }) {
  return (
    <>
      <td className="hidden text-right @xl:table-cell">
        {/* Orders beside the rate: "20%" of five people is one sale. */}
        {untraced || row.conversionPct == null
          ? '—'
          : `${formatCount(row.orders)} (${String(row.conversionPct)}%)`}
      </td>
      <td className="text-right">
        {!untraced && row.revenueCents > 0 ? formatMoney(row.revenueCents) : '—'}
      </td>
    </>
  );
}

function ResultRow({
  row,
  commerce,
  untraced,
  onOpen,
}: {
  row: PageResultRow;
  commerce: boolean;
  untraced: boolean;
  onOpen: (row: PageResultRow, event: OpenEvent) => void;
}) {
  return (
    <tr
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
      <td>
        <span className="block max-w-64 truncate font-semibold">{row.name}</span>
        <span className="block max-w-64 truncate">{subtitleOf(row)}</span>
      </td>
      <td className="text-right">{formatCount(row.visitors)}</td>
      <td className="hidden text-right @lg:table-cell">{formatCount(row.views)}</td>
      {commerce ? <SalesCells row={row} untraced={untraced} /> : null}
      <td className="hidden @2xl:table-cell">
        <Badge color={loadTone(row.loadMs)} variant="soft" size="sm">
          {formatLoad(row.loadMs)}
        </Badge>
      </td>
      <SearchCell row={row} />
    </tr>
  );
}

export function PageResultsTable({
  rows,
  commerce,
  untraced,
  onOpen,
}: {
  rows: PageResultRow[];
  commerce: boolean;
  untraced: boolean;
  onOpen: (row: PageResultRow, event: OpenEvent) => void;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <th>Page</th>
          <th className="text-right">People</th>
          <th className="hidden text-right @lg:table-cell">Times opened</th>
          {commerce ? <th className="hidden text-right @xl:table-cell">Bought</th> : null}
          {commerce ? <th className="text-right">Sales</th> : null}
          <th className="hidden @2xl:table-cell">Time to appear</th>
          <th className="hidden @3xl:table-cell">Found by search</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <ResultRow
            key={row.pageId}
            row={row}
            commerce={commerce}
            untraced={untraced}
            onOpen={onOpen}
          />
        ))}
      </tbody>
    </Table>
  );
}
