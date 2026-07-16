'use client';

// Task row — title + priority + due date + complete button.
// Complete is an inline action that hits taskService.complete via the
// Server Action; no navigation required.

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Calendar } from 'lucide-react';

import { toast } from '@sparx/ui';
import { Badge, Button } from '@wizeworks/silicaui-react';

import { completeTaskAction } from '../../activity-task-actions';

export interface TaskCard {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  customerId: string | null;
  dealId: string | null;
  assignedToUserId: string;
}

const PRIORITY_VARIANT: Record<string, 'neutral' | 'warning' | 'danger' | 'success'> = {
  low: 'neutral',
  medium: 'neutral',
  high: 'warning',
  urgent: 'danger',
};

export function TaskRow({ task, overdue }: { task: TaskCard; overdue?: boolean }) {
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

  const dueText = task.dueAt
    ? new Date(task.dueAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div
      className={`flex flex-row items-center gap-3 rounded-md border p-3 ${
        overdue ? 'border-danger bg-danger/10' : 'border-base-300'
      }`}
    >
      {isOpen && (
        <button
          type="button"
          onClick={complete}
          disabled={pending}
          aria-label="Complete task"
          className="border-base-300 hover:border-module flex h-5 w-5 items-center justify-center rounded-md border disabled:opacity-50"
        >
          {pending && <Check className="h-3 w-3 animate-pulse" />}
        </button>
      )}
      {!isOpen && (
        <div
          // eslint-disable-next-line no-restricted-syntax -- completion indicator icon container, not a reimplemented control
          className="bg-success flex h-5 w-5 items-center justify-center rounded-md text-white"
        >
          <Check className="h-3 w-3" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={`text-sm font-medium ${isOpen ? '' : 'text-base-content line-through'}`}>
          {task.title}
        </p>
        <div className="flex flex-row flex-wrap items-center gap-2">
          <Badge color={PRIORITY_VARIANT[task.priority] ?? 'neutral'} variant="soft" size="sm">
            {task.priority}
          </Badge>
          {task.customerId && (
            <Link
              href={`/crm/customers/${task.customerId}`}
              className="text-base-content hover:text-module text-xs hover:underline"
            >
              Customer
            </Link>
          )}
          {task.dealId && (
            <Link
              href={`/crm/deals/${task.dealId}`}
              className="text-base-content hover:text-module text-xs hover:underline"
            >
              Deal
            </Link>
          )}
        </div>
      </div>
      {dueText && (
        <div className="flex flex-row items-center gap-1">
          <Calendar className="text-base-content h-3.5 w-3.5" />
          <p className="text-base-content text-xs">{dueText}</p>
        </div>
      )}
      {isOpen && !pending && (
        <Button variant="ghost" size="sm" onClick={complete}>
          Complete
        </Button>
      )}
    </div>
  );
}
