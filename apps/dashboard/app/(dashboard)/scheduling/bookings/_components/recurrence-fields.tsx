'use client';

// Recurrence controls for a recurring booking series (docs/79 §7.6). Produces an
// RFC 5545 RRULE the API expands into child bookings. Kept presentation-only —
// the booking form owns the on/off toggle and submit.

import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  Label,
  NativeSelect,
} from '@wizeworks/silicaui-react';

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type RecurrenceEnd =
  | { type: 'never' }
  | { type: 'after'; count: number }
  | { type: 'on'; date: string };

export interface RecurrenceValue {
  frequency: RecurrenceFrequency;
  interval: number;
  byDay: string[]; // weekly only — SU..SA
  end: RecurrenceEnd;
}

export const defaultRecurrence: RecurrenceValue = {
  frequency: 'WEEKLY',
  interval: 1,
  byDay: [],
  end: { type: 'after', count: 8 },
};

const WEEKDAYS: [code: string, label: string][] = [
  ['SU', 'S'],
  ['MO', 'M'],
  ['TU', 'T'],
  ['WE', 'W'],
  ['TH', 'T'],
  ['FR', 'F'],
  ['SA', 'S'],
];

/** Build an RFC 5545 RRULE value (no leading `RRULE:`) from the controls. */
export function buildRrule(v: RecurrenceValue): string {
  const parts = [`FREQ=${v.frequency}`];
  if (v.interval > 1) parts.push(`INTERVAL=${v.interval}`);
  if (v.frequency === 'WEEKLY' && v.byDay.length > 0) parts.push(`BYDAY=${v.byDay.join(',')}`);
  if (v.end.type === 'after') parts.push(`COUNT=${Math.max(1, v.end.count)}`);
  else if (v.end.type === 'on') parts.push(`UNTIL=${v.end.date.replace(/-/g, '')}T235959Z`);
  return parts.join(';');
}

const UNIT: Record<RecurrenceFrequency, string> = {
  DAILY: 'day(s)',
  WEEKLY: 'week(s)',
  MONTHLY: 'month(s)',
};

export function RecurrenceFields({
  value,
  onChange,
}: {
  value: RecurrenceValue;
  onChange: (v: RecurrenceValue) => void;
}) {
  const set = (patch: Partial<RecurrenceValue>): void => onChange({ ...value, ...patch });
  const toggleDay = (code: string): void =>
    set({
      byDay: value.byDay.includes(code)
        ? value.byDay.filter((d) => d !== code)
        : [...value.byDay, code],
    });

  return (
    <div className="border-base-300 flex flex-col gap-3 rounded-md border p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel>Repeat</FieldLabel>
          <NativeSelect
            value={value.frequency}
            onChange={(e) => set({ frequency: e.target.value as RecurrenceFrequency })}
          >
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel>Every</FieldLabel>
          <div className="flex items-center gap-2">
            <FieldControl
              type="number"
              min={1}
              className="max-w-[5rem]"
              value={value.interval}
              onChange={(e) => set({ interval: Math.max(1, Number(e.target.value) || 1) })}
            />
            <span className="text-base-content text-sm">{UNIT[value.frequency]}</span>
          </div>
        </Field>
      </div>

      {value.frequency === 'WEEKLY' ? (
        <div>
          <Label>On</Label>
          <div className="flex gap-1">
            {WEEKDAYS.map(([code, label], i) => (
              <Button
                key={`${code}-${i}`}
                type="button"
                size="sm"
                shape="square"
                color="module"
                variant={value.byDay.includes(code) ? 'solid' : 'outline'}
                onClick={() => toggleDay(code)}
                aria-pressed={value.byDay.includes(code)}
              >
                {label}
              </Button>
            ))}
          </div>
          <p className="text-base-content mt-1 text-xs">
            Leave blank to repeat on the start day each week.
          </p>
        </div>
      ) : null}

      <Field>
        <FieldLabel>Ends</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            className="max-w-[10rem]"
            value={value.end.type}
            onChange={(e) => {
              const type = e.target.value as RecurrenceEnd['type'];
              if (type === 'never') set({ end: { type: 'never' } });
              else if (type === 'after') set({ end: { type: 'after', count: 8 } });
              else set({ end: { type: 'on', date: '' } });
            }}
          >
            <option value="after">After</option>
            <option value="on">On date</option>
            <option value="never">Never</option>
          </NativeSelect>
          {value.end.type === 'after' ? (
            <div className="flex items-center gap-2">
              <FieldControl
                type="number"
                min={1}
                max={365}
                className="max-w-[5rem]"
                value={value.end.count}
                onChange={(e) =>
                  set({ end: { type: 'after', count: Math.max(1, Number(e.target.value) || 1) } })
                }
              />
              <span className="text-base-content text-sm">occurrences</span>
            </div>
          ) : null}
          {value.end.type === 'on' ? (
            <FieldControl
              type="date"
              className="max-w-[12rem]"
              value={value.end.date}
              onChange={(e) => set({ end: { type: 'on', date: e.target.value } })}
            />
          ) : null}
        </div>
      </Field>
    </div>
  );
}
