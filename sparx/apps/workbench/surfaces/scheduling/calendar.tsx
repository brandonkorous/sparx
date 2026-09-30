'use client';

// THE CALENDAR — the operator's diary, everything booked in laid out by time.
//
// Two shapes of the same grid. WEEK is seven day-columns on one time axis — the
// "how does my week look" view. DAY is one day split into a column per resource
// (a member of staff, a bay, a room), which is how a shop actually runs a day:
// who is on what, and where the gaps are. A resource can't be double-booked (the
// database forbids it), so a resource column is a clean single track.
//
// Everything that narrows or moves the diary is a real read: the [from, to)
// window is a server filter, the resource filter is passed to the server too, so
// the grid never sieves a page in the browser and calls it the answer. Color is
// status, carried by the blocks themselves (see calendar-timegrid), so a glance
// tells you what is confirmed, what still needs a nod, and what is under way.
//
// Behind the blocks, the hours nobody works are shaded (issue 084; the bands come
// from calendar-hours). A week of one person shows their week; the day view
// shades each person's own column, since each column IS one person. The week of
// everybody at once shades nothing, because there is no single set of hours to
// draw and shading the union would claim the business is open when only one
// chair is.
//
// Clicking a booking opens a quick-look MODAL over the diary — reschedule, the
// lifecycle moves, and its change history, without splitting or hiding the grid.
// Shift-click opens the full booking pane alongside, alt-click in its own window,
// for anyone who wants the deep editor straight away.

import { useMemo, useState } from 'react';
import {
  Button,
  EmptyState,
  Join,
  NativeSelect,
  Text,
  ToggleGroup,
  ToggleGroupItem,
} from '@wizeworks/silicaui-react';
import { CalendarOff, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { CalendarBookingModal } from './calendar-booking-modal';
import { useSchedulingResources } from './bookings-data';
import {
  addDays,
  addWeeks,
  dayLabel,
  dayWindow,
  isToday,
  useCalendarRange,
  weekDays,
  weekLabel,
  weekdayHeading,
  weekWindow,
  type CalendarEvent,
} from './calendar-data';
import { windowForEvents, type TimeWindow } from './calendar-grid';
import { closedBandsFor, worksOn, type ClosedBand } from './calendar-hours';
import { localDayKey, zoned } from './calendar-zone';
import { useExceptions, useResourceWindows, useResourcesWindows } from './setup-data';
import { TimeGrid, targetFor, type GridColumn } from './calendar-timegrid';
import { RowOpenHint } from '../../components/row-open-hint';

type View = 'week' | 'day';

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
 *  and, when one person is in view, the hours they are shut. */
function weekColumns(
  anchor: Date,
  events: CalendarEvent[],
  chosenResourceId: string,
  shut: ShutHours
): GridColumn[] {
  return weekDays(anchor).map((date) => ({
    key: date.toISOString(),
    header: <WeekHeader date={date} />,
    today: isToday(date),
    ...(chosenResourceId ? { closed: shut.bands(date, chosenResourceId) } : {}),
    // By the day it falls on in its OWN zone, the same clock the block is placed on.
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
function dayColumns(
  events: CalendarEvent[],
  resources: { id: string; name: string }[],
  chosenResourceId: string,
  anchor: Date,
  shut: ShutHours
): GridColumn[] {
  if (chosenResourceId) {
    const name = resources.find((resource) => resource.id === chosenResourceId)?.name ?? 'Booked';
    return [
      {
        key: chosenResourceId,
        header: headerText(name),
        closed: shut.bands(anchor, chosenResourceId),
        events,
      },
    ];
  }
  if (resources.length === 0) {
    return [{ key: 'all', header: headerText('All bookings'), events }];
  }
  // Each column is one person, so each is shaded by that person's own hours:
  // "who is on, and where the gaps are" is the question the day view exists for.
  const columns: GridColumn[] = resources.map((resource) => ({
    key: resource.id,
    header: headerText(resource.name),
    closed: shut.bands(anchor, resource.id),
    events: events.filter((event) => event.resourceIds.includes(resource.id)),
  }));
  const unassigned = events.filter((event) => event.resourceIds.length === 0);
  if (unassigned.length > 0) {
    columns.push({ key: 'unassigned', header: headerText('Unassigned'), events: unassigned });
  }
  return columns;
}

function headerText(label: string) {
  return <span className="truncate text-sm font-semibold">{label}</span>;
}

/** What the diary knows about when people are shut. */
interface ShutHours {
  /** The bands to shade for one person on one date; undefined while their hours
   *  are still arriving, which draws nothing rather than guessing. */
  bands: (date: Date, resourceId: string) => ClosedBand[] | undefined;
  /** Whether anybody in view works at all on this date. */
  anyoneWorks: (date: Date) => boolean;
  /** False while the hours are still arriving, so the empty state waits rather
   *  than guessing. Absence is not a measurement. */
  known: boolean;
}

function useShutHours(
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
      return { bands: () => undefined, anyoneWorks: () => true, known: false };
    }
    return {
      bands: (date: Date, id: string) =>
        closedBandsFor(date, id, rows, closures, view, zones.get(id)),
      anyoneWorks: (date: Date) =>
        ids.some((id) => worksOn(date, id, rows, closures, zones.get(id))),
      known: true,
    };
  }, [ids, rows, closures, view, zones]);
}

/** Nobody can be booked in the whole view, said about one person or everybody. */
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

/**
 * What to say when nothing is booked.
 *
 * "An open diary" was said to everyone, including someone whose week is shut on
 * two of its days, right after they set those days, which reads as the hours not
 * having saved (issue 084). A shut day is not an empty one, and the difference is
 * the whole reason anybody looks.
 */
function emptyLine(resourceId: string, view: View, anchor: Date, shut: ShutHours): string {
  if (!shut.known) {
    return resourceId
      ? 'Nothing is booked here. Try a different week, or show everyone.'
      : 'Nothing is booked yet. New bookings appear here as soon as they are made.';
  }
  const days = view === 'week' ? weekDays(anchor) : [anchor];
  if (!days.some((date) => shut.anyoneWorks(date))) return shutLine(Boolean(resourceId), view);
  // The week of everybody shades nothing (see the header), so it must not point
  // at shading that is not there.
  if (!resourceId && view === 'week') {
    return 'Nothing is booked yet. New bookings appear here as soon as they are made.';
  }
  // Never "the parts left white": in dark mode the shut hours are the DARK ones
  // and the sentence would be backwards.
  return 'The shaded hours are when nobody can be booked. Nothing is booked in the rest yet.';
}

export function CalendarSurface({ ctx }: { ctx: SurfaceContext }) {
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [resourceId, setResourceId] = useState('');
  // The booking shown in the quick-look modal, or null when it is closed.
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const resources = useSchedulingResources();
  // Memoised: a fresh `[]` every render would recompute the shut hours, and so
  // every column, on every render.
  const activeResources = useMemo(() => resources.data ?? [], [resources.data]);

  const range = view === 'week' ? weekWindow(anchor) : dayWindow(anchor);
  const { data, isLoading, isFetching, dataUpdatedAt, isError, refetch } = useCalendarRange({
    ...range,
    ...(resourceId ? { resourceId } : {}),
  });

  const events = useMemo(() => data ?? [], [data]);
  const timeWindow = useMemo(() => windowForEvents(events), [events]);
  const shut = useShutHours(resourceId, activeResources, timeWindow);

  const columns = useMemo(
    () =>
      view === 'week'
        ? weekColumns(anchor, events, resourceId, shut)
        : dayColumns(events, activeResources, resourceId, anchor, shut),
    [view, anchor, events, activeResources, resourceId, shut]
  );

  const label = view === 'week' ? weekLabel(anchor) : dayLabel(anchor);
  const columnMinClass = view === 'week' ? 'min-w-[7rem]' : 'min-w-[12rem]';

  const step = (direction: 1 | -1) => {
    setAnchor((current) =>
      view === 'week' ? addWeeks(current, direction) : addDays(current, direction)
    );
  };

  const openBooking = (event: CalendarEvent, modifiers: { shiftKey: boolean; altKey: boolean }) => {
    // The escape hatch: shift/alt jumps straight to the full booking PANE beside
    // the diary or in its own window. A plain click opens the quick-look modal,
    // which keeps the calendar in view behind it.
    if (modifiers.shiftKey || modifiers.altKey) {
      ctx.open('scheduling.bookings.detail', { id: event.id }, { target: targetFor(modifiers) });
      return;
    }
    setSelectedBookingId(event.id);
  };

  const body = () => {
    if (isError) {
      return (
        <EmptyState
          icon={<CalendarOff className="size-6" aria-hidden />}
          title="Could not load your diary"
          description="This is a problem reaching the server. Nothing in your diary has changed: the bookings just could not be read just now."
          actions={
            <Button
              size="sm"
              color="module"
              variant="soft"
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      );
    }

    if (isLoading && events.length === 0) {
      return (
        <p className="p-4 text-sm" role="status">
          Loading your diary…
        </p>
      );
    }

    return (
      <div className="relative h-full">
        <TimeGrid
          columns={columns}
          window={timeWindow}
          columnMinClass={columnMinClass}
          onOpenEvent={openBooking}
        />
        {events.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-24">
            <div className="bg-base-100 border-base-200 max-w-sm rounded-lg border px-4 py-3 text-center">
              <Text className="font-medium">
                {view === 'week' ? 'Nothing booked this week' : 'Nothing booked this day'}
              </Text>
              <Text className="text-base">{emptyLine(resourceId, view, anchor, shut)}</Text>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Calendar controls"
        status={<Text className="hidden min-w-0 truncate font-medium @sm:block">{label}</Text>}
        controls={
          <>
            <Button
              size="sm"
              variant="outline"
              color="neutral"
              onClick={() => {
                setAnchor(new Date());
              }}
            >
              Today
            </Button>
            <Join>
              <Button
                size="sm"
                variant="outline"
                color="neutral"
                shape="square"
                aria-label={view === 'week' ? 'Previous week' : 'Previous day'}
                onClick={() => {
                  step(-1);
                }}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="outline"
                color="neutral"
                shape="square"
                aria-label={view === 'week' ? 'Next week' : 'Next day'}
                onClick={() => {
                  step(1);
                }}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </Join>
            {/* The "where am I in time" anchor. In the day view especially — whose
            columns are resource names, not dates — this is the only thing naming
            the day. Truncates rather than wraps the bar. */}
            <ToggleGroup
              size="sm"
              color="module"
              className="ml-auto shrink-0"
              value={[view]}
              onValueChange={(next: unknown[]) => {
                const picked = next.at(-1);
                if (picked === 'week' || picked === 'day') setView(picked);
              }}
            >
              <ToggleGroupItem value="day">Day</ToggleGroupItem>
              <ToggleGroupItem value="week">Week</ToggleGroupItem>
            </ToggleGroup>
            {/* People & equipment as a picker, not chips: a business can have twenty,
            and twenty chips is a bar taller than the grid. */}
            <NativeSelect
              size="sm"
              className="hidden shrink @md:block"
              aria-label="Show the diary for"
              value={resourceId}
              disabled={activeResources.length === 0}
              onChange={(domEvent) => {
                setResourceId(domEvent.target.value);
              }}
            >
              <option value="">Everyone &amp; equipment</option>
              {activeResources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}
                </option>
              ))}
            </NativeSelect>
            {/* ALWAYS the last child of a list toolbar — see RefreshButton. */}
          </>
        }
        /* Linked calendars is an ACTION, not a control: it does something to the
           pane rather than narrowing what the pane shows. Written as a value so
           the narrow bar can give it its name - as bespoke `controls` JSX it was
           relocated verbatim, and a popover row holding one bare chain glyph and
           no words is a button with no meaning on a device that cannot hover.
           Piggles was fixed and this, its mirror, was not.
           scripts/check-toolbar-glyph.mjs holds the line. */
        actions={[
          {
            label: 'Linked outside calendars',
            icon: Link2,
            onClick: () => {
              ctx.open('scheduling.calendar.connections', {}, { target: 'beside' });
            },
          },
        ]}
        refresh={
          <RefreshButton
            isFetching={isFetching}
            updatedAt={data ? dataUpdatedAt : undefined}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      />

      {/* One recessed card holding the whole grid. Capped nowhere on purpose: the
          diary earns the full width it is given — more of the day and more
          columns, not a paragraph pinned to the left. */}
      <div className="bg-base-100 min-h-0 flex-1 overflow-hidden rounded-lg">{body()}</div>

      {events.length > 0 ? <RowOpenHint what="a booking to open it" /> : null}

      {/* The quick-look modal floats over the diary — the grid above stays mounted
          and live behind it, so a booking is opened without losing the week. */}
      <CalendarBookingModal
        bookingId={selectedBookingId}
        open={selectedBookingId !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedBookingId(null);
        }}
        ctx={ctx}
      />
    </div>
  );
}

export default CalendarSurface;
