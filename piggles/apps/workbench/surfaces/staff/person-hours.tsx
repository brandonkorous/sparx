'use client';

// HOURS — the last month of work, and correcting a day of it.
//
// Wages are the largest single expense in most service businesses, and job
// profitability is arithmetically impossible without this, so it is a first
// class list rather than a note field.

import { useState } from 'react';
import { Badge, Button, Text, useToast } from '@wizeworks/silicaui-react';
import { faPencil, faTrashCan } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Table } from '../../components/table';
import { FormSection } from '../../components/form-section';
import { useConfirm } from '../../lib/confirm';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { staffErrorMessage, useDeleteTimeEntry, useTimeEntries, type TimeEntry } from './data';
import { formatDate, formatMinutes, timeState, toDateInput } from './format';
import { TimeEntryForm } from './person-hours-form';

export function HoursSection({
  staffMemberId,
  sites,
  ctx,
}: {
  staffMemberId: string;
  sites: { id: string; name: string }[];
  ctx: SurfaceContext;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const from = toDateInput(new Date(Date.now() - 30 * 86_400_000));
  const to = toDateInput(new Date());
  const time = useTimeEntries({ staffMemberId, from, to });
  const remove = useDeleteTimeEntry();
  const items = time.data?.items ?? [];

  // `null` = the form is closed, `'new'` = adding, an id = correcting that row.
  const [editing, setEditing] = useState<string | null>(null);

  const drop = async (entry: TimeEntry) => {
    const ok = await confirm({
      title: 'Delete these hours?',
      description: `${formatMinutes(entry.minutes)} on ${formatDate(entry.workedOn)} will be removed. If the work happened but the figure is wrong, correct it instead — deleting it means nobody is paid for that time.`,
      confirmLabel: 'Delete them',
      cancelLabel: 'Keep them',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(entry.id, {
      onError: (error) => {
        toast.add({
          title: 'Could not delete those hours',
          description: staffErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <FormSection
      title="The last 30 days"
      description="What they logged. Approving hours happens on the timesheet, where the cost is shown alongside."
      action={
        <div className="flex gap-2">
          <Button
            size="sm"
            color="module"
            onClick={() => {
              setEditing('new');
            }}
          >
            Add hours
          </Button>
          <Button
            size="sm"
            variant="outline"
            color="module"
            onClick={() => {
              ctx.open('staff.timesheets', {});
            }}
          >
            Open timesheets
          </Button>
        </div>
      }
    >
      {editing !== null ? (
        <TimeEntryForm
          staffMemberId={staffMemberId}
          entry={editing === 'new' ? 'new' : (items.find((e) => e.id === editing) ?? 'new')}
          sites={sites}
          onCancel={() => {
            setEditing(null);
          }}
        />
      ) : null}

      {time.isPending ? (
        <Text className="text-sm">Loading…</Text>
      ) : items.length === 0 ? (
        <Text className="text-sm">
          Nothing logged in the last 30 days. Hours arrive when they clock in and out, or you can
          add a day yourself.
        </Text>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {formatMinutes(time.data?.totalMinutes ?? 0)}
            </span>
            <Text className="text-sm">across {String(items.length)} entries</Text>
          </div>
          <Table size="sm">
            <thead>
              <tr>
                <th>Day</th>
                <th>Hours</th>
                <th>State</th>
                <th className="hidden @lg:table-cell">Note</th>
                <th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 12).map((entry) => {
                const state = timeState(entry.status);
                // Approved hours are settled: they have already been filed as a
                // wage cost, so the server refuses to change them and the way
                // back is to re-open them from the timesheet. Showing controls
                // that 409 would be worse than showing none.
                const settled = entry.status === 'approved';
                return (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap">{formatDate(entry.workedOn)}</td>
                    <td className="tabular-nums">{formatMinutes(entry.minutes)}</td>
                    <td>
                      <Badge color={state.tone} variant="soft" size="sm">
                        {state.label}
                      </Badge>
                    </td>
                    <td className="hidden text-sm @lg:table-cell">{entry.note ?? '—'}</td>
                    <td className="text-right whitespace-nowrap">
                      {settled ? null : (
                        <>
                          <Button
                            size="xs"
                            variant="ghost"
                            color="module"
                            aria-label={`Correct the hours on ${formatDate(entry.workedOn)}`}
                            onClick={() => {
                              setEditing(entry.id);
                            }}
                          >
                            <Icon glyph={faPencil} className="size-3.5" aria-hidden />
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            color="danger"
                            aria-label={`Delete the hours on ${formatDate(entry.workedOn)}`}
                            onClick={() => {
                              void drop(entry);
                            }}
                          >
                            <Icon glyph={faTrashCan} className="size-3.5" aria-hidden />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </>
      )}
    </FormSection>
  );
}
