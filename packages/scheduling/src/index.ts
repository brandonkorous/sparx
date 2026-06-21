// sparx Scheduling engine (docs/79) — service-layer barrel.
//
// The availability/slot engine, the booking lifecycle with the DB-level
// no-overlap guarantee, and resource/service/availability setup. Consumed by the
// REST API, Server Actions, the public booking widget, the scheduling-worker, and
// the MCP tools — every transport validates against @sparx/scheduling-schemas
// first, then calls these.

export * from './errors';
export {
  type Interval,
  overlaps,
  contains,
  mergeIntervals,
  subtractIntervals,
  tzOffsetMs,
  localWallToUtc,
  localCalendarParts,
  eachLocalDay,
} from './time';
export {
  type ResourceAvailability,
  type SlotComputationInput,
  type ComputedSlot,
  resourceFreeIntervals,
  computeSlots,
  getAvailability,
} from './availability';
export {
  type CreatedBooking,
  createBooking,
  updateBooking,
  confirmBooking,
  cancelBooking,
  rescheduleBooking,
  checkInBooking,
  completeBooking,
  noShowBooking,
} from './booking-service';
export {
  type BookingWithRelations,
  type ListBookingsOptions,
  type CalendarEvent,
  getBooking,
  listBookings,
  getCalendar,
} from './booking-queries';
export {
  createResource,
  updateResource,
  getResource,
  listResources,
  deleteResource,
} from './resources';
export { createService, updateService, getService, listServices, deleteService } from './services';
export {
  createBookingPolicy,
  updateBookingPolicy,
  getBookingPolicy,
  listBookingPolicies,
  deleteBookingPolicy,
} from './policies';
export {
  setAvailabilityWindows,
  listAvailabilityWindows,
  createAvailabilityException,
  listAvailabilityExceptions,
  deleteAvailabilityException,
} from './availability-rules';
export { bootstrapSchedulingDefaults } from './provisioning';
export {
  type BookingNotificationType,
  type NotificationChannel,
  type NotifiableBooking,
  BOOKING_EMAIL_KEY,
  scheduleBookingNotifications,
  rescheduleBookingNotifications,
  cancelBookingNotifications,
  dropPendingBookingNotifications,
} from './notifications';
export { type BookingSmsFields, renderBookingSms } from './sms-templates';
export {
  type IcsEvent,
  type IcsStatus,
  type IcsCalendarMeta,
  buildIcsEvent,
  buildIcsFeed,
  formatIcsUtc,
  escapeIcsText,
  googleCalendarUrl,
  outlookCalendarUrl,
} from './ical';
export {
  type Frequency,
  type RRuleParts,
  parseRRule,
  parseIcsInstant,
  expandRecurrence,
} from './rrule';
export { type BusyParseOptions, parseBusyIntervals, parseIcsDuration } from './ical-parse';
export {
  type DepositType,
  type DepositPolicyInput,
  type DepositPlan,
  computeFee,
  computeNoShowFee,
  computeLateCancelFee,
  resolveDepositPlan,
  isLateCancellation,
} from './deposits';
