'use client';

// One task group (overdue / open / completed) rendered through the shared
// `SelectionList` dual-view substrate (docs/34 §7) so the surface gains the
// Table↔Cards toggle and honors the user's `defaultListView`. The page renders
// one `<TasksList>` per group (each keeps its own heading), all sharing the
// single `view`. Read-only selection (`selectable=false`): tasks have no bulk
// actions — the per-row inline Complete button is the only mutation.
//
// Card view reuses the existing `<TaskRow>` (its bespoke layout, complete
// affordance, and overdue styling) via `card.render`. Table view mirrors the
// same fields (complete · title · priority · related · due) and shares the
// complete Server Action through `TaskCompleteCell`.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Calendar } from 'lucide-react';

import { SelectionList, type SelectionCard, type SelectionColumn, toast } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';

import { completeTaskAction } from '../../activity-task-actions';
import { TaskRow, type TaskCard } from './task-row';

const PRIORITY_VARIANT: Record<string, 'neutral' | 'warning' | 'danger' | 'success'> = {
  low: 'neutral',
  medium: 'neutral',
  high: 'warning',
  urgent: 'danger',
};

// Table-view complete affordance — the same Server Action + refresh as the
// card's `<TaskRow>`, so completing from either view behaves identically.
function TaskCompleteCell({ task }: { task: TaskCard }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const isOpen = task.status === 'open';

  function complete() {
    startTransition(async () => {
      const result = await completeTaskAction(task.id);
      if (!result.ok) {
        toast.error(result.error.message ?? 'Could not complete task');
        return;
      }
      toast.success('Task completed');
      router.refresh();
    });
  }

  if (!isOpen) {
    return (
      <div
        // eslint-disable-next-line no-restricted-syntax -- completion indicator icon container, not a reimplemented control
        className="bg-success flex h-5 w-5 items-center justify-center rounded-md text-white"
      >
        <Check className="h-3 w-3" />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={complete}
      disabled={pending}
      aria-label="Complete task"
      className="border-base-300 hover:border-module flex h-5 w-5 items-center justify-center rounded-md border disabled:opacity-50"
    >
      {pending && <Check className="h-3 w-3 animate-pulse" />}
    </button>
  );
}

interface TasksListProps {
  tasks: TaskCard[];
  view: 'table' | 'card';
  /** Render the overdue treatment in the card view. */
  overdue?: boolean;
}

export function TasksList({ tasks, view, overdue }: TasksListProps) {
  const relatedLinks = (t: TaskCard) => (
    <div className="flex flex-row flex-wrap items-center gap-2">
      {t.customerId && (
        <Link
          href={`/crm/customers/${t.customerId}`}
          className="text-base-content/50 hover:text-module text-xs hover:underline"
        >
          Customer
        </Link>
      )}
      {t.dealId && (
        <Link
          href={`/crm/deals/${t.dealId}`}
          className="text-base-content/50 hover:text-module text-xs hover:underline"
        >
          Deal
        </Link>
      )}
      {!t.customerId && !t.dealId && <p className="text-base-content/70 text-xs">—</p>}
    </div>
  );

  const dueCell = (t: TaskCard) =>
    t.dueAt ? (
      <div className="flex flex-row items-center gap-1">
        <Calendar className="text-base-content/50 h-3.5 w-3.5" />
        <p className="text-base-content/70 text-xs">
          {new Date(t.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </p>
      </div>
    ) : (
      <p className="text-base-content/70 text-xs">—</p>
    );

  const columns: SelectionColumn<TaskCard>[] = [
    {
      header: '',
      id: 'complete',
      cell: (t) => <TaskCompleteCell task={t} />,
      headClassName: 'w-10',
    },
    {
      header: 'Title',
      cell: (t) => (
        <p
          className={`text-sm font-medium ${
            t.status === 'open' ? '' : 'text-base-content/50 line-through'
          }`}
        >
          {t.title}
        </p>
      ),
    },
    {
      header: 'Priority',
      cell: (t) => (
        <Badge color={PRIORITY_VARIANT[t.priority] ?? 'neutral'} variant="soft" size="sm">
          {t.priority}
        </Badge>
      ),
    },
    { header: 'Related', cell: relatedLinks },
    { header: 'Due', align: 'right', cell: dueCell },
  ];

  const card: SelectionCard<TaskCard> = {
    title: (t) => <p className="text-sm font-medium">{t.title}</p>,
    render: (t) => <TaskRow task={t} overdue={overdue} />,
  };

  return (
    <SelectionList
      items={tasks}
      view={view}
      getId={(t) => t.id}
      getRowLabel={(t) => t.title}
      entityLabelPlural="tasks"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
