'use client';

// The tasks table. Done and late carry semantic color, so an overdue open task
// reads red without anyone hunting for it.

import { Badge } from '@wizeworks/silicaui-react';
import { Table } from '../../components/table';
import { isOverdue, taskStatusMeta, taskSubject, type Task } from './tasks-data';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function TaskRow({ row, onOpen }: { row: Task; onOpen: (event: OpenEvent) => void }) {
  const overdue = isOverdue(row);
  const meta = taskStatusMeta(row.status, overdue);
  const subject = taskSubject(row);
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(event);
      }}
    >
      <td className="font-medium">{row.title}</td>
      <td>
        <Badge color={meta.tone} variant={meta.tone && 'soft'} size="sm">
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
}

export function TasksTable(props: {
  rows: Task[];
  onOpen: (task: Task, event: OpenEvent) => void;
}) {
  return (
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
        {props.rows.map((row) => (
          <TaskRow
            key={row.id}
            row={row}
            onOpen={(event) => {
              props.onOpen(row, event);
            }}
          />
        ))}
      </tbody>
    </Table>
  );
}
