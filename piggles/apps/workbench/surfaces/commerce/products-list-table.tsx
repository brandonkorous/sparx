'use client';

// The catalog table.
//
// It lives in a pane of unknown width — 320px beside a product, or the whole
// window — so columns disclose with @container, never a viewport query: pane
// width and screen width are unrelated, and a viewport breakpoint leaves a
// narrow pane on a wide monitor rendering six columns into 300px.

import { Badge } from '@wizeworks/silicaui-react';
import { faArrowDown, faArrowUp } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../components/table';
import { ChooseCell, SelectAllCell } from '../../components/selection-cells';
import type { ListSelection } from '../../lib/workbench/selection';
import {
  formatDate,
  priceLabel,
  productState,
  type ProductRow,
  type ProductSortKey,
  type SortDirection,
} from './products-data';
import type { Modifiers } from './products-list-shared';

export interface Sort {
  key: ProductSortKey;
  dir: SortDirection;
}

function SortHeader({
  column,
  label,
  sort,
  onSort,
  className,
}: {
  column: ProductSortKey;
  label: string;
  sort: Sort;
  onSort: (key: ProductSortKey) => void;
  className?: string;
}) {
  const active = sort.key === column;
  return (
    <th
      className={className ?? ''}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="link link-hover inline-flex items-center gap-1"
        onClick={() => {
          onSort(column);
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

function Row({
  product,
  chosen,
  onChoose,
  onOpen,
}: {
  product: ProductRow;
  chosen: boolean;
  onChoose: (on: boolean, modifiers: { shiftKey: boolean }) => void;
  onOpen: (product: ProductRow, event: Modifiers) => void;
}) {
  const state = productState(product);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(event) => {
        onOpen(product, event);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(product, event);
      }}
    >
      <ChooseCell checked={chosen} label={`Choose ${product.title}`} onToggle={onChoose} />
      <td>
        {/* The name IS the row. The web address underneath is a note about it,
            so it is smaller — but at full ink, not faded: it is there to be
            read. */}
        <span className="block truncate font-medium">{product.title}</span>
        <span className="block truncate font-mono text-sm">/{product.handle}</span>
      </td>
      <td className="hidden max-w-40 truncate whitespace-nowrap @xl:table-cell">
        {product.vendor ?? product.productType ?? '—'}
      </td>
      <td className="hidden text-right tabular-nums @2xl:table-cell">{product.variantCount}</td>
      <td className="hidden text-sm whitespace-nowrap @4xl:table-cell">
        {formatDate(product.updatedAt)}
      </td>
      <td className="text-right font-medium whitespace-nowrap tabular-nums">
        {priceLabel(product)}
      </td>
      <td className="whitespace-nowrap">
        <Badge color={state.tone} variant="soft" size="sm">
          {state.label}
        </Badge>
      </td>
    </tr>
  );
}

export function ProductsListTable({
  rows,
  sort,
  onSort,
  onOpen,
  selection,
}: {
  rows: ProductRow[];
  sort: Sort;
  onSort: (key: ProductSortKey) => void;
  onOpen: (product: ProductRow, event: Modifiers) => void;
  selection: ListSelection<ProductRow>;
}) {
  return (
    <Table size="sm" hover>
      <thead>
        <tr>
          <SelectAllCell
            allChosen={selection.allOnPageChosen}
            someChosen={selection.someOnPageChosen}
            disabled={rows.length === 0}
            label="Choose every product on this page"
            onToggle={selection.toggleAllOnPage}
          />
          <SortHeader
            column="title"
            label="Product"
            sort={sort}
            onSort={onSort}
            className="w-full"
          />
          <th className="hidden @xl:table-cell">Brand</th>
          <th className="hidden text-right @2xl:table-cell">Versions</th>
          <SortHeader
            column="updatedAt"
            label="Changed"
            sort={sort}
            onSort={onSort}
            className="hidden @4xl:table-cell"
          />
          <SortHeader
            column="priceMinCents"
            label="Price"
            sort={sort}
            onSort={onSort}
            className="text-right"
          />
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((product) => (
          <Row
            key={product.id}
            product={product}
            chosen={selection.has(product.id)}
            onChoose={(on, modifiers) => {
              selection.toggle(product, on, modifiers);
            }}
            onOpen={onOpen}
          />
        ))}
      </tbody>
    </Table>
  );
}
