'use client';

// The trigger editor — what STARTS a rule. Two kinds, chosen with a pair of
// buttons:
//   • an EVENT — something happening in the business (an order placed, a form
//     submitted). The engine delivers these as they occur.
//   • a SCHEDULE — a timer that scans a kind of record and starts a run for each
//     one that matches (e.g. every morning, find customers who haven't ordered
//     in 90 days). The scan's "matches" filter is the same shape as a rule's
//     conditions, so it reuses the condition editor.

import { useMemo, useState } from 'react';
import {
  Button,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Input,
  Select,
} from '@wizeworks/silicaui-react';
import type { ScheduleSpec, Trigger } from '@sparx/automation-schemas';
import { ConditionEditor } from './condition-editor';
import {
  DAYS_OF_WEEK,
  SCAN_ENTITIES,
  SCHEDULE_CADENCES,
  TRIGGER_EVENTS,
} from './automations-catalog';

const EMPTY_WHERE = { logic: 'AND' as const, conditions: [] };
const CUSTOM = '__custom__';

const DEFAULT_EVENT: Trigger = { kind: 'event', eventType: 'order.placed' };
const DEFAULT_SCHEDULE: Trigger = {
  kind: 'schedule',
  schedule: { cadence: 'daily', atMinuteUtc: 9 * 60 },
  predicate: { entity: 'customer', where: EMPTY_WHERE },
};

function minuteToHHMM(minute: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

function hhmmToMinute(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((p) => Number(p));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.min(1439, Math.max(0, (h ?? 0) * 60 + (m ?? 0)));
}

function atMinuteOf(schedule: ScheduleSpec): number {
  return schedule.cadence === 'once' || schedule.cadence === 'interval' ? 0 : schedule.atMinuteUtc;
}

/** Picks the event from a friendly menu of suggestions, with an "Something else"
 *  escape hatch that reveals a text box — the schema allows any event type. */
function EventPicker({
  value,
  onChange,
  enabledModules,
}: {
  value: string;
  onChange: (eventType: string) => void;
  enabledModules: readonly string[];
}) {
  const active = new Set(enabledModules);
  const suggestions = useMemo(
    () => TRIGGER_EVENTS.filter((e) => e.module === 'platform' || active.has(e.module)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `active` is derived from enabledModules
    [enabledModules]
  );
  const isKnown = suggestions.some((e) => e.eventType === value);
  const [custom, setCustom] = useState(!isKnown && value !== '');

  const items: Record<string, string> = {};
  for (const e of suggestions) items[e.eventType] = e.label;
  items[CUSTOM] = 'Something else…';

  const selectValue = custom ? CUSTOM : isKnown ? value : CUSTOM;

  return (
    <div className="flex flex-col gap-2">
      <Select
        color="module"
        aria-label="What starts this rule"
        value={selectValue}
        items={items}
        onValueChange={(next) => {
          const chosen = next as string;
          if (chosen === CUSTOM) {
            setCustom(true);
          } else {
            setCustom(false);
            onChange(chosen);
          }
        }}
      />
      {custom || (!isKnown && value !== '') ? (
        <Field>
          <FieldLabel>Event name</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={value}
                placeholder="order.placed"
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                onChange={(event) => {
                  onChange(event.target.value);
                }}
              />
            }
          />
          <FieldDescription>
            The exact name of the event to listen for. Only use this if you know the event you need.
          </FieldDescription>
        </Field>
      ) : null}
    </div>
  );
}

export function TriggerEditor({
  value,
  onChange,
  enabledModules,
}: {
  value: Trigger;
  onChange: (next: Trigger) => void;
  enabledModules: readonly string[];
}) {
  function setKind(kind: 'event' | 'schedule') {
    if (kind === value.kind) return;
    onChange(kind === 'event' ? DEFAULT_EVENT : DEFAULT_SCHEDULE);
  }

  function setCadence(cadence: ScheduleSpec['cadence']) {
    if (value.kind !== 'schedule') return;
    const at = atMinuteOf(value.schedule);
    let schedule: ScheduleSpec;
    switch (cadence) {
      case 'daily':
        schedule = { cadence: 'daily', atMinuteUtc: at };
        break;
      case 'weekly':
        schedule = { cadence: 'weekly', dayOfWeek: 1, atMinuteUtc: at };
        break;
      case 'monthly':
        schedule = { cadence: 'monthly', dayOfMonth: 1, atMinuteUtc: at };
        break;
      case 'interval':
        schedule = { cadence: 'interval', everyMinutes: 60 };
        break;
      case 'once':
        schedule = { cadence: 'once', at: '' };
        break;
    }
    onChange({ ...value, schedule });
  }

  function patchSchedule(patch: Partial<ScheduleSpec>) {
    if (value.kind !== 'schedule') return;
    onChange({ ...value, schedule: { ...value.schedule, ...patch } as ScheduleSpec });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={value.kind === 'event' ? 'solid' : 'outline'}
          color={value.kind === 'event' ? 'module' : 'neutral'}
          onClick={() => {
            setKind('event');
          }}
        >
          When something happens
        </Button>
        <Button
          size="sm"
          variant={value.kind === 'schedule' ? 'solid' : 'outline'}
          color={value.kind === 'schedule' ? 'module' : 'neutral'}
          onClick={() => {
            setKind('schedule');
          }}
        >
          On a schedule
        </Button>
      </div>

      {value.kind === 'event' ? (
        <Field>
          <FieldLabel>Start this rule when…</FieldLabel>
          <EventPicker
            value={value.eventType}
            enabledModules={enabledModules}
            onChange={(eventType) => {
              onChange({ kind: 'event', eventType });
            }}
          />
        </Field>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-48">
              <FieldLabel>How often</FieldLabel>
              <Select
                color="module"
                aria-label="How often the schedule runs"
                value={value.schedule.cadence}
                items={Object.fromEntries(SCHEDULE_CADENCES.map((c) => [c.value, c.label]))}
                onValueChange={(next) => {
                  setCadence(next as ScheduleSpec['cadence']);
                }}
              />
            </Field>

            {value.schedule.cadence === 'weekly' ? (
              <Field className="w-40">
                <FieldLabel>On</FieldLabel>
                <Select
                  color="module"
                  aria-label="Day of week"
                  value={String(value.schedule.dayOfWeek)}
                  items={Object.fromEntries(DAYS_OF_WEEK.map((d) => [String(d.value), d.label]))}
                  onValueChange={(next) => {
                    patchSchedule({ dayOfWeek: Number(next) });
                  }}
                />
              </Field>
            ) : null}

            {value.schedule.cadence === 'monthly' ? (
              <Field className="w-32">
                <FieldLabel>Day of month</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="number"
                      min={1}
                      max={28}
                      value={value.schedule.dayOfMonth}
                      onChange={(event) => {
                        patchSchedule({
                          dayOfMonth: Math.min(28, Math.max(1, Number(event.target.value) || 1)),
                        });
                      }}
                    />
                  }
                />
              </Field>
            ) : null}

            {value.schedule.cadence === 'once' ? (
              <Field className="w-60">
                <FieldLabel>At (UTC)</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="datetime-local"
                      value={value.schedule.at ? value.schedule.at.slice(0, 16) : ''}
                      onChange={(event) => {
                        patchSchedule({
                          at: event.target.value ? `${event.target.value}:00.000Z` : '',
                        });
                      }}
                    />
                  }
                />
              </Field>
            ) : value.schedule.cadence === 'interval' ? (
              <Field className="w-40">
                <FieldLabel>Every (minutes)</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="number"
                      min={1}
                      max={1440}
                      value={value.schedule.everyMinutes}
                      onChange={(event) => {
                        patchSchedule({
                          everyMinutes: Math.min(
                            1440,
                            Math.max(1, Number(event.target.value) || 1)
                          ),
                        });
                      }}
                    />
                  }
                />
              </Field>
            ) : (
              <Field className="w-40">
                <FieldLabel>At (UTC)</FieldLabel>
                <FieldControl
                  render={
                    <Input
                      color="module"
                      type="time"
                      value={minuteToHHMM(value.schedule.atMinuteUtc)}
                      onChange={(event) => {
                        patchSchedule({ atMinuteUtc: hhmmToMinute(event.target.value) });
                      }}
                    />
                  }
                />
              </Field>
            )}
          </div>

          <div className="border-base-300 flex flex-col gap-3 rounded-lg border p-3">
            <Field className="w-56">
              <FieldLabel>Each time it runs, look at…</FieldLabel>
              <Select
                color="module"
                aria-label="What the schedule scans"
                value={value.predicate.entity}
                items={Object.fromEntries(SCAN_ENTITIES.map((e) => [e.entity, e.label]))}
                onValueChange={(next) => {
                  onChange({
                    ...value,
                    predicate: { ...value.predicate, entity: next as string },
                  });
                }}
              />
            </Field>
            <ConditionEditor
              label="records"
              value={value.predicate.where}
              onChange={(where) => {
                onChange({ ...value, predicate: { ...value.predicate, where } });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
