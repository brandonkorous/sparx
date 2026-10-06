'use client';

// The tasks list — the work the team owes customers and deals.
//
// A table, matching the other CRM lists: the task's title is the anchor, with its
// state, when it is due, and what it is about in their own columns. The two facts
// a queue is scanned for — is it done, and is it late — carry semantic color, so
// an overdue open task reads red without anyone hunting for it.

import { useMemo, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { Badge, Button, Card, SearchInput, Select } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { faListCheck, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { createLabelFor, type OpenTarget, type SurfaceContext } from '../../lib/surfaces/registry';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { ListEmptyState } from '../../components/list-empty-state';
import { PaneLoadError } from '../../components/pane-load-error';
import { RefreshButton } from '../../components/refresh-button';
import {
  isOverdue,
  taskStatusMeta,
  taskSubject,
  useTasks,
  type Task,
  type TaskStatus,
} from './tasks-data';
import { ListFooter } from '../../components/list-footer';
import { countLabel } from '../../components/list-footer-words';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'crm';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function TasksListSurface({ ctx }: { ctx: SurfaceContext }) {
  const createLabel = createLabelFor('crm.tasks.list');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | TaskStatus>('open');

  const { data, isPending, isError, isFetching, dataUpdatedAt, refetch } = useTasks({
    q: search,
    status: status === 'all' ? undefined : status,
  });

  const rows = data?.items ?? [];
  const total = data?.total;
  const filtered = search.trim() !== '' || status !== 'open';

  const statusItems = useMemo(
    () => ({
      open: 'To do',
      completed: 'Done',
      cancelled: 'Canceled',
      all: 'Everything',
    }),
    []
  );

  const open = (task: Task, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('crm.task.detail', { id: task.id }, { target: targetFor(event) });
  };
  // ONE object, two places: the toolbar's button and the empty state's
  // invitation. Split, the label drifts — and the first-run state used to
  // have no button at all, so "Add your first one" pointed at nothing.
  const createFirst = {
    label: createLabel,
    onClick: (event: { shiftKey: boolean; altKey: boolean }) => {
      ctx.open('crm.task.detail', { id: 'new' }, { target: targetFor(event) });
    },
  };

  return (
    <div className={PANE_SHELL}>
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
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0"
            title={`${createLabel}: hold Shift to open alongside, Alt for a new window`}
            onClick={createFirst.onClick}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            {createFirst.label}
          </Button>
        }
        controls={
          <div className="w-36 shrink-0">
            <Select
              color="module"
              size="sm"
              aria-label="Which ones to show"
              value={status}
              items={statusItems}
              onValueChange={(next) => {
                setStatus(next as 'all' | TaskStatus);
              }}
            />
          </div>
        }
        views={{
          target: '/crm/tasks',
          params: { q: search, status },
          onApply: (next) => {
            setSearch(next.q ?? '');
            // "To do" is this list's neutral, not "all" — a view that says
            // nothing about status is asking the question it opens with.
            setStatus(next.status ? (next.status as 'all' | TaskStatus) : 'open');
          },
        }}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      <Card className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <PaneLoadError
            icon={<Icon glyph={faListCheck} className="size-6" aria-hidden />}
            title="Could not load your list"
            description="Something went wrong reaching the server. It may be a temporary problem. Try again in a moment."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : isPending ? (
          <PaneWaiting />
        ) : rows.length === 0 ? (
          <ListEmptyState
            module={MODULE}
            filtered={filtered}
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
              action: createFirst,
            }}
          />
        ) : (
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>What to do</th>
                <th>Status</th>
                <th className="text-right">Due</th>
                <th className="hidden @lg:table-cell">For</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const overdue = isOverdue(row);
                const meta = taskStatusMeta(row.status, overdue);
                const subject = taskSubject(row);
                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      open(row, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      open(row, event);
                    }}
                  >
                    <td className="font-medium">{row.title}</td>
                    <td>
                      <Badge color={meta.tone} variant="soft" size="sm">
                        {meta.label}
                      </Badge>
                    </td>
                    <td className="text-right">
                      {overdue ? (
                        <Badge color="danger" variant="soft" size="sm">
                          {shortDate(row.dueAt)}
                        </Badge>
                      ) : (
                        <span className="text-sm">{shortDate(row.dueAt)}</span>
                      )}
                    </td>
                    <td className="hidden text-sm @lg:table-cell">{subject ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <ListFooter
        shown={rows.length}
        count={countLabel({
          shown: rows.length,
          total,
          filtered,
          pending: isPending,
          noun: 'to do',
        })}
      />
    </div>
  );
}
