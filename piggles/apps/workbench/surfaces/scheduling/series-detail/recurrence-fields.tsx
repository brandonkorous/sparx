'use client';

import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import { WEEKDAYS, type EndsMode, type Frequency, type RecurrenceDraft } from '../bookings-data';
import { DayInput } from '../../../components/day-input';

const FREQ_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'DAILY', label: 'Every day' },
  { value: 'WEEKLY', label: 'Every week' },
  { value: 'MONTHLY', label: 'Every month' },
];

/** Sets one field of the recurrence draft. */
type SetDraftField = <K extends keyof RecurrenceDraft>(key: K, value: RecurrenceDraft[K]) => void;

/* ══════════════════════════════════════════════════════════════════════════
   THE RECURRENCE BUILDER
   ══════════════════════════════════════════════════════════════════════════ */

export function RecurrenceFields({
  draft,
  onChange,
}: {
  draft: RecurrenceDraft;
  onChange: (next: RecurrenceDraft) => void;
}) {
  const set = <K extends keyof RecurrenceDraft>(key: K, value: RecurrenceDraft[K]) => {
    onChange({ ...draft, [key]: value });
  };

  const toggleDay = (code: string) => {
    onChange({
      ...draft,
      byDay: draft.byDay.includes(code)
        ? draft.byDay.filter((d) => d !== code)
        : [...draft.byDay, code],
    });
  };

  const unitWord = draft.freq === 'DAILY' ? 'days' : draft.freq === 'WEEKLY' ? 'weeks' : 'months';

  return (
    <>
      <RepeatRateFields draft={draft} set={set} unitWord={unitWord} />

      {draft.freq === 'WEEKLY' ? <WeekdayField draft={draft} toggleDay={toggleDay} /> : null}

      <EndsField draft={draft} set={set} />

      {draft.ends === 'count' ? <EndCountField draft={draft} set={set} /> : null}

      {draft.ends === 'until' ? <EndUntilField draft={draft} set={set} /> : null}
    </>
  );
}

function RepeatRateFields({
  draft,
  set,
  unitWord,
}: {
  draft: RecurrenceDraft;
  set: SetDraftField;
  unitWord: string;
}) {
  return (
    <div className="grid gap-4 @md:grid-cols-2">
      <FrequencyField draft={draft} set={set} />

      <IntervalField draft={draft} set={set} unitWord={unitWord} />
    </div>
  );
}

function FrequencyField({ draft, set }: { draft: RecurrenceDraft; set: SetDraftField }) {
  return (
    <Field>
      <FieldLabel>How often</FieldLabel>
      <FieldControl
        render={
          <NativeSelect
            color="module"
            aria-label="How often it repeats"
            value={draft.freq}
            onChange={(event) => {
              set('freq', event.target.value as Frequency);
            }}
          >
            {FREQ_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        }
      />
    </Field>
  );
}

function IntervalField({
  draft,
  set,
  unitWord,
}: {
  draft: RecurrenceDraft;
  set: SetDraftField;
  unitWord: string;
}) {
  return (
    <Field>
      <FieldLabel>Repeat every</FieldLabel>
      <div className="flex items-center gap-2">
        <FieldControl
          render={
            <Input
              color="module"
              type="number"
              min={1}
              max={52}
              className="max-w-20"
              value={String(draft.interval)}
              onChange={(event) => {
                const n = Number.parseInt(event.target.value, 10);
                set('interval', Number.isFinite(n) && n > 0 ? n : 1);
              }}
            />
          }
        />
        <Text as="span" className="text-sm">
          {unitWord}
        </Text>
      </div>
      <FieldDescription>Set to 1 for every {unitWord.slice(0, -1)}.</FieldDescription>
    </Field>
  );
}

function WeekdayField({
  draft,
  toggleDay,
}: {
  draft: RecurrenceDraft;
  toggleDay: (code: string) => void;
}) {
  return (
    <Field>
      <FieldLabel>On these days</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => {
          const on = draft.byDay.includes(day.code);
          return (
            <Button
              key={day.code}
              type="button"
              size="sm"
              variant={on ? 'solid' : 'outline'}
              color={on ? 'module' : 'neutral'}
              onClick={() => {
                toggleDay(day.code);
              }}
            >
              {day.short}
            </Button>
          );
        })}
      </div>
      <FieldDescription>Pick at least one day it lands on.</FieldDescription>
    </Field>
  );
}

function EndsField({ draft, set }: { draft: RecurrenceDraft; set: SetDraftField }) {
  return (
    <Field>
      <FieldLabel>Ends</FieldLabel>
      <FieldControl
        render={
          <NativeSelect
            color="module"
            aria-label="When it ends"
            value={draft.ends}
            onChange={(event) => {
              set('ends', event.target.value as EndsMode);
            }}
          >
            <option value="never">Keeps going</option>
            <option value="count">After a set number</option>
            <option value="until">On a date</option>
          </NativeSelect>
        }
      />
    </Field>
  );
}

function EndCountField({ draft, set }: { draft: RecurrenceDraft; set: SetDraftField }) {
  return (
    <Field>
      <FieldLabel>How many times</FieldLabel>
      <FieldControl
        render={
          <Input
            color="module"
            type="number"
            min={1}
            max={520}
            className="max-w-24"
            value={String(draft.count)}
            onChange={(event) => {
              const n = Number.parseInt(event.target.value, 10);
              set('count', Number.isFinite(n) && n > 0 ? n : 1);
            }}
          />
        }
      />
    </Field>
  );
}

function EndUntilField({ draft, set }: { draft: RecurrenceDraft; set: SetDraftField }) {
  return (
    <Field>
      <FieldLabel>Last day it can happen</FieldLabel>
      <FieldControl
        render={
          <DayInput
            color="module"
            className="max-w-48"
            value={draft.until}
            onValueChange={(value) => {
              set('until', value);
            }}
          />
        }
      />
    </Field>
  );
}
