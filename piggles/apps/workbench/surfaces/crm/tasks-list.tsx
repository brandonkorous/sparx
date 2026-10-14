'use client';

// The tasks list: the work the team owes customers and deals, as a table
// matching the other CRM lists (the rows live in tasks-table.tsx).

import { useState, type Dispatch, type SetStateAction } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Button, Card, SearchInput, Select } from '@wizeworks/silicaui-react';
import { faListCheck, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { createLabelFor, type OpenTarget, type SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { RefreshButton } from '../../components/refresh-button';
import { useTasks, type Task, type TaskStatus } from './tasks-data';
import { ListFooter } from '../../components/list-footer';
import { countLabel } from '../../components/list-footer-words';
import { TasksTable } from './tasks-table';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'crm';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}
type StatusFilter = 'all' | TaskStatus;
interface CreateFirst {
  label: string;
  onClick: (event: OpenEvent) => void;
}

const STATUS_ITEMS = {
  open: 'To do',
  completed: 'Done',
  cancelled: 'Canceled',
  all: 'Everything',
};

function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function CreateButton({ createFirst }: { createFirst: CreateFirst }) {
  return (
    <Button
      color="module"
      size="sm"
      className="ml-auto shrink-0"
      title={`${createFirst.label}: hold Shift to open alongside, Alt for a new window`}
      onClick={createFirst.onClick}
    >
      <Icon glyph={faPlus} className="size-4" aria-hidden />
      {createFirst.label}
    </Button>
  );
}

function StatusSelect(props: {
  status: StatusFilter;
  setStatus: Dispatch<SetStateAction<StatusFilter>>;
}) {
  return (
    <div className="w-36 shrink-0">
      <Select
        color="module"
        size="sm"
        aria-label="Which ones to show"
        value={props.status}
        items={STATUS_ITEMS}
        onValueChange={(next) => {
          props.setStatus(next as StatusFilter);
        }}
      />
    </div>
  );
}

function TasksToolbar({ pane }: { pane: ReturnType<typeof useTasksPane> }) {
  const { search, setSearch, status, setStatus, query } = pane;
  return (
    <PaneToolbar
      label="Things to do controls"
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            color="module"
            size="sm"
            aria-label="Search things to do"
            placeholder="Search things to do…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
      }
      primary={<CreateButton createFirst={pane.createFirst} />}
      controls={<StatusSelect status={status} setStatus={setStatus} />}
      views={{
        target: '/crm/tasks',
        params: { q: search, status },
        onApply: (next) => {
          setSearch(next.q ?? '');
          // "To do" is this list's neutral, not "all": a view that says nothing
          // about status is asking the question it opens with.
          setStatus(next.status ? (next.status as StatusFilter) : 'open');
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

function TasksBody({ pane, rows }: { pane: ReturnType<typeof useTasksPane>; rows: Task[] }) {
  const { query } = pane;
  if (query.isError) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faListCheck} className="size-6" aria-hidden />}
        title="Could not load your list"
        description="Something went wrong reaching the server. It may be a temporary problem. Try again in a moment."
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  if (query.isPending) return <PaneWaiting />;
  if (rows.length > 0) return <TasksTable rows={rows} onOpen={pane.open} />;
  return (
    <ListEmptyState
      module={MODULE}
      filtered={pane.filtered}
      noResults={{
        icon: <Icon glyph={faListCheck} className="size-6" aria-hidden />,
        title: 'Nothing matches those filters',
        description:
          'Try a different word, or change the filter: anything done or dropped is hidden unless you ask for it.',
      }}
      firstRun={{
        title: 'Nothing to do',
        description:
          // True whether or not tasks exist: the list opens on "To do", so
          // "add your first one" was said to an owner with tasks done.
          'This is what you owe people: a call to return, a quote to chase, a sample to send. A new one shows up here with its due date; finished ones are under Done in the filter above.',
        action: pane.createFirst,
      }}
    />
  );
}

function useTasksPane(ctx: SurfaceContext) {
  const createLabel = createLabelFor('crm.tasks.list');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('open');

  const query = useTasks({
    q: search,
    status: status === 'all' ? undefined : status,
  });

  const filtered = search.trim() !== '' || status !== 'open';
  const open = (task: Task, event: OpenEvent) => {
    ctx.open('crm.task.detail', { id: task.id }, { target: targetFor(event) });
  };
  // ONE object for the toolbar's button and the empty state's invitation, so
  // the label cannot drift and the first-run state always has a button.
  const createFirst: CreateFirst = {
    label: createLabel,
    onClick: (event) => {
      ctx.open('crm.task.detail', { id: 'new' }, { target: targetFor(event) });
    },
  };
  return { search, setSearch, status, setStatus, query, filtered, open, createFirst };
}

export function TasksListSurface({ ctx }: { ctx: SurfaceContext }) {
  const pane = useTasksPane(ctx);
  const { query } = pane;
  const rows = query.data?.items ?? [];

  return (
    <div className={PANE_SHELL}>
      <TasksToolbar pane={pane} />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        <TasksBody pane={pane} rows={rows} />
      </Card>

      <ListFooter
        shown={rows.length}
        count={countLabel({
          shown: rows.length,
          total: query.data?.total,
          filtered: pane.filtered,
          pending: query.isPending,
          noun: 'to do',
        })}
      />
    </div>
  );
}
