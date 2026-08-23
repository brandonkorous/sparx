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
import { isSameDay, isToday, weekDays, weekdayHeading, type CalendarEvent } from './calendar-data';
import type { GridColumn } from './calendar-timegrid';

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
    events: events.filter((event) => isSameDay(new Date(event.startAt), date)),
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
  resources: { id: string; name: string }[],
  chosenResourceId: string,
  anchor: Date,
  shut: ShutHours
): GridColumn[] {
  if (chosenResourceId) {
    const name = resources.find((resource) => resource.id === chosenResourceId)?.name ?? 'Booked';
    return [{ key: chosenResourceId, header: headerText(name), closed: shut.on(anchor), events }];
  }
  if (resources.length === 0) {
    return [{ key: 'all', header: headerText('All bookings'), events }];
  }
  const columns: GridColumn[] = resources.map((resource) => ({
    key: resource.id,
    header: headerText(resource.name),
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
  worksOn: (date: Date) => boolean;
  /** False while the hours are still arriving, so the empty state waits rather
   *  than guessing (RULE #4 — absence is not a measurement). */
  known: boolean;
}

export function useShutHours(
  resourceId: string,
  resources: { id: string }[],
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

  return useMemo(() => {
    if (ids.length === 0 || !rows || !closures) {
      return { on: () => undefined, worksOn: () => true, known: false };
    }
    return {
      // Only a SINGLE person's day can be shaded: with several on screen at once
      // there is no one set of hours to draw, and shading the union would claim
      // the shop is open when only one chair is.
      on: (date: Date) =>
        resourceId ? closedBandsFor(date, resourceId, rows, closures, view) : undefined,
      // Anybody at all. On the everyone view "is this day workable" is the only
      // question the screen can answer, and it is the one being asked.
      worksOn: (date: Date) => ids.some((id) => worksOn(date, id, rows, closures)),
      known: true,
    };
  }, [ids, resourceId, rows, closures, view]);
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
  if (!resourceId) {
    return 'Nothing is booked yet. New bookings appear here as soon as they are made.';
  }
  // Never "the parts left white": in dark mode the shut hours are the DARK ones
  // and the sentence would be backwards.
  return 'The shaded parts are when they are not working. Nothing is booked in the rest yet.';
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

function headerText(label: string) {
  return <span className="truncate text-sm font-semibold">{label}</span>;
}
