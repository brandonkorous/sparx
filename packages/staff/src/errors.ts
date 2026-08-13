// Typed errors for the staff module. Each carries a stable `code` so REST /
// Server Actions / MCP map to the platform error envelope (docs/06 §4), and the
// message is written for a business owner rather than for a log line — these
// reach the screen.

export class StaffError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'StaffError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class StaffMemberNotFoundError extends StaffError {
  constructor(id: string) {
    super('STAFF_MEMBER_NOT_FOUND', `Staff member ${id} not found`);
    this.name = 'StaffMemberNotFoundError';
  }
}

export class TimeEntryNotFoundError extends StaffError {
  constructor(id: string) {
    super('STAFF_TIME_ENTRY_NOT_FOUND', `Time entry ${id} not found`);
    this.name = 'TimeEntryNotFoundError';
  }
}

export class ShiftNotFoundError extends StaffError {
  constructor(id: string) {
    super('STAFF_SHIFT_NOT_FOUND', `Shift ${id} not found`);
    this.name = 'ShiftNotFoundError';
  }
}

export class TimeOffRequestNotFoundError extends StaffError {
  constructor(id: string) {
    super('STAFF_TIME_OFF_NOT_FOUND', `Time-off request ${id} not found`);
    this.name = 'TimeOffRequestNotFoundError';
  }
}

/**
 * A shift has to end after it starts, and a PATCH is where that gets broken:
 * moving only the end time is a one-field edit that can invert the window, and
 * no schema validating that one field can see the other half.
 *
 * The table has the same CHECK, so this is not the only line of defence — it is
 * the difference between a message the manager can act on and a constraint
 * violation surfacing as a 500.
 */
export class InvalidShiftWindowError extends StaffError {
  constructor() {
    super('STAFF_SHIFT_WINDOW_INVALID', 'A shift has to end after it starts.');
    this.name = 'InvalidShiftWindowError';
  }
}

export class CertificationNotFoundError extends StaffError {
  constructor(id: string) {
    super('STAFF_CERTIFICATION_NOT_FOUND', `Certification ${id} not found`);
    this.name = 'CertificationNotFoundError';
  }
}

export class StaffDocumentNotFoundError extends StaffError {
  constructor(id: string) {
    super('STAFF_DOCUMENT_NOT_FOUND', `Document ${id} not found`);
    this.name = 'StaffDocumentNotFoundError';
  }
}

/**
 * Two pay rates cannot both be in force on the same day — the labour deriver
 * would have to pick one, and whichever it picked would be arbitrary.
 *
 * The database cannot express this without an exclusion index over a range type,
 * so `setRate` enforces it. The one overlap that IS allowed is a new rate opening
 * after an open-ended predecessor: that predecessor is closed the day before,
 * which is how a raise is meant to be recorded.
 */
export class OverlappingPayRateError extends StaffError {
  constructor(from: string) {
    super(
      'STAFF_PAY_RATE_OVERLAP',
      `This person already has a pay rate covering those dates (starting ${from}). End the existing rate first, or pick a start date after it.`
    );
    this.name = 'OverlappingPayRateError';
  }
}

/**
 * A clock cannot be started for someone who is already clocked in.
 *
 * Without this, a double tap on a phone opens two entries and the person is paid
 * twice for one shift — and because both entries look valid, nothing downstream
 * can tell which to discard.
 */
export class AlreadyClockedInError extends StaffError {
  constructor(name: string) {
    super(
      'STAFF_ALREADY_CLOCKED_IN',
      `${name} is already clocked in. Clock out first, or edit the open entry.`
    );
    this.name = 'AlreadyClockedInError';
  }
}

export class NotClockedInError extends StaffError {
  constructor(name: string) {
    super('STAFF_NOT_CLOCKED_IN', `${name} is not clocked in right now.`);
    this.name = 'NotClockedInError';
  }
}

/**
 * Approved time is what the profit figure is built on, so it is not editable in
 * place. Reopen it first — which is a deliberate, visible act that tells whoever
 * approved it that the number they signed off has changed.
 */
export class ApprovedTimeLockedError extends StaffError {
  constructor() {
    super(
      'STAFF_TIME_APPROVED_LOCKED',
      'This time has been approved and counted towards your costs. Reopen it before making changes.'
    );
    this.name = 'ApprovedTimeLockedError';
  }
}

/**
 * The labour deriver needs somewhere to file the cost, and that is the seeded
 * `wages` category from the finance module. If it is missing, finance was never
 * installed for this tenant — deriving into a category we invent on the spot
 * would put labour somewhere the owner never agreed to and cannot find.
 */
export class WagesCategoryMissingError extends StaffError {
  constructor() {
    super(
      'STAFF_WAGES_CATEGORY_MISSING',
      'Wages costs need the Finance module switched on, so there is somewhere to record them.'
    );
    this.name = 'WagesCategoryMissingError';
  }
}
