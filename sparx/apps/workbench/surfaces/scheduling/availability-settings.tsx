'use client';

// AVAILABILITY — the hours you can be booked, and the days you cannot.
//
// Two things live here, because to an owner they are one question: "when am I
// free?". The WEEKLY HOURS are the normal pattern — the same every week, set per
// person or place, because a booking is only offered when the thing it needs is
// within its hours. The CLOSURES are the one-off exceptions on top: a holiday, a
// day off, a shutdown, which override the weekly pattern for a date or a range.
//
// The weekly hours are an explicit-save editor, like every other editor in the
// app: one Save in the toolbar, edits register as unsaved work so switching away
// asks first, and the whole week is written at once (the server replaces it
// wholesale). Closures are added and removed one at a time — each is its own
// small commit, so they take effect the moment you add them.

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  Heading,
  Input,
  NativeSelect,
  Switch,
  Text,
  useToast,
} from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { thisComputersTimezone, useBusinessTimezone } from '../../lib/business-timezone';
import { dayEndIn, dayIn, dayStartIn, wallClockHint } from '../../lib/wall-clock';
import { CalendarOff, Clock, Plus, Trash2, Users, X } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { FormSection } from '../../components/form-section';
import { RefreshButton } from '../../components/refresh-button';
import { useDirtySource } from '../../lib/workbench/dirty';
import {
  WEEK_DAYS,
  customHoursOf,
  minutesToClock,
  minutesToTime,
  resourceKindLabel,
  schedulingErrorMessage,
  timeToMinutes,
  useCreateException,
  useDeleteException,
  useExceptions,
  useResourceWindows,
  useResources,
  useSetResourceWindows,
  type AvailabilityException,
  type AvailabilityWindow,
  type AvailabilityWindowInput,
} from './setup-data';
import { DayInput } from '../../components/day-input';
import {
  anySeason,
  seasonFromWire,
  seasonHelp,
  seasonToWire,
  seasonValid,
  withoutSeason,
} from './season-window';
import { FALLBACK_BLOCK, hoursForNewDay, type HoursBlock, type WeekDraft } from './weekly-hours';
import { HoursCopy } from './availability-copy';
import type { SurfaceContext } from '../../lib/surfaces/registry';

const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

type TimeWindow = HoursBlock;

/** Every block in the week, flat. For the questions that are about the week
 *  rather than about one day. */
function allWindows(week: WeekDraft): TimeWindow[] {
  const out: TimeWindow[] = [];
  for (let day = 0; day <= 6; day += 1) out.push(...(week[day] ?? []));
  return out;
}

/** The same week with one change applied to every block. */
function mapWeek(week: WeekDraft, change: (window: TimeWindow) => TimeWindow): WeekDraft {
  const next = emptyWeek();
  for (let day = 0; day <= 6; day += 1) next[day] = (week[day] ?? []).map(change);
  return next;
}

function emptyWeek(): WeekDraft {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

function weekFrom(windows: AvailabilityWindow[]): WeekDraft {
  const week = emptyWeek();
  for (const window of windows) {
    week[window.dayOfWeek] = [
      ...(week[window.dayOfWeek] ?? []),
      {
        start: minutesToTime(window.startMinute),
        end: minutesToTime(window.endMinute),
        // The wire says `null` for no limit and `DayInput` says the empty string.
        // Both halves of that translation live in one tested place, because
        // losing a date in either direction is the defect this screen had.
        ...seasonFromWire(window),
      },
    ];
  }
  for (let day = 0; day <= 6; day += 1) {
    week[day]?.sort((a, b) => a.start.localeCompare(b.start));
  }
  return week;
}

/** True when every window has a valid start, an end after it, and a date range
 *  that can actually happen. A backwards range matches no day at all, so the
 *  block would silently never apply. */
function weekValid(week: WeekDraft): boolean {
  for (let day = 0; day <= 6; day += 1) {
    for (const window of week[day] ?? []) {
      const start = timeToMinutes(window.start);
      const end = timeToMinutes(window.end);
      if (start === null || end === null || end <= start) return false;
      if (!seasonValid(window)) return false;
    }
  }
  return true;
}

function weekToWindows(week: WeekDraft): AvailabilityWindowInput[] {
  const out: AvailabilityWindowInput[] = [];
  for (let day = 0; day <= 6; day += 1) {
    for (const window of week[day] ?? []) {
      const start = timeToMinutes(window.start);
      const end = timeToMinutes(window.end);
      if (start === null || end === null || end <= start) continue;
      out.push({
        dayOfWeek: day,
        startMinute: start,
        endMinute: end,
        ...seasonToWire(window),
      });
    }
  }
  return out;
}

const DATE_PARTS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

/** An exception's own words, or a fallback when it was left unnamed. Empty text
 *  should reach the fallback, which is why this is a ternary, not `??`. */
function exceptionReason(exception: AvailabilityException, fallback: string): string {
  const reason = exception.reason?.trim();
  if (reason !== undefined && reason !== '') return reason;
  return fallback;
}

/** An exception's date range in plain words, a single day when it is one. Read
 *  on the clock it was set on: a closure is whole days where the business is, and
 *  on this computer's clock a Christmas closure read "Dec 24 – Dec 25". */
function exceptionRange(exception: AvailabilityException, zone: string): string {
  const format = (iso: string): string => {
    try {
      return new Intl.DateTimeFormat(undefined, { ...DATE_PARTS, timeZone: zone }).format(
        new Date(iso)
      );
    } catch {
      return new Intl.DateTimeFormat(undefined, DATE_PARTS).format(new Date(iso));
    }
  };
  const startDay = format(exception.startAt);
  const endDay = format(exception.endAt);
  return startDay === endDay ? startDay : `${startDay} – ${endDay}`;
}

/* ── The weekly-hours editor (one resource) ─────────────────────────────── */

function WeeklyHours({
  week,
  seasonal,
  onChange,
}: {
  week: WeekDraft;
  /** Whether the date pair is offered on each block. One decision for the whole
   *  week, so a shop with ordinary hours never sees seven date controls it does
   *  not want. */
  seasonal: boolean;
  onChange: (next: WeekDraft) => void;
}) {
  const setDay = (day: number, windows: TimeWindow[]) => {
    onChange({ ...week, [day]: windows });
  };

  return (
    <div className="divide-base-300 flex flex-col divide-y">
      {WEEK_DAYS.map((day) => {
        const windows = week[day.value] ?? [];
        const open = windows.length > 0;
        return (
          <div key={day.value} className="flex flex-col gap-2 py-3 @lg:flex-row @lg:gap-4">
            <div className="flex items-center gap-3 @lg:w-44 @lg:pt-1.5">
              <Switch
                color="module"
                checked={open}
                aria-label={`${day.label}: open for bookings`}
                onCheckedChange={(next: boolean) => {
                  // A day switched on starts with the hours of the nearest open
                  // day, not a fixed 9 to 5 (issue 086).
                  setDay(day.value, next ? hoursForNewDay(week, day.value) : []);
                }}
              />
              <Text as="span" className="font-medium">
                {day.label}
              </Text>
            </div>

            <div className="min-w-0 flex-1">
              {open ? (
                <div className="flex flex-col gap-2">
                  {windows.map((window, index) => {
                    const start = timeToMinutes(window.start);
                    const end = timeToMinutes(window.end);
                    const invalid = start === null || end === null || end <= start;
                    return (
                      <div key={index} className="flex flex-wrap items-center gap-2">
                        <Input
                          type="time"
                          color={invalid ? 'error' : 'module'}
                          className="max-w-32 tabular-nums"
                          aria-label={`${day.label}: start of hours ${String(index + 1)}`}
                          value={window.start}
                          onChange={(event) => {
                            setDay(
                              day.value,
                              windows.map((w, i) =>
                                i === index ? { ...w, start: event.target.value } : w
                              )
                            );
                          }}
                        />
                        <Text as="span" className="text-sm">
                          to
                        </Text>
                        <Input
                          type="time"
                          color={invalid ? 'error' : 'module'}
                          className="max-w-32 tabular-nums"
                          aria-label={`${day.label}: end of hours ${String(index + 1)}`}
                          value={window.end}
                          onChange={(event) => {
                            setDay(
                              day.value,
                              windows.map((w, i) =>
                                i === index ? { ...w, end: event.target.value } : w
                              )
                            );
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          color="neutral"
                          shape="square"
                          aria-label={`Remove these hours on ${day.label}`}
                          onClick={() => {
                            const next = windows.filter((_, i) => i !== index);
                            setDay(day.value, next);
                          }}
                        >
                          <X className="size-4" aria-hidden />
                        </Button>
                        {seasonal ? (
                          <div className="flex w-full flex-wrap items-center gap-2">
                            <Text as="span" className="text-sm">
                              from
                            </Text>
                            <DayInput
                              color={seasonValid(window) ? 'module' : 'error'}
                              className="max-w-40"
                              aria-label={`${day.label}: these hours start on`}
                              value={window.validFrom}
                              onValueChange={(value) => {
                                setDay(
                                  day.value,
                                  windows.map((w, i) =>
                                    i === index ? { ...w, validFrom: value } : w
                                  )
                                );
                              }}
                            />
                            <Text as="span" className="text-sm">
                              until
                            </Text>
                            <DayInput
                              color={seasonValid(window) ? 'module' : 'error'}
                              className="max-w-40"
                              aria-label={`${day.label}: these hours end on`}
                              value={window.validTo}
                              onValueChange={(value) => {
                                setDay(
                                  day.value,
                                  windows.map((w, i) =>
                                    i === index ? { ...w, validTo: value } : w
                                  )
                                );
                              }}
                            />
                            {!seasonValid(window) ? (
                              <Text className="text-error text-sm">
                                The second date comes before the first, so these hours would never
                                apply.
                              </Text>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  <div>
                    <Button
                      size="sm"
                      variant="ghost"
                      color="module"
                      onClick={() => {
                        setDay(day.value, [...windows, { ...FALLBACK_BLOCK }]);
                      }}
                    >
                      <Plus className="size-4" aria-hidden />
                      Add another block
                    </Button>
                  </div>
                </div>
              ) : (
                <Text className="text-sm @lg:pt-1.5">Closed</Text>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Closures & time off ────────────────────────────────────────────────── */

// A closure's days are the business's days, read with `lib/wall-clock`, not this
// computer's and not UTC's.

function Closures({
  resourceId,
  resourceName,
  resourceZone,
  businessZone,
  exceptions,
}: {
  resourceId: string;
  resourceName: string;
  /** The resource's own zone: a day off for just this one is its days. */
  resourceZone: string;
  /** The business's zone: a closure for everyone is the business's days. */
  businessZone: string;
  exceptions: AvailabilityException[];
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const create = useCreateException();
  const remove = useDeleteException();

  const [scope, setScope] = useState<'everyone' | 'resource'>('everyone');
  // Whole days on the clock of whoever it affects (sparx persona issue 086). These
  // were local midnight on THIS computer, so a closure set from a laptop an hour
  // west of the shop started at 1 AM and ran an hour into the next day.
  const zone = scope === 'resource' ? resourceZone : businessZone;
  const zoneOf = (exception: AvailabilityException): string =>
    exception.resourceId === null ? businessZone : resourceZone;
  const todayThere = (): string => dayIn(new Date().toISOString(), businessZone);
  const [reason, setReason] = useState('');
  const [from, setFrom] = useState(todayThere);
  const [to, setTo] = useState(todayThere);
  // What happens on these dates: shut all day, or open with special hours.
  const [kind, setKind] = useState<'closed' | 'custom_hours'>('closed');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('13:00');

  // The exceptions that touch the chosen resource: the business-wide ones (which
  // apply to everybody) plus this resource's own. Another resource's day off is
  // not this resource's concern, so it is left out.
  const relevant = useMemo(
    () =>
      exceptions
        .filter((exception) => exception.resourceId === null || exception.resourceId === resourceId)
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [exceptions, resourceId]
  );

  // A date box can hold something that is not a date; these return null for it.
  const startAt = from === '' ? null : dayStartIn(from, zone);
  const endAt = to === '' ? null : dayEndIn(to, zone);
  const rangeValid = startAt !== null && endAt !== null && to >= from;
  const openMin = timeToMinutes(openTime);
  const closeMin = timeToMinutes(closeTime);
  // Special hours need an open and a close, with the close later than the open.
  const hoursValid =
    kind === 'closed' || (openMin !== null && closeMin !== null && closeMin > openMin);
  const canAdd = rangeValid && hoursValid;

  const add = () => {
    if (!canAdd || startAt === null || endAt === null) return;
    // An exception covers whole days: local midnight to the end of the last day.
    // For special hours, the meta says which part of each of those days is open.
    const customHours = kind === 'custom_hours' && openMin !== null && closeMin !== null;
    create.mutate(
      {
        kind,
        startAt,
        endAt,
        resourceId: scope === 'resource' ? resourceId : null,
        reason: reason.trim() === '' ? null : reason.trim(),
        ...(customHours ? { meta: { startMinute: openMin, endMinute: closeMin } } : {}),
      },
      {
        onSuccess: () => {
          setReason('');
          setFrom(todayThere());
          setTo(todayThere());
          toast.add({
            title: kind === 'custom_hours' ? 'Special hours added' : 'Closure added',
            type: 'success',
          });
        },
        onError: (error) => {
          toast.add({
            title:
              kind === 'custom_hours' ? 'Could not add these hours' : 'Could not add this closure',
            description: schedulingErrorMessage(error, 'Nothing was changed.'),
            type: 'error',
          });
        },
      }
    );
  };

  const onDelete = async (exception: AvailabilityException) => {
    const label = exceptionReason(exception, exceptionRange(exception, zoneOf(exception)));
    const ok = await confirm({
      title: `Remove “${label}”?`,
      description: 'Bookings will be offered on these dates again, subject to the weekly hours.',
      confirmLabel: 'Remove it',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(exception.id, {
      onError: (error) => {
        toast.add({
          title: 'Could not remove this closure',
          description: schedulingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const customHours = kind === 'custom_hours';
  const dateLabel = customHours ? 'day' : 'day closed';

  return (
    <FormSection
      title="Closures & special hours"
      description="Days that break the weekly pattern: a holiday you are shut, a day off, or a date you open different hours (say Christmas Eve, 9am–1pm). These win over the weekly hours above for the dates they cover."
    >
      {relevant.length > 0 ? (
        <div className="divide-base-300 flex flex-col divide-y">
          {relevant.map((exception) => {
            const hours = customHoursOf(exception);
            const Icon = hours ? Clock : CalendarOff;
            const title = exceptionReason(exception, hours ? 'Special hours' : 'Closed');
            const range = exceptionRange(exception, zoneOf(exception));
            const detail = hours
              ? `${range} · ${minutesToClock(hours.startMinute)} – ${minutesToClock(hours.endMinute)}`
              : range;
            return (
              <div key={exception.id} className="flex items-center gap-3 py-2">
                <Icon className="size-4 shrink-0" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Text as="span" className="truncate font-medium">
                    {title}
                  </Text>
                  <Text as="span" className="text-sm">
                    {detail}
                  </Text>
                </div>
                <Badge
                  color={exception.resourceId === null ? 'info' : 'module'}
                  variant="soft"
                  size="sm"
                >
                  {exception.resourceId === null ? 'Everyone' : resourceName}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  color="danger"
                  shape="square"
                  aria-label={`Remove ${exceptionReason(exception, hours ? 'these special hours' : 'this closure')}`}
                  onClick={() => {
                    void onDelete(exception);
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <Text className="text-sm">
          Nothing set yet. Add a holiday you are shut, a day off, or a date with special hours
          below.
        </Text>
      )}

      {/* Add-an-exception form. It commits straight to the server, so it lives
          inline rather than as a separate pane — there is nothing to return to and
          manage, only to add or remove. */}
      <div className="border-base-300 flex flex-col gap-3 rounded-lg border p-3">
        <Field>
          <FieldLabel>What happens</FieldLabel>
          <FieldControl
            render={
              <NativeSelect
                className="max-w-sm"
                value={kind}
                aria-label="What happens on these dates"
                onChange={(event) => {
                  setKind(event.target.value as 'closed' | 'custom_hours');
                }}
              >
                <option value="closed">Closed all day</option>
                <option value="custom_hours">Open, but with special hours</option>
              </NativeSelect>
            }
          />
        </Field>

        {customHours ? (
          <div className="grid gap-3 @md:grid-cols-2">
            <Field>
              <FieldLabel>Opens</FieldLabel>
              <FieldControl
                render={
                  <Input
                    type="time"
                    color={hoursValid ? 'module' : 'error'}
                    className="max-w-32 tabular-nums"
                    aria-label="Opening time on these dates"
                    value={openTime}
                    onChange={(event) => {
                      setOpenTime(event.target.value);
                    }}
                  />
                }
              />
            </Field>
            <Field>
              <FieldLabel>Closes</FieldLabel>
              <FieldControl
                render={
                  <Input
                    type="time"
                    color={hoursValid ? 'module' : 'error'}
                    className="max-w-32 tabular-nums"
                    aria-label="Closing time on these dates"
                    value={closeTime}
                    onChange={(event) => {
                      setCloseTime(event.target.value);
                    }}
                  />
                }
              />
            </Field>
          </div>
        ) : null}

        <Field>
          <FieldLabel>What is it (optional)</FieldLabel>
          <FieldControl
            render={
              <Input
                color="module"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
              />
            }
          />
        </Field>

        <div className="grid gap-3 @md:grid-cols-2">
          <Field>
            <FieldLabel>First {dateLabel}</FieldLabel>
            <FieldControl
              render={
                <DayInput
                  color={rangeValid ? 'module' : 'error'}
                  className="max-w-44"
                  aria-label={`First ${dateLabel}`}
                  value={from}
                  onValueChange={(value) => {
                    setFrom(value);
                    if (to < value) setTo(value);
                  }}
                />
              }
            />
          </Field>
          <Field>
            <FieldLabel>Last {dateLabel}</FieldLabel>
            <FieldControl
              render={
                <DayInput
                  color={rangeValid ? 'module' : 'error'}
                  className="max-w-44"
                  aria-label={`Last ${dateLabel}`}
                  value={to}
                  min={from}
                  onValueChange={(value) => {
                    setTo(value);
                  }}
                />
              }
            />
          </Field>
        </div>

        <Field>
          <FieldLabel>Who it affects</FieldLabel>
          <FieldControl
            render={
              <NativeSelect
                className="max-w-sm"
                value={scope}
                aria-label="Who this affects"
                onChange={(event) => {
                  setScope(event.target.value as 'everyone' | 'resource');
                }}
              >
                <option value="everyone">Everyone: the whole business</option>
                <option value="resource">Just {resourceName}</option>
              </NativeSelect>
            }
          />
          <FieldDescription>
            {wallClockHint(zone, thisComputersTimezone(), 'midnight to midnight')}
          </FieldDescription>
        </Field>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            color="module"
            variant="soft"
            disabled={!canAdd}
            loading={create.isPending}
            onClick={add}
          >
            <Plus className="size-4" aria-hidden />
            {customHours ? 'Add special hours' : 'Add closure'}
          </Button>
          {!rangeValid ? (
            <Text className="text-sm">The last day cannot be before the first.</Text>
          ) : !hoursValid ? (
            <Text className="text-sm">The closing time must be later than the opening time.</Text>
          ) : null}
        </div>
      </div>
    </FormSection>
  );
}

/* ── The surface ────────────────────────────────────────────────────────── */

export function AvailabilitySurface({ ctx }: { ctx?: SurfaceContext }) {
  const confirm = useConfirm();
  const toast = useToast();

  const resources = useResources({ activeOnly: false });
  // Opened from a person or thing with no hours ("Set its hours"), it starts on
  // that one rather than the first in the list (sparx persona issue 118).
  const presetId = typeof ctx?.params.resourceId === 'string' ? ctx.params.resourceId : null;
  const [resourceId, setResourceId] = useState<string | null>(presetId);

  // Default to the first resource once they load; stay put after that.
  const resourceList = resources.data?.items ?? [];
  const firstResourceId = resourceList[0]?.id ?? null;
  useEffect(() => {
    if (resourceId === null && firstResourceId !== null) {
      setResourceId(firstResourceId);
    }
  }, [resourceId, firstResourceId]);

  const windowsQuery = useResourceWindows(resourceId);
  const exceptionsQuery = useExceptions();
  const save = useSetResourceWindows(resourceId ?? '');

  const loadedWeek = useMemo(
    () => (windowsQuery.data ? weekFrom(windowsQuery.data) : null),
    [windowsQuery.data]
  );

  const [draft, setDraft] = useState<WeekDraft>(emptyWeek);
  const [touched, setTouched] = useState(false);
  // Seeded from what loaded, so a seasonal week she set through her assistant
  // opens showing its dates rather than hiding them and then deleting them.
  const [seasonal, setSeasonal] = useState(false);

  // Re-seed the draft from the server whenever a different resource's hours load,
  // unless the operator has edits in flight — the same shape as the settings
  // editor's touched-guard.
  useEffect(() => {
    setTouched(false);
  }, [resourceId]);
  useEffect(() => {
    if (!touched && loadedWeek) {
      setDraft(loadedWeek);
      setSeasonal(anySeason(allWindows(loadedWeek)));
    }
  }, [loadedWeek, touched]);

  const setWeek = (next: WeekDraft) => {
    setTouched(true);
    setDraft(next);
  };

  /** Turning it OFF strips the dates off every block. That is an edit like any
   *  other — nothing reaches the server until Save, and the sentence under the
   *  switch says what Save will do — which is the whole difference between this
   *  and the silent deletion the screen used to perform on its own. */
  const setSeasonalMode = (next: boolean) => {
    setSeasonal(next);
    if (!next && anySeason(allWindows(draft))) setWeek(mapWeek(draft, withoutSeason));
  };

  const storedIsSeasonal = loadedWeek !== null && anySeason(allWindows(loadedWeek));

  const dirty = loadedWeek !== null && JSON.stringify(draft) !== JSON.stringify(loadedWeek);
  const valid = weekValid(draft);

  useDirtySource(dirty, 'Your weekly hours have unsaved changes. Close anyway?');

  const selected = resourceList.find((resource) => resource.id === resourceId) ?? null;
  // The clock a closure for everyone is counted on. Undefined while it loads, and
  // the closures wait for it rather than stamping a guess.
  const businessZone = useBusinessTimezone();
  const resourceName = selected?.name ?? 'this resource';

  const switchResource = async (nextId: string) => {
    if (nextId === resourceId) return;
    if (dirty) {
      const ok = await confirm({
        title: 'Switch without saving?',
        description: `Your unsaved changes to ${resourceName}’s hours will be lost.`,
        confirmLabel: 'Discard and switch',
        cancelLabel: 'Stay here',
        color: 'danger',
      });
      if (!ok) return;
    }
    setResourceId(nextId);
  };

  const submit = () => {
    if (!dirty || !valid || !resourceId) return;
    save.mutate(weekToWindows(draft), {
      onSuccess: () => {
        setTouched(false);
        toast.add({ title: `${resourceName}’s hours saved`, type: 'success' });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not save these hours',
          description: schedulingErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const refreshAll = () => {
    void windowsQuery.refetch();
    void exceptionsQuery.refetch();
    void resources.refetch();
  };

  /* ── Gates: no resources, load failure ─────────────────────────────────── */

  const noResources = !resources.isPending && resourceList.length === 0;

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Availability actions"
        primary={
          <Button
            color="module"
            size="sm"
            className="ml-auto shrink-0"
            disabled={!dirty || !valid}
            loading={save.isPending}
            onClick={submit}
          >
            {dirty && !valid ? 'Fix the times' : 'Save hours'}
          </Button>
        }
        controls={
          <>
            {resourceList.length > 0 ? (
              <NativeSelect
                size="sm"
                className="shrink"
                aria-label="Whose hours to set"
                value={resourceId ?? ''}
                onChange={(event) => {
                  void switchResource(event.target.value);
                }}
              >
                {resourceList.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name} · {resourceKindLabel(resource.kind)}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
          </>
        }
        refresh={
          <RefreshButton
            isFetching={windowsQuery.isFetching || exceptionsQuery.isFetching}
            updatedAt={windowsQuery.data ? windowsQuery.dataUpdatedAt : undefined}
            onRefresh={refreshAll}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={COLUMN}>
          <div className="flex flex-col gap-1">
            <Heading level={1} className="flex items-center gap-2 text-2xl font-semibold">
              <Clock className="size-5 shrink-0" aria-hidden />
              Availability
            </Heading>
            <Text className="text-sm">
              The hours each person or thing can be booked, and the days none of it is available.
            </Text>
          </div>

          <Body
            resources={resources.isError}
            resourcesPending={resources.isPending}
            noResources={noResources}
            windowsError={windowsQuery.isError}
            windowsPending={resourceId !== null && windowsQuery.isPending}
            onRetry={refreshAll}
          >
            <FormSection
              title="Weekly hours"
              description={`The hours ${resourceName} can be booked, the same every week. Switch a day off to close it; add more than one block for a lunch break or a split shift.`}
            >
              <Field>
                <FieldLabel>Hours change with the seasons</FieldLabel>
                <FieldControl
                  render={
                    <Switch color="module" checked={seasonal} onCheckedChange={setSeasonalMode} />
                  }
                />
                <FieldDescription>{seasonHelp(seasonal, storedIsSeasonal)}</FieldDescription>
              </Field>

              <WeeklyHours week={draft} seasonal={seasonal} onChange={setWeek} />
              {dirty && !valid ? (
                <Alert color="warning">
                  <AlertContent>
                    <AlertTitle>Some hours don’t add up</AlertTitle>
                    <AlertDescription>
                      Each block needs an end time later than its start. Fix the ones marked in red
                      before saving.
                    </AlertDescription>
                  </AlertContent>
                </Alert>
              ) : null}
            </FormSection>

            {resourceId && windowsQuery.data ? (
              <HoursCopy
                key={resourceId}
                sourceId={resourceId}
                sourceName={resourceName}
                resources={resourceList}
                windows={windowsQuery.data}
                exceptions={exceptionsQuery.data}
                dirty={dirty}
              />
            ) : null}

            {resourceId && exceptionsQuery.data && businessZone ? (
              <Closures
                resourceId={resourceId}
                resourceName={selected?.name ?? 'this one'}
                resourceZone={selected?.timezone ?? businessZone}
                businessZone={businessZone}
                exceptions={exceptionsQuery.data}
              />
            ) : null}
          </Body>
        </div>
      </div>
    </div>
  );
}

/** The gated middle: a load failure or an empty account replaces the editor
 *  rather than rendering an empty week beside a dead Save. */
function Body({
  resources,
  resourcesPending,
  noResources,
  windowsError,
  windowsPending,
  onRetry,
  children,
}: {
  resources: boolean;
  resourcesPending: boolean;
  noResources: boolean;
  windowsError: boolean;
  windowsPending: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (resourcesPending) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading…
      </p>
    );
  }

  if (resources) {
    return (
      <Alert color="error">
        <AlertContent>
          <AlertTitle>Could not load your people & equipment</AlertTitle>
          <AlertDescription>
            This is a problem reaching the server. Your hours are unaffected.
          </AlertDescription>
        </AlertContent>
        <Button size="sm" color="error" variant="soft" onClick={onRetry}>
          Try again
        </Button>
      </Alert>
    );
  }

  if (noResources) {
    return (
      <Card className="p-8">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
          <Users className="size-6" aria-hidden />
          <Heading level={2} className="text-lg font-semibold">
            Add someone or something first
          </Heading>
          <Text className="text-sm">
            Availability is set per person or thing. Add your staff, rooms or equipment under People
            &amp; equipment, then come back to set the hours each one can be booked.
          </Text>
        </div>
      </Card>
    );
  }

  if (windowsError) {
    return (
      <Alert color="error">
        <AlertContent>
          <AlertTitle>Could not load these hours</AlertTitle>
          <AlertDescription>
            This is a problem reaching the server. Nothing about the hours has changed.
          </AlertDescription>
        </AlertContent>
        <Button size="sm" color="error" variant="soft" onClick={onRetry}>
          Try again
        </Button>
      </Alert>
    );
  }

  if (windowsPending) {
    return (
      <p className="p-4 text-sm" role="status">
        Loading hours…
      </p>
    );
  }

  return <>{children}</>;
}
