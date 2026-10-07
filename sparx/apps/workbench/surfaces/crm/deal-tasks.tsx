'use client';

// THE FOLLOW-UPS ON ONE DEAL.
//
// A task can belong to a deal: the column, the API filter and the task form's
// `dealId` preset all existed, and nothing opened it. The deal page showed no
// tasks and offered none, so "send Renée the pricing sheet" could only be filed
// against a person or nothing (sparx persona issue 115).

import { Badge, Button, Table, Text } from '@wizeworks/silicaui-react';
import { Plus } from 'lucide-react';
import { FormSection } from '../../components/form-section';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { isOverdue, taskForDealParams, taskStatusMeta, useTasks } from './tasks-data';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function dueDay(iso: string | null): string {
  if (!iso) return 'No date';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function DealTasks({
  ctx,
  deal,
}: {
  ctx: SurfaceContext;
  deal: { id: string; customerId: string | null };
}) {
  const { data, isPending, isError } = useTasks({ dealId: deal.id });
  const rows = data?.items ?? [];

  return (
    <FormSection
      title="Tasks"
      description="What still needs doing to move this deal along."
      action={
        <Button
          size="sm"
          variant="outline"
          color="module"
          onClick={(event) => {
            ctx.open('crm.task.detail', taskForDealParams(deal), { target: targetFor(event) });
          }}
        >
          <Plus className="size-4" aria-hidden />
          Add a task
        </Button>
      }
    >
      {isPending ? (
        <Text className="text-sm" role="status">
          Loading&hellip;
        </Text>
      ) : isError ? (
        <Text className="text-sm" role="alert">
          Could not load this deal&rsquo;s tasks. Try again in a moment.
        </Text>
      ) : rows.length === 0 ? (
        <Text className="text-sm">Nothing to do on this deal yet.</Text>
      ) : (
        <Table size="sm" hover>
          <thead>
            <tr>
              <th>Task</th>
              <th className="hidden @md:table-cell">Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => {
              const meta = taskStatusMeta(task.status, isOverdue(task));
              return (
                <tr
                  key={task.id}
                  className="cursor-pointer"
                  onClick={(event) => {
                    ctx.open('crm.task.detail', { id: task.id }, { target: targetFor(event) });
                  }}
                >
                  <td className="min-w-0">
                    <span className="block truncate font-medium">{task.title}</span>
                  </td>
                  <td className="hidden text-sm @md:table-cell">{dueDay(task.dueAt)}</td>
                  <td>
                    <Badge color={meta.tone} variant={meta.tone && 'soft'} size="sm">
                      {meta.label}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </FormSection>
  );
}
