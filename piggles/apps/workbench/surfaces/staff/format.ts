// Staff display helpers — hours, money, and the plain-language name for every
// code the API returns.
//
// The reader owns a business, not an HR qualification. Nothing here says
// "FTE", "accrual", "burden rate" or "PTO"; a rate basis reads "Per hour", a
// burden reads "employer costs on top", and a certification that has lapsed
// says so in words before it says so in a colour.
//
// COLOUR IS THE DESIGN, not decoration on it (DESIGN.md RULE #4). Every state
// function here returns a tone, because on all six of these surfaces the colour
// is what carries the distinction — an expired licence and a valid one rendering
// the same grey is a failed screen, not a safe one.

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/* ── Hours ─────────────────────────────────────────────────────────────────── */

/**
 * Minutes → the way a person says a duration. `7h 30m`, `45m`, `8h`.
 *
 * Deliberately NOT decimal hours. "7.5h" is a payroll export format; a timesheet
 * is read by whoever worked the shift, and they think in hours and minutes.
 */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0h';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)}m`;
  if (rest === 0) return `${String(hours)}h`;
  return `${String(hours)}h ${String(rest)}m`;
}

/** Decimal hours, for the one place it IS the right unit: a figure being handed
 *  to whoever runs payroll. Two places, because a quarter-hour is 0.25. */
export function decimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

/* ── Money ─────────────────────────────────────────────────────────────────── */

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
}

/**
 * A cost that may not exist.
 *
 * NULL IS NOT ZERO, and this function is where that rule is enforced for every
 * staff surface. Null means no pay rate covers this person's work in this
 * period, so the honest cell is an em-dash — printing "$0.00" tells the owner a
 * week of somebody's labour was free, which is the single most expensive lie
 * this module could tell.
 */
export function formatCostOrNothing(cents: number | null, currency = 'USD'): string {
  return cents === null ? '—' : formatCents(cents, currency);
}

/**
 * A CALENDAR DAY — a `@db.Date` column, rendered in UTC.
 *
 * The timezone is the whole point, and leaving it off is a real bug we shipped:
 * Postgres hands a `@db.Date` back at UTC midnight, so formatting it in local
 * time moves it a day backwards for everyone west of Greenwich. A rate entered
 * as "1 Jan" then reads "Dec 31" on the screen that is supposed to explain which
 * rate priced which shift. `dayKey` in @sparx/staff makes the same argument for
 * the server half.
 *
 * Use this for effective-from/to, worked-on, earned-on and expires-on. For an
 * actual instant (`@db.Timestamptz` — a clock-in, a signature, a leave window)
 * use `formatMoment`, where the reader's own timezone IS the right answer.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
}

/** The day of an INSTANT, in the reader's timezone. See `formatDate`. */
export function formatMoment(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** `YYYY-MM-DD` for a date input and for the API's date params. */
export function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/* ── The person ────────────────────────────────────────────────────────────── */

export function employmentLabel(type: string): string {
  switch (type) {
    case 'contractor':
      return 'Contractor';
    case 'volunteer':
      return 'Volunteer';
    default:
      return 'Employee';
  }
}

/**
 * Where someone is in their time with the business.
 *
 * `onboarding` is `info` rather than `warning`: a new starter is good news, not
 * a problem. `suspended` is the one that needs to catch an eye.
 */
export function staffState(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'active':
      return { label: 'Working', tone: 'success' };
    case 'onboarding':
      return { label: 'Starting', tone: 'info' };
    case 'suspended':
      return { label: 'Suspended', tone: 'warning' };
    case 'former':
      return { label: 'Left', tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

/* ── Pay ───────────────────────────────────────────────────────────────────── */

export function basisLabel(basis: string): string {
  switch (basis) {
    case 'hourly':
      return 'Per hour';
    case 'salary':
      return 'Yearly salary';
    case 'commission':
      return 'Commission only';
    default:
      return 'Unpaid';
  }
}

/** What a rate amount MEANS, spelled out beside the figure — the difference
 *  between $30 an hour and a $30,000 salary is a factor of about fifty, and a
 *  bare number in a list is exactly where that gets misread. */
export function rateAmountLabel(basis: string, amountCents: number, currency = 'USD'): string {
  switch (basis) {
    case 'hourly':
      return `${formatCents(amountCents, currency)} an hour`;
    case 'salary':
      return `${formatCents(amountCents, currency)} a year`;
    case 'commission':
      return 'Commission only';
    default:
      return 'No wage';
  }
}

/** A rate window, in words. An open-ended rate is the one in force TODAY, and
 *  saying so beats rendering a blank end date. */
export function rateWindowLabel(effectiveFrom: string, effectiveTo: string | null): string {
  if (!effectiveTo) return `From ${formatDate(effectiveFrom)} — current`;
  return `${formatDate(effectiveFrom)} – ${formatDate(effectiveTo)}`;
}

/* ── Time ──────────────────────────────────────────────────────────────────── */

/**
 * A time entry's state.
 *
 * `open` is `info` and reads "On the clock" — it is not a problem, it is
 * someone at work right now, and it is the only state whose duration is still
 * moving. `approved` is `success` because it is the one that has reached the
 * ledger.
 */
export function timeState(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'open':
      return { label: 'On the clock', tone: 'info' };
    case 'submitted':
      return { label: 'Waiting', tone: 'warning' };
    case 'approved':
      return { label: 'Approved', tone: 'success' };
    case 'rejected':
      return { label: 'Sent back', tone: 'error' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

export function sourceLabel(source: string): string {
  switch (source) {
    case 'clock':
      return 'Clocked in';
    case 'import':
      return 'Imported';
    default:
      return 'Entered by hand';
  }
}

/* ── The rota ──────────────────────────────────────────────────────────────── */

/** A draft rota is not a mistake — it is next week, half built. `neutral` is
 *  earned here: an unpublished shift is genuinely untyped until it is released. */
export function shiftState(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'published':
      return { label: 'Published', tone: 'success' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'error' };
    default:
      return { label: 'Draft', tone: 'neutral' };
  }
}

export function timeOffKindLabel(kind: string): string {
  switch (kind) {
    case 'sick':
      return 'Off sick';
    case 'unpaid':
      return 'Unpaid leave';
    case 'other':
      return 'Time off';
    default:
      return 'Holiday';
  }
}

/** Sick leave wears `warning` rather than the neutral of a booked holiday: it is
 *  the one kind that arrives unplanned and changes today's rota. */
export function timeOffKindTone(kind: string): Tone {
  return kind === 'sick' ? 'warning' : 'info';
}

export function timeOffState(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'approved':
      return { label: 'Approved', tone: 'success' };
    case 'denied':
      return { label: 'Declined', tone: 'error' };
    case 'cancelled':
      return { label: 'Withdrawn', tone: 'neutral' };
    default:
      return { label: 'Waiting on you', tone: 'warning' };
  }
}

/* ── Certifications ────────────────────────────────────────────────────────── */

/**
 * A qualification's state, in words and colour.
 *
 * The four are genuinely four (docs/149 §5). `none` — a qualification that does
 * not expire — is a REAL answer and must never render as a warning or sort to
 * the top of a list whose whole job is showing what needs attention.
 */
export function certificationLabel(
  state: string,
  daysUntilExpiry: number | null
): { label: string; tone: Tone } {
  switch (state) {
    case 'expired': {
      const days = daysUntilExpiry === null ? null : Math.abs(daysUntilExpiry);
      if (days === null) return { label: 'Expired', tone: 'error' };
      return {
        label: days <= 1 ? 'Expired' : `Expired ${String(days)} days ago`,
        tone: 'error',
      };
    }
    case 'expiring': {
      if (daysUntilExpiry === null) return { label: 'Expiring', tone: 'warning' };
      if (daysUntilExpiry <= 0) return { label: 'Expires today', tone: 'warning' };
      return {
        label:
          daysUntilExpiry === 1 ? 'Expires tomorrow' : `Expires in ${String(daysUntilExpiry)} days`,
        tone: 'warning',
      };
    }
    case 'none':
      return { label: 'No expiry', tone: 'info' };
    default:
      return { label: 'Valid', tone: 'success' };
  }
}

export function documentKindLabel(kind: string): string {
  switch (kind) {
    case 'contract':
      return 'Contract';
    case 'handbook':
      return 'Handbook';
    case 'id':
      return 'ID';
    case 'certification':
      return 'Certificate';
    default:
      return 'Other';
  }
}

/* ── Commission ────────────────────────────────────────────────────────────── */

export function commissionState(status: string): { label: string; tone: Tone } {
  switch (status) {
    case 'paid':
      return { label: 'Paid', tone: 'success' };
    case 'approved':
      return { label: 'Approved', tone: 'info' };
    case 'void':
      return { label: 'Cancelled', tone: 'neutral' };
    default:
      return { label: 'Pending', tone: 'warning' };
  }
}

/* ── Periods ───────────────────────────────────────────────────────────────── */

/** The calendar month containing `date`, as the two date strings the API wants. */
export function monthRange(date: Date): { from: string; to: string } {
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { from: toDateInput(from), to: toDateInput(to) };
}

/** The Monday-to-Sunday week containing `date`. A rota is read by the week, and
 *  a week that starts on Sunday puts the weekend at both ends of the screen. */
export function weekRange(date: Date): { from: string; to: string } {
  const day = date.getUTCDay();
  const backToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(date.getTime() - backToMonday * 86_400_000);
  const start = new Date(
    Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate())
  );
  const end = new Date(start.getTime() + 6 * 86_400_000);
  return { from: toDateInput(start), to: toDateInput(end) };
}

export function shiftRange(range: { from: string; to: string }, weeks: number) {
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const moved = new Date(from.getTime() + weeks * 7 * 86_400_000);
  return weekRange(moved);
}

export function monthShift(range: { from: string; to: string }, months: number) {
  const from = new Date(`${range.from}T00:00:00.000Z`);
  return monthRange(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1)));
}

export function periodLabel(from: string, to: string): string {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    return start.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, { ...opts, year: 'numeric' })}`;
}
