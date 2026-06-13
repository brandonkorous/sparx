'use client';

// Trigger editor — what starts the automation (docs/81 §5.2). Two kinds:
//   • event    — a bus event type (free text + curated suggestions per active
//                module). The engine's fan-in delivers these.
//   • schedule — a (cadence, predicate) pair. On each tick the engine runs the
//                predicate query and starts one run per matched row. The predicate
//                `where` is the SAME condition shape as the run-only-if filter, so
//                it reuses <ConditionEditor>.

import * as React from 'react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sparx/ui';
import type { ConditionGroup, ScheduleSpec, Trigger } from '@sparx/automation-schemas';
import { DAYS_OF_WEEK, SCAN_ENTITIES, SCHEDULE_CADENCES, TRIGGER_EVENTS } from '../_lib/catalog';
import { ConditionEditor } from './condition-editor';
import { Combobox } from './combobox';

const EMPTY_WHERE: ConditionGroup = { logic: 'AND', conditions: [] };

const DEFAULT_EVENT_TRIGGER: Trigger = { kind: 'event', eventType: '' };
const DEFAULT_SCHEDULE_TRIGGER: Trigger = {
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
  return schedule.cadence === 'once' ? 0 : schedule.atMinuteUtc;
}

interface Props {
  value: Trigger;
  onChange: (next: Trigger) => void;
  enabledModules: readonly string[];
}

export function TriggerEditor({ value, onChange, enabledModules }: Props) {
  const active = new Set(enabledModules);
  const eventSuggestions = TRIGGER_EVENTS.filter(
    (e) => e.module === 'platform' || active.has(e.module)
  );

  function setKind(kind: 'event' | 'schedule') {
    if (kind === value.kind) return;
    onChange(kind === 'event' ? DEFAULT_EVENT_TRIGGER : DEFAULT_SCHEDULE_TRIGGER);
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
      {/* kind toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={value.kind === 'event' ? 'solid' : 'outline'}
          color={value.kind === 'event' ? 'module' : 'neutral'}
          onClick={() => setKind('event')}
        >
          Event
        </Button>
        <Button
          type="button"
          size="sm"
          variant={value.kind === 'schedule' ? 'solid' : 'outline'}
          color={value.kind === 'schedule' ? 'module' : 'neutral'}
          onClick={() => setKind('schedule')}
        >
          Schedule
        </Button>
      </div>

      {value.kind === 'event' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trigger-event-type">Event type</Label>
          <Combobox
            id="trigger-event-type"
            value={value.eventType}
            placeholder="crm.customer.created"
            searchPlaceholder="Search or type an event…"
            customHint="Use this exact event type"
            options={eventSuggestions.map((e) => ({ value: e.eventType, label: e.label }))}
            onChange={(eventType) => onChange({ kind: 'event', eventType })}
          />
          <p className="text-xs text-[var(--color-text-tertiary)]">
            The bus event that fires this automation. Pick a suggestion or type any event type.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* cadence */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Runs</Label>
              <Select
                value={value.schedule.cadence}
                onValueChange={(v) => setCadence(v as ScheduleSpec['cadence'])}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_CADENCES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {value.schedule.cadence === 'weekly' && (
              <div className="flex flex-col gap-1.5">
                <Label>On</Label>
                <Select
                  value={String(value.schedule.dayOfWeek)}
                  onValueChange={(v) => patchSchedule({ dayOfWeek: Number(v) })}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {value.schedule.cadence === 'monthly' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="schedule-dom">Day of month</Label>
                <Input
                  id="schedule-dom"
                  type="number"
                  min={1}
                  max={28}
                  value={value.schedule.dayOfMonth}
                  onChange={(e) =>
                    patchSchedule({
                      dayOfMonth: Math.min(28, Math.max(1, Number(e.target.value) || 1)),
                    })
                  }
                  className="w-24"
                />
              </div>
            )}

            {value.schedule.cadence === 'once' ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="schedule-at">At (UTC)</Label>
                <Input
                  id="schedule-at"
                  type="datetime-local"
                  value={value.schedule.at ? value.schedule.at.slice(0, 16) : ''}
                  onChange={(e) =>
                    patchSchedule({ at: e.target.value ? `${e.target.value}:00.000Z` : '' })
                  }
                  className="w-56"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="schedule-time">At (UTC)</Label>
                <Input
                  id="schedule-time"
                  type="time"
                  value={minuteToHHMM(value.schedule.atMinuteUtc)}
                  onChange={(e) => patchSchedule({ atMinuteUtc: hhmmToMinute(e.target.value) })}
                  className="w-32"
                />
              </div>
            )}
          </div>

          {/* predicate */}
          <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border-default)] p-3">
            <div className="flex flex-col gap-1.5">
              <Label>Scan</Label>
              <Select
                value={value.predicate.entity}
                onValueChange={(v) =>
                  onChange({ ...value, predicate: { ...value.predicate, entity: v } })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCAN_ENTITIES.map((e) => (
                    <SelectItem key={e.entity} value={e.entity}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ConditionEditor
              label="rows"
              value={value.predicate.where}
              onChange={(where) => onChange({ ...value, predicate: { ...value.predicate, where } })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
