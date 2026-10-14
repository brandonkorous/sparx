'use client';

// What the diary shows: where it sits in time, which resource it is narrowed to,
// and the bookings read for that window. The surface in calendar.tsx only lays it out.

import { useMemo, useState } from 'react';
import { useSchedulingResources } from './bookings-data';
import {
  addDays,
  addWeeks,
  dayLabel,
  dayWindow,
  useCalendarRange,
  weekLabel,
  weekWindow,
} from './calendar-data';
import { windowForEvents } from './calendar-grid';
import { dayColumns, useShutHours, weekColumns, type View } from './calendar-columns';

function useDiaryPosition() {
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [resourceId, setResourceId] = useState('');
  // Bumped whenever the diary moves you in time, so the grid puts today back on
  // screen (TimeGrid's `revealNonce`). A counter, because pressing Today inside this
  // week changes no other state and still has to bring today back.
  const [revealNonce, setRevealNonce] = useState(0);
  const reveal = () => {
    setRevealNonce((current) => current + 1);
  };

  return {
    view,
    anchor,
    resourceId,
    setResourceId,
    revealNonce,
    changeView: (next: View) => {
      reveal();
      setView(next);
    },
    moveTo: (date: Date) => {
      reveal();
      setAnchor(date);
    },
    step: (direction: 1 | -1) => {
      reveal();
      setAnchor((current) =>
        view === 'week' ? addWeeks(current, direction) : addDays(current, direction)
      );
    },
  };
}

export function useDiary() {
  const position = useDiaryPosition();
  const { view, anchor, resourceId } = position;

  const resources = useSchedulingResources();
  // Memoized because the working-hours read depends on it, and a fresh `[]` every
  // render would re-run it every render.
  const activeResources = useMemo(() => resources.data ?? [], [resources.data]);

  // The [from, to) window and the resource are server filters: the grid never
  // sieves a page in the browser and calls it the answer.
  const range = view === 'week' ? weekWindow(anchor) : dayWindow(anchor);
  const query = useCalendarRange({ ...range, ...(resourceId ? { resourceId } : {}) });
  const { data } = query;

  const events = useMemo(() => data ?? [], [data]);
  const timeWindow = useMemo(() => windowForEvents(events), [events]);
  const shut = useShutHours(resourceId, activeResources, timeWindow);
  const columns = useMemo(
    () =>
      view === 'week'
        ? weekColumns(anchor, events, shut)
        : dayColumns(events, resources.data ?? [], resourceId, anchor, shut),
    [view, anchor, events, resources.data, resourceId, shut]
  );

  return {
    ...position,
    activeResources,
    query,
    events,
    timeWindow,
    shut,
    columns,
    label: view === 'week' ? weekLabel(anchor) : dayLabel(anchor),
    // A day's columns are people and must fit a phone, so the floor drops on a
    // narrow pane. A week's seven never fit; it scrolls and opens on today.
    columnMinClass: view === 'week' ? 'min-w-[7rem]' : 'min-w-[9rem] @md:min-w-[12rem]',
  };
}

export type Diary = ReturnType<typeof useDiary>;
