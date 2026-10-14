'use client';

// The list for a tenant-invented object (docs/144 §3.6).
//
// ONE SURFACE FOR EVERY CUSTOM OBJECT. The pane's `objectKey` param says which
// one; everything on screen — the title, the columns, the empty state's wording,
// the button that adds a row — comes from the object definition. A business that
// invents "Project" gets a working list with no code written for them,
// which is the entire promise of the registry.
//
// THE COLUMNS ARE THE FIRST FOUR PROPERTIES, in the order the business declared
// them. That ordering is not arbitrary: the property editor is a list somebody
// dragged into the order that made sense to them, so the order they chose is the
// best available answer to "which of these matters most", and guessing by type
// would override a decision they already made.
//
// The rows are records-table.tsx and the states are records-list-states.tsx
// (sparx persona issue 240, which also stopped a missing type drawing a list).

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@wizeworks/silicaui-react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { viewFilterValue, viewFilters } from './saved-views-menu';
import type { SavedView } from './workspace-data';
import { useObjectType } from './object-types-data';
import { useRecords } from './records-data';
import { ListFooter } from '../../components/list-footer';
import { countLabel } from '../../components/list-footer-words';
import {
  BuiltinScreen,
  NoRecords,
  RecordTypeMissing,
  RecordsLoadError,
} from './records-list-states';
import { RecordsTable, type RecordColumns } from './records-table';
import { RecordsToolbar } from './records-toolbar';

/** Where each built-in type lives instead. Keyed to the four in
 *  `BUILTIN_OBJECT_KEYS`; see `BuiltinScreen` for why this pane refuses them. */
const BUILTIN_SCREEN: Record<string, string> = {
  contact: 'crm.customers.list',
  company: 'crm.accounts.list',
  deal: 'crm.deals.list',
  ticket: 'crm.tickets.list',
};

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

/** Shift opens alongside, Alt pops out — the same modifier contract every other
 *  list in the workbench uses. */
function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** The search, the saved view, and what the type says about its columns. */
function useRecordsList(ctx: SurfaceContext, objectKey: string) {
  const [q, setQ] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const type = useObjectType(objectKey);
  const records = useRecords(objectKey, { q });

  // Saved views are keyed by object, and a tenant's own object is an object —
  // so the record type somebody invented last week gets the same control as
  // Customers, with no code written for it. That is the registry's whole point,
  // and a capability that stopped at the built-in lists would quietly say
  // otherwise.
  const currentFilters = viewFilters([
    q.trim() !== '' && { field: `${objectKey}.search`, operator: 'contains', value: q.trim() },
  ]);
  const applyView = (view: SavedView | null): void => {
    setViewId(view?.id ?? null);
    setQ(viewFilterValue(view, `${objectKey}.search`));
  };

  useEffect(() => {
    ctx.setTitle(type.data?.labelPlural ?? 'Records');
  }, [ctx, type.data?.labelPlural]);

  // The first four declared properties, plus whatever the business nominated as
  // the title — which leads, because it is what a person scans by.
  const columns = useMemo<RecordColumns>(() => {
    const fields = type.data?.propertySchema?.fields ?? [];
    const primaryKey = type.data?.primaryFieldKey ?? null;
    const rest = fields.filter((f) => f.key !== primaryKey).slice(0, 3);
    return { primaryKey, rest };
  }, [type.data]);

  return { q, setQ, viewId, type, records, currentFilters, applyView, columns };
}

export type RecordsListState = ReturnType<typeof useRecordsList>;
type ListState = RecordsListState;

/** The same four branches, in the same order, as every other list in the
 *  workbench — error, loading, no rows, rows. A tenant's own record type is not
 *  a lesser surface than Customers, and an empty state that skips the shared
 *  component is exactly where it starts looking like one. */
function RecordsCard(props: {
  list: ListState;
  label: string;
  labelPlural: string;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  const { list, label, labelPlural, onOpen } = props;
  const { records } = list;
  const rows = records.data?.items ?? [];
  return (
    <Card className="min-h-0 flex-1 overflow-y-auto">
      {records.isError ? (
        <RecordsLoadError
          labelPlural={labelPlural}
          error={records.error}
          onRetry={() => {
            void records.refetch();
          }}
        />
      ) : records.isPending ? (
        <PaneWaiting />
      ) : rows.length === 0 ? (
        <NoRecords
          label={label}
          labelPlural={labelPlural}
          filtered={list.q.trim() !== ''}
          onClear={() => {
            list.setQ('');
          }}
          onAdd={(event) => {
            onOpen('new', event);
          }}
        />
      ) : (
        <RecordsTable rows={rows} columns={list.columns} label={label} onOpen={onOpen} />
      )}
    </Card>
  );
}

function RecordsFooter({ list }: { list: ListState }) {
  const { records } = list;
  const rows = records.data?.items ?? [];
  return (
    <ListFooter
      shown={rows.length}
      count={countLabel({
        shown: rows.length,
        total: records.data?.total,
        filtered: list.q.trim() !== '',
        pending: records.isPending,
      })}
    />
  );
}

export function RecordsListSurface({ ctx }: { ctx: SurfaceContext }) {
  const objectKey = String(ctx.params.objectKey ?? '');
  const list = useRecordsList(ctx, objectKey);
  const { type } = list;
  const label = type.data?.label ?? 'record';
  const labelPlural = type.data?.labelPlural ?? 'records';
  const openRecord = (id: string, event: OpenEvent) => {
    ctx.open('crm.record.detail', { id, objectKey }, { target: targetFor(event) });
  };

  if (type.data?.kind === 'builtin') {
    return (
      <BuiltinScreen
        labelPlural={labelPlural}
        target={BUILTIN_SCREEN[objectKey]}
        onOpen={(target, event) => {
          ctx.open(target, {}, { target: targetFor(event) });
        }}
      />
    );
  }
  if (type.isError) {
    return (
      <RecordTypeMissing
        error={type.error}
        onRetry={() => {
          void type.refetch();
        }}
      />
    );
  }

  return (
    <div className={PANE_SHELL}>
      <RecordsToolbar
        list={list}
        objectKey={objectKey}
        label={label}
        labelPlural={labelPlural}
        onAdd={(event) => {
          openRecord('new', event);
        }}
      />
      <RecordsCard list={list} label={label} labelPlural={labelPlural} onOpen={openRecord} />
      <RecordsFooter list={list} />
    </div>
  );
}
