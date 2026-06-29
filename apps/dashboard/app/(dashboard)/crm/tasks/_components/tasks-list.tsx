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

import {
  Badge,
  SelectionList,
  type SelectionCard,
  type SelectionColumn,
  Stack,
  Text,
  toast,
} from '@sparx/ui';

import { completeTaskAction } from '../../activity-task-actions';
import { TaskRow, type TaskCard } from './task-row';

const PRIORITY_VARIANT: Record<string, 'outline' | 'warning' | 'danger' | 'success'> = {
  low: 'outline',
  medium: 'outline',
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
        className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-success-500)] text-white"
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
      className="flex h-5 w-5 items-center justify-center rounded-md border border-[var(--color-border-default)] hover:border-[var(--module-active)] disabled:opacity-50"
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
    <Stack direction="row" align="center" gap={2} wrap>
      {t.customerId && (
        <Link
          href={`/crm/customers/${t.customerId}`}
          className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--module-active)] hover:underline"
        >
          Customer
        </Link>
      )}
      {t.dealId && (
        <Link
          href={`/crm/deals/${t.dealId}`}
          className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--module-active)] hover:underline"
        >
          Deal
        </Link>
      )}
      {!t.customerId && !t.dealId && (
        <Text size="xs" variant="muted">
          —
        </Text>
      )}
    </Stack>
  );

  const dueCell = (t: TaskCard) =>
    t.dueAt ? (
      <Stack direction="row" align="center" gap={1}>
        <Calendar className="h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
        <Text size="xs" variant="muted">
          {new Date(t.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
      </Stack>
    ) : (
      <Text size="xs" variant="muted">
        —
      </Text>
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
        <Text
          size="sm"
          weight="medium"
          className={t.status === 'open' ? '' : 'text-[var(--color-text-tertiary)] line-through'}
        >
          {t.title}
        </Text>
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
    title: (t) => (
      <Text size="sm" weight="medium">
        {t.title}
      </Text>
    ),
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
