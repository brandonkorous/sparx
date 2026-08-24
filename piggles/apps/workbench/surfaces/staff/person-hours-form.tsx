'use client';

// ADDING OR CORRECTING A DAY — the same form either way, because a day that was
// mistyped and a day that was never logged are the same fix.

import { useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  useToast,
} from '@wizeworks/silicaui-react';

import { afterPaneChange } from '../../lib/defer';
import { staffErrorMessage, useCreateTimeEntry, useUpdateTimeEntry, type TimeEntry } from './data';
import { toDateInput } from './format';

/** Decimal hours to whole minutes. "7.5" is seven and a half hours, because that
 *  is how a timesheet is read aloud and how the payroll export writes it. */
export function minutesFromHours(input: string): number {
  return Math.round(Number(input.replace(/[,\s]/g, '')) * 60);
}

export function TimeEntryForm({
  staffMemberId,
  /** `'new'` while adding a day, the entry itself while correcting one. */
  entry,
  sites,
  onCancel,
}: {
  staffMemberId: string;
  entry: TimeEntry | 'new';
  sites: { id: string; name: string }[];
  onCancel: () => void;
}) {
  const toast = useToast();
  const create = useCreateTimeEntry();
  const update = useUpdateTimeEntry();
  const adding = entry === 'new';

  const [day, setDay] = useState(adding ? toDateInput(new Date()) : entry.workedOn.slice(0, 10));
  const [hours, setHours] = useState(
    adding ? '' : (entry.minutes / 60).toFixed(2).replace(/\.00$/, '')
  );
  const [site, setSite] = useState(adding ? '' : (entry.propertyId ?? ''));
  const [entryNote, setEntryNote] = useState(adding ? '' : (entry.note ?? ''));

  const minutes = minutesFromHours(hours);
  const hoursOk = hours.trim() !== '' && Number.isFinite(minutes) && minutes > 0;
  const saving = create.isPending || update.isPending;

  const submit = () => {
    if (!hoursOk) return;
    const body = {
      workedOn: day,
      minutes,
      propertyId: site === '' ? null : site,
      note: entryNote.trim() === '' ? null : entryNote.trim(),
    };
    const done = {
      onSuccess: () => {
        onCancel();
        afterPaneChange(() => {
          toast.add({
            title: adding ? 'Hours recorded' : 'Hours corrected',
            description:
              'They are waiting to be approved. Nothing reaches your spending until you approve them on the timesheet.',
            type: 'success',
          });
        });
      },
      onError: (error: unknown) => {
        toast.add({
          title: 'Could not save those hours',
          description: staffErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    };
    if (adding) create.mutate({ staffMemberId, ...body }, done);
    else update.mutate({ id: entry.id, ...body }, done);
  };

  return (
    <div className="border-base-300 rounded-box flex flex-col gap-3 border p-3">
      <div className="grid gap-3 @lg:grid-cols-3">
        <Field>
          <FieldLabel>Day</FieldLabel>
          <FieldControl
            render={
              <Input
                type="date"
                value={day}
                onChange={(event) => {
                  setDay(event.target.value);
                }}
              />
            }
          />
        </Field>

        <Field>
          <FieldLabel>Hours worked</FieldLabel>
          <FieldControl
            render={
              <Input
                inputMode="decimal"
                placeholder="7.5"
                value={hours}
                onChange={(event) => {
                  setHours(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            What you are paying for. 7.5 is seven and a half hours — take any unpaid break off
            before you type it.
          </FieldDescription>
        </Field>

        {sites.length > 1 ? (
          <Field>
            <FieldLabel>Which business</FieldLabel>
            <FieldControl
              render={
                <NativeSelect
                  value={site}
                  onChange={(event) => {
                    setSite(event.target.value);
                  }}
                >
                  <option value="">Their main one</option>
                  {sites.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </NativeSelect>
              }
            />
            <FieldDescription>The cost lands against this one.</FieldDescription>
          </Field>
        ) : null}
      </div>

      <Field>
        <FieldLabel>Note</FieldLabel>
        <FieldControl
          render={
            <Input
              placeholder="Forgot to clock in, callout on the Henderson job…"
              value={entryNote}
              onChange={(event) => {
                setEntryNote(event.target.value);
              }}
            />
          }
        />
      </Field>

      <div className="flex gap-2">
        <Button size="sm" color="module" disabled={!hoursOk} loading={saving} onClick={submit}>
          {adding ? 'Record these hours' : 'Save the correction'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
