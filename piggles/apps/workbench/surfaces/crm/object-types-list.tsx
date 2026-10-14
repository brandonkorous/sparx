'use client';

// Record types: the four sparx ships (customers, companies, deals, requests) and
// anything the business invented. Never called "objects" or "schemas" on screen:
// adding a field to customers is writing down what she already keeps on a note.

import { useState, type Dispatch, type SetStateAction } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Button, Card, EmptyState } from '@wizeworks/silicaui-react';
import { faBoxes, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { createLabelFor, type SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { isModuleDisabled, useObjectTypes, type CrmObjectType } from './object-types-data';
import { ListFooter } from '../../components/list-footer';
import { ObjectTypesTable, targetFor } from './object-types-table';

function NewTypeButton({ ctx }: { ctx: SurfaceContext }) {
  const createLabel = createLabelFor('crm.object-types.list');
  return (
    <Button
      color="module"
      size="sm"
      className="ml-auto shrink-0"
      title={`${createLabel}: hold Shift to open alongside, Alt for a new window`}
      onClick={(event) => {
        ctx.open('crm.object-type.detail', { key: 'new' }, { target: targetFor(event) });
      }}
    >
      <Icon glyph={faPlus} className="size-4" aria-hidden />
      {createLabel}
    </Button>
  );
}

function ObjectTypesToolbar(props: {
  ctx: SurfaceContext;
  showArchived: boolean;
  setShowArchived: Dispatch<SetStateAction<boolean>>;
  query: ReturnType<typeof useObjectTypes>;
}) {
  const { ctx, showArchived, setShowArchived, query } = props;
  return (
    <PaneToolbar
      label="Things you track controls"
      primary={<NewTypeButton ctx={ctx} />}
      controls={
        <Button
          size="sm"
          color="neutral"
          variant={showArchived ? 'solid' : 'outline'}
          onClick={() => {
            setShowArchived((v) => !v);
          }}
        >
          {showArchived ? 'Hiding nothing' : 'Show put-away types'}
        </Button>
      }
      views={{
        target: '/crm/object-types',
        params: { archived: showArchived ? '1' : '' },
        onApply: (next) => {
          setShowArchived(next.archived === '1');
        },
      }}
      refresh={
        <RefreshButton
          isFetching={query.isFetching}
          updatedAt={query.data ? query.dataUpdatedAt : undefined}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    />
  );
}

function ObjectTypesBody(props: {
  ctx: SurfaceContext;
  rows: CrmObjectType[];
  query: ReturnType<typeof useObjectTypes>;
}) {
  const { ctx, rows, query } = props;
  if (isModuleDisabled(query.error)) {
    return (
      <EmptyState
        icon={<Icon glyph={faBoxes} className="size-6" aria-hidden />}
        title="Turn on Customers to see the things you track"
        description="Things you track appear once the Customers app is switched on. They are the kinds of things you keep track of (customers, companies, deals) and the extra details you record on each."
      />
    );
  }
  if (query.isError) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faBoxes} className="size-6" aria-hidden />}
        title="Could not load the things you track"
        description="Something went wrong reaching the server. It may be a temporary problem. Try again in a moment."
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (query.isPending) return <PaneWaiting />;
  if (rows.length === 0) {
    // With `list` self-healing the built-ins, an empty list means the
    // "put away" filter hid everything, never "you have nothing."
    return (
      <EmptyState
        icon={<Icon glyph={faBoxes} className="size-6" aria-hidden />}
        title="Nothing to show with this filter"
        description="Every thing you track is put away. Switch the filter above to see them."
      />
    );
  }
  return <ObjectTypesTable rows={rows} ctx={ctx} />;
}

export function ObjectTypesListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [showArchived, setShowArchived] = useState(false);
  const query = useObjectTypes({ includeArchived: showArchived });
  const rows = query.data?.items ?? [];

  return (
    <div className={PANE_SHELL}>
      <ObjectTypesToolbar
        ctx={ctx}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
        query={query}
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        <ObjectTypesBody ctx={ctx} rows={rows} query={query} />
      </Card>

      <ListFooter shown={rows.length} count={null} hint="one to add the extra details you track" />
    </div>
  );
}
