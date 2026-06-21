// Typed errors for the scheduling engine. Each carries a stable `code` so REST /
// Server Actions / MCP can map to the platform error envelope (docs/06 §4).

export class SchedulingError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SchedulingError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The requested time can't be allocated — a required resource is busy (or lost a
 *  race to the DB-level no-overlap constraint). The booking surface re-fetches
 *  availability and asks the customer to pick again. */
export class SlotUnavailableError extends SchedulingError {
  constructor(message = 'That time is no longer available') {
    super('SLOT_UNAVAILABLE', message);
    this.name = 'SlotUnavailableError';
  }
}

export class BookingNotFoundError extends SchedulingError {
  constructor(id: string) {
    super('BOOKING_NOT_FOUND', `Booking ${id} not found`);
    this.name = 'BookingNotFoundError';
  }
}

export class ResourceNotFoundError extends SchedulingError {
  constructor(id: string) {
    super('RESOURCE_NOT_FOUND', `Resource ${id} not found`);
    this.name = 'ResourceNotFoundError';
  }
}

export class ServiceNotFoundError extends SchedulingError {
  constructor(id: string) {
    super('SERVICE_NOT_FOUND', `Service ${id} not found`);
    this.name = 'ServiceNotFoundError';
  }
}

export class BookingPolicyNotFoundError extends SchedulingError {
  constructor(id: string) {
    super('BOOKING_POLICY_NOT_FOUND', `Booking policy ${id} not found`);
    this.name = 'BookingPolicyNotFoundError';
  }
}

export class CalendarConnectionNotFoundError extends SchedulingError {
  constructor(id: string) {
    super('CALENDAR_CONNECTION_NOT_FOUND', `Calendar connection ${id} not found`);
    this.name = 'CalendarConnectionNotFoundError';
  }
}

export class BookingSeriesNotFoundError extends SchedulingError {
  constructor(id: string) {
    super('BOOKING_SERIES_NOT_FOUND', `Booking series ${id} not found`);
    this.name = 'BookingSeriesNotFoundError';
  }
}

/** The supplied RRULE has no recognizable FREQ — the series can't be expanded. */
export class InvalidRecurrenceError extends SchedulingError {
  constructor(rrule: string) {
    super('INVALID_RECURRENCE', `Could not parse the recurrence rule: ${rrule}`);
    this.name = 'InvalidRecurrenceError';
  }
}

/** An action isn't valid for the booking's current status (e.g. checking in a
 *  cancelled booking). */
export class InvalidBookingStateError extends SchedulingError {
  constructor(message: string) {
    super('INVALID_BOOKING_STATE', message);
    this.name = 'InvalidBookingStateError';
  }
}

/** No candidate resource satisfies a required role on the service (bad config or
 *  an over-constrained skill filter). */
export class NoEligibleResourceError extends SchedulingError {
  constructor(role: string) {
    super('NO_ELIGIBLE_RESOURCE', `No bookable resource matches the "${role}" requirement`);
    this.name = 'NoEligibleResourceError';
  }
}

/** Postgres exclusion_violation (SQLSTATE 23P01) from the booking_resources
 *  no-overlap constraint (docs/79 §7.4) — the authoritative double-booking guard.
 *  Prisma surfaces the raw SQLSTATE in `.meta.code` for `$executeRaw`, or the
 *  constraint name in the message; match either so a race becomes a clean
 *  SlotUnavailableError instead of a 500. */
export function isExclusionViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; meta?: { code?: unknown }; message?: unknown };
  if (e.code === '23P01') return true;
  if (e.meta && typeof e.meta === 'object' && e.meta.code === '23P01') {
    return true;
  }
  return typeof e.message === 'string' && e.message.includes('booking_resources_no_overlap');
}
