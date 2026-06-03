// Calendar — a presentational month grid (docs/46 §5.2). SERVER component,
// structural. Renders a static month (weekday header + day cells) with optional
// `today` / `selected` markers; date-picking interactivity is a client concern
// layered on top. `calendarMonth()` (exported) builds the cell grid.

import * as React from 'react';
import { cx } from '../utils/cx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The day cells for a month as a flat list (leading/trailing blanks are null),
 *  laid out in weeks of 7 starting on `weekStartsOn` (0 = Sunday). */
export function calendarMonth(year: number, month: number, weekStartsOn = 0): (number | null)[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const offset = (firstWeekday - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export interface CalendarProps {
  /** Full year, e.g. 2026. */
  year: number;
  /** Month index, 0 (January) – 11 (December). */
  month: number;
  /** Day-of-month to mark as selected. */
  selected?: number;
  /** Day-of-month to mark as today. */
  today?: number;
  /** First column weekday (0 = Sunday). Defaults to 0. */
  weekStartsOn?: number;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export function Calendar({
  year,
  month,
  selected,
  today,
  weekStartsOn = 0,
  className,
  style,
  id,
}: CalendarProps): React.ReactElement {
  const cells = calendarMonth(year, month, weekStartsOn);
  const headers = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(i + weekStartsOn) % 7]);

  return (
    <div className={cx('sf-calendar', className)} style={style} id={id}>
      <div className="sf-calendar__grid" role="grid">
        {headers.map((h) => (
          <div key={h} className="sf-calendar__weekday" role="columnheader">
            {h}
          </div>
        ))}
        {cells.map((day, i) =>
          day == null ? (
            <div key={`b-${i}`} className="sf-calendar__cell sf-calendar__cell--blank" />
          ) : (
            <div
              key={day}
              role="gridcell"
              aria-selected={day === selected || undefined}
              className={cx(
                'sf-calendar__cell',
                day === today && 'sf-calendar__cell--today',
                day === selected && 'sf-calendar__cell--selected'
              )}
            >
              {day}
            </div>
          )
        )}
      </div>
    </div>
  );
}
Calendar.displayName = 'Calendar';
