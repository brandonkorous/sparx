'use client';

import * as React from 'react';
import { cn } from '../../utils/cn';
import { Checkbox } from '../primitives/checkbox';
import { Table } from '@wizeworks/silicaui-react';
import { Card, CardContent } from '../layout/card';
import { Stack } from '../layout/stack';
import { Grid } from '../layout/grid';
import { BulkActionBar, type BulkAction } from './bulk-action-bar';

// SelectionList — the shared Collection/List substrate (docs/34 §4 archetype 2,
// §7). One component renders BOTH the `table` and `card` views the
// `ListToolbar` view toggle flips between, and owns row-selection state + the
// `BulkActionBar`. The page stays a server component: it fetches data, renders
// `<ListToolbar enableViewToggle/>`, computes `view` from `?view=` ?? the user's
// `defaultListView` preference (§7.2), and hands rows + `view` here.
//
// App-specific concerns are injected, never imported, so this stays a pure
// `@sparx/ui` primitive reusable by any future app (e.g. an admin console):
//   - row navigation: the consumer renders its own link inside `columns[].cell`
//     and `card.title` (the dashboard uses `EntityRowLink`, which resolves the
//     detail-view preference) — SelectionList never knows about routing.
//   - the checkbox column, select-all, the Card/Table chrome, the auto-fill card
//     Grid, selection state, and the bulk bar are owned here so every list
//     behaves identically.
//
// Cards use the standard shell (leading checkbox + title/subtitle block +
// top-right badge + a free-form body); a list whose card needs a bespoke layout
// passes `card.render` as a full escape hatch.

export interface SelectionColumn<T> {
  /** Column header — usually a string (rendered uppercase-muted by `Table`). */
  header: React.ReactNode;
  /** Cell renderer for this column. */
  cell: (item: T) => React.ReactNode;
  /** Right-align the header + cell and apply `tabular-nums` (numeric columns). */
  align?: 'left' | 'right';
  /** Stable key — required only when `header` is not a string. */
  id?: string;
  headClassName?: string;
  cellClassName?: string;
}

export interface SelectionCardContext {
  selected: boolean;
  toggle: () => void;
}

export interface SelectionCard<T> {
  /** Card heading — typically the same link used in the first table column. */
  title: (item: T) => React.ReactNode;
  /** Optional sub-line under the title (handle, email, …). */
  subtitle?: (item: T) => React.ReactNode;
  /** Optional top-right element (usually a status `Badge`). */
  badge?: (item: T) => React.ReactNode;
  /** Free-form body rendered below the header row. */
  body?: (item: T) => React.ReactNode;
  /** Full escape hatch — overrides the structured slots and renders the whole
   *  card (including its own checkbox via `ctx`). For bespoke card layouts. */
  render?: (item: T, ctx: SelectionCardContext) => React.ReactNode;
}

export interface SelectionListProps<T> {
  items: T[];
  view: 'table' | 'card';
  /** Stable id for an item — keys, selection, and aria labels derive from it. */
  getId: (item: T) => string;
  /** Table columns (the leading checkbox column is added automatically). */
  columns: SelectionColumn<T>[];
  /** Card-view rendering. */
  card: SelectionCard<T>;
  /** Bulk actions; the bar is omitted entirely when none are given. */
  bulkActions?: BulkAction[];
  /** Whether rows are selectable (checkbox column + select-all + bulk bar).
   *  Defaults to `true` when `bulkActions` are supplied, `false` otherwise — so
   *  a read-only list (no bulk actions) renders no checkboxes. */
  selectable?: boolean;
  /** Plural noun for the "Select all {plural}" label, e.g. "products". */
  entityLabelPlural?: string;
  /** Per-row select aria-label text, e.g. `(p) => p.title`. Defaults to the id. */
  getRowLabel?: (item: T) => string;
  /** Rendered after the list + bar — e.g. a bulk-edit modal needing the live
   *  selection (receives the present selection + a clear callback). */
  renderAfter?: (ctx: { selected: string[]; clear: () => void }) => React.ReactNode;
  className?: string;
}

export function SelectionList<T>({
  items,
  view,
  getId,
  columns,
  card,
  bulkActions,
  selectable,
  entityLabelPlural = 'items',
  getRowLabel,
  renderAfter,
  className,
}: SelectionListProps<T>) {
  const hasBulk = !!bulkActions && bulkActions.length > 0;
  const isSelectable = selectable ?? hasBulk;
  const [selected, setSelected] = React.useState<string[]>([]);

  const ids = items.map(getId);
  const selectedSet = new Set(selected);
  // Intersect with present ids on read so a filter change / server refetch that
  // drops rows never leaves the bulk bar counting stale selections.
  const presentSelected = ids.filter((id) => selectedSet.has(id));
  const allSelected = ids.length > 0 && presentSelected.length === ids.length;
  const someSelected = presentSelected.length > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? [] : ids);
  }
  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  const clear = React.useCallback(() => setSelected([]), []);

  const rowLabel = (item: T) => getRowLabel?.(item) ?? getId(item);
  const colKey = (col: SelectionColumn<T>, i: number) =>
    col.id ?? (typeof col.header === 'string' ? col.header : `col-${i}`);

  const bar =
    isSelectable && hasBulk ? (
      <BulkActionBar selected={presentSelected} onClear={clear} actions={bulkActions} />
    ) : null;
  const after = renderAfter?.({ selected: presentSelected, clear });

  if (view === 'card') {
    return (
      <>
        {bar}
        <Grid minItemWidth="18rem" gap={4} className={className}>
          {items.map((item) => {
            const id = getId(item);
            const isSelected = selectedSet.has(id);
            if (card.render) {
              return (
                <React.Fragment key={id}>
                  {card.render(item, { selected: isSelected, toggle: () => toggle(id) })}
                </React.Fragment>
              );
            }
            return (
              <Card key={id} variant="default" padding="md">
                <Stack gap={3}>
                  <Stack direction="row" align="start" justify="between" gap={2}>
                    {isSelectable ? (
                      <Stack direction="row" align="start" gap={2} className="min-w-0">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggle(id)}
                          aria-label={`Select ${rowLabel(item)}`}
                          className="mt-0.5 shrink-0"
                        />
                        <Stack gap={1} className="min-w-0">
                          {card.title(item)}
                          {card.subtitle?.(item)}
                        </Stack>
                      </Stack>
                    ) : (
                      <Stack gap={1} className="min-w-0">
                        {card.title(item)}
                        {card.subtitle?.(item)}
                      </Stack>
                    )}
                    {card.badge?.(item)}
                  </Stack>
                  {card.body?.(item)}
                </Stack>
              </Card>
            );
          })}
        </Grid>
        {after}
      </>
    );
  }

  return (
    <>
      {bar}
      <Card padding="none" className={className}>
        <CardContent className="p-0">
          <Table hover wrapperClassName="overflow-x-auto">
            <thead>
              <tr>
                {isSelectable && (
                  <th className="w-10">
                    <Checkbox
                      checked={someSelected ? 'indeterminate' : allSelected}
                      onCheckedChange={toggleAll}
                      aria-label={`Select all ${entityLabelPlural}`}
                    />
                  </th>
                )}
                {columns.map((col, i) => (
                  <th
                    key={colKey(col, i)}
                    className={cn(col.align === 'right' && 'text-right', col.headClassName)}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const id = getId(item);
                const isSelected = selectedSet.has(id);
                return (
                  <tr
                    key={id}
                    data-state={isSelected ? 'selected' : undefined}
                    className="group data-[state=selected]:bg-module/10"
                  >
                    {isSelectable && (
                      <td className="w-10">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggle(id)}
                          aria-label={`Select ${rowLabel(item)}`}
                        />
                      </td>
                    )}
                    {columns.map((col, i) => (
                      <td
                        key={colKey(col, i)}
                        className={cn(
                          col.align === 'right' && 'text-right tabular-nums',
                          col.cellClassName
                        )}
                      >
                        {col.cell(item)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </CardContent>
      </Card>
      {after}
    </>
  );
}
