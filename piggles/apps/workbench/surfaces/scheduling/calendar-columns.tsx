'use client';

// THE COLUMNS the diary draws, and what to say when they are empty.
//
// Lifted out of calendar.tsx, which had grown past the file-size rule once the
// grid learned about working hours. This half answers "what goes in each strip";
// calendar.tsx answers "which strips, and what is in the toolbar".

import { useMemo } from 'react';
import { useExceptions, useResourceWindows, useResourcesWindows } from './setup-data';
import { closedBandsFor, worksOn, type ClosedBand } from './calendar-hours';
import type { TimeWindow } from './calendar-grid';
import { isToday, weekDays, weekdayHeading, type CalendarEvent } from './calendar-data';
import { localDayKey, zoned } from './calendar-zone';
import type { GridColumn } from './calendar-timegrid';
import { Icon } from '@piggles/ui';
import { resourceKindIcon } from './resource-kind-icon';

export type View = 'week' | 'day';

/** Column heading for a week day — the weekday over its date, today lit up. */
function WeekHeader({ date }: { date: Date }) {
  const { weekday, day } = weekdayHeading(date);
  const today = isToday(date);
  return (
    <span className="flex flex-col items-center leading-tight">
      <span className="text-xs">{weekday}</span>
      <span className={`text-sm tabular-nums ${today ? 'font-bold' : 'font-medium'}`}>{day}</span>
    </span>
  );
}

/** The week's seven day columns, each carrying the bookings that START on it,
 *  and — when one person is in view — the hours they are shut. */
export function weekColumns(anchor: Date, events: CalendarEvent[], shut: ShutHours): GridColumn[] {
  return weekDays(anchor).map((date) => ({
    key: date.toISOString(),
    header: <WeekHeader date={date} />,
    today: isToday(date),
    closed: shut.on(date),
    // Its OWN zone's day: the same clock the block is placed on.
    events: events.filter(
      (event) => zoned(event.startAt, event.timezone).dayKey === localDayKey(date)
    ),
  }));
}

/**
 * The day's columns — one per resource, plus an "Unassigned" column for anything
 * not yet given to anyone. When a single resource is chosen the server already
 * narrowed the read, so it is one column; when the business has no resources set
 * up at all, the whole day is a single track.
 */
export function dayColumns(
  events: CalendarEvent[],
  resources: { id: string; name: string; kind?: string }[],
  chosenResourceId: string,
  anchor: Date,
  shut: ShutHours
): GridColumn[] {
  if (chosenResourceId) {
    const chosen = resources.find((resource) => resource.id === chosenResourceId);
    return [
      {
        key: chosenResourceId,
        header: headerText(chosen?.name ?? 'Booked', chosen?.kind),
        closed: shut.on(anchor),
        events,
      },
    ];
  }
  if (resources.length === 0) {
    return [{ key: 'all', header: headerText('All bookings'), events }];
  }
  // Each column is one person, so each is shaded by that person's own hours.
  const columns: GridColumn[] = resources.map((resource) => ({
    key: resource.id,
    header: headerText(resource.name, resource.kind),
    closed: shut.bands(anchor, resource.id),
    events: events.filter((event) => event.resourceIds.includes(resource.id)),
  }));
  const unassigned = events.filter((event) => event.resourceIds.length === 0);
  if (unassigned.length > 0) {
    columns.push({ key: 'unassigned', header: headerText('Unassigned'), events: unassigned });
  }
  return columns;
}

/** What the calendar knows about when the person in view is shut. `on` answers
 *  nothing at all when no one person is chosen — with everybody on screen there
 *  is no single week to draw. */
export interface ShutHours {
  on: (date: Date) => ClosedBand[] | undefined;
  /** One person's shut hours on a date, for the day view's per-person columns. */
  bands: (date: Date, resourceId: string) => ClosedBand[] | undefined;
  worksOn: (date: Date) => boolean;
  /** False while the hours are still arriving, so the empty state waits rather
   *  than guessing (RULE #4 — absence is not a measurement). */
  known: boolean;
}

export function useShutHours(
  resourceId: string,
  // `timezone` is on every resource the API sends (its `resourceView`); the
  // shut hours are that person's clock, not the viewer's.
  resources: { id: string; timezone?: string | null }[],
  view: TimeWindow
): ShutHours {
  const one = useResourceWindows(resourceId || null);
  // The everyone view asks for everybody's hours; the single view does not need
  // them, so it asks for none. Both land in the same per-resource cache.
  const everyone = useResourcesWindows(resourceId ? [] : resources.map((r) => r.id));
  const exceptions = useExceptions();
  const rows = resourceId ? one.data : everyone.rows;
  const closures = exceptions.data;
  const ids = useMemo(
    () => (resourceId ? [resourceId] : resources.map((r) => r.id)),
    [resourceId, resources]
  );
  const zones = useMemo(
    () => new Map(resources.map((r) => [r.id, r.timezone ?? null])),
    [resources]
  );

  return useMemo(() => {
    if (ids.length === 0 || !rows || !closures) {
      return { on: () => undefined, bands: () => undefined, worksOn: () => true, known: false };
    }
    return {
      // A WEEK column is shaded for one person only: shading everyone's union
      // would claim the shop is open when only one chair is.
      on: (date: Date) =>
        resourceId
          ? closedBandsFor(date, resourceId, rows, closures, view, zones.get(resourceId))
          : undefined,
      bands: (date: Date, id: string) =>
        closedBandsFor(date, id, rows, closures, view, zones.get(id)),
      // Anybody at all. On the everyone view "is this day workable" is the only
      // question the screen can answer, and it is the one being asked.
      worksOn: (date: Date) => ids.some((id) => worksOn(date, id, rows, closures, zones.get(id))),
      known: true,
    };
  }, [ids, resourceId, rows, closures, view, zones]);
}

/**
 * What to say when nothing is booked.
 *
 * "An open diary" was said to everyone, including someone whose week is shut on
 * two of its days — right after they set those days, which reads as the hours
 * not having saved (issue 084). And "resource" is the schema's word for a chair.
 *
 * That fix reached only the view showing ONE person, and the diary opens showing
 * everybody: a Sunday nobody works still read "Nothing is booked yet. New
 * bookings appear here as soon as they are made", which invites an owner to
 * expect a day the shop is shut. A closed day is not an empty one, and the
 * difference is the whole reason anybody looks.
 */
export function emptyLine(resourceId: string, view: View, anchor: Date, shut: ShutHours): string {
  if (!shut.known) {
    return resourceId
      ? 'Nothing is booked here. Try a different week, or show everyone.'
      : 'Nothing is booked yet. New bookings appear here as soon as they are made.';
  }
  const days = view === 'week' ? weekDays(anchor) : [anchor];
  const open = days.filter((date) => shut.worksOn(date));
  if (open.length === 0) return shutLine(Boolean(resourceId), view);
  if (!resourceId && view === 'week') {
    return 'Nothing is booked yet. New bookings appear here as soon as they are made.';
  }
  // Never "the parts left white": in dark mode the shut hours are the DARK ones
  // and the sentence would be backwards.
  return resourceId
    ? 'The shaded parts are when they are not working. Nothing is booked in the rest yet.'
    : 'The shaded parts are when each person is not working. Nothing is booked in the rest yet.';
}

/** Nobody can be booked, said about one person or about the whole shop. */
function shutLine(one: boolean, view: View): string {
  if (view === 'week') {
    return one
      ? 'They are not working at all this week, so nothing can be booked in it.'
      : 'Nobody is working at all this week, so nothing can be booked in it.';
  }
  return one
    ? 'They are not working this day, so nothing can be booked in it.'
    : 'Nobody is working this day, so nothing can be booked in it.';
}

/** A column's heading. A resource's carries the picture for its kind, so a bay
 *  and the person working it are told apart at a glance (sparx persona issue 086). */
function headerText(label: string, kind?: string) {
  if (kind === undefined) return <span className="truncate text-sm font-semibold">{label}</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Icon glyph={resourceKindIcon(kind)} className="size-4 shrink-0" aria-hidden />
      <span className="truncate text-sm font-semibold">{label}</span>
    </span>
  );
}
