// A DAY SOMEBODY CHOSE, SAID AS THAT DAY.
//
// A leaf module, importing nothing and rendering nothing, so the rule can be
// tested. The component that draws it is `calendar-date.tsx`.
//
// `<Timestamp>` is for moments, and it renders them in the reader's own zone,
// which is right for "sent 2 minutes ago" and wrong for a calendar date. A
// balance recorded against **19 September** came back as `2026-09-19T00:00:00Z`
// and appeared on screen as **Sep 18**, because the reader was seven hours
// behind UTC. On that pane the day IS the row's identity: the table is keyed on
// it, and the copy promises "recorded per date, so last year's reconciliation
// keeps saying what it said".
//
// So a date-only value travels as `YYYY-MM-DD` (see the server half in
// `@wizeworks/inventory`'s `calendar-date.ts`) and is drawn here without ever
// being parsed into a local time. There is no zone in which 19 September is a
// different day.
//
// `timeZone: 'UTC'` on the formatter is what holds it: the string parses to
// midnight UTC, and reading the UTC fields back gives the day that was typed.

const LONG = new Intl.DateTimeFormat(undefined, {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const SHORT = new Intl.DateTimeFormat(undefined, {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
});

/** `2026-09-19` → "19 Sep 2026", in the reader's own order and language. */
export function calendarDateText(ymd: string, withYear = true): string {
  const at = Date.parse(`${ymd.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(at)) return ymd;
  return (withYear ? LONG : SHORT).format(at);
}
