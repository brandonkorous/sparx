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
  setAvailabilityWindows,
  listAvailabilityWindows,
  createAvailabilityException,
  listAvailabilityExceptions,
  deleteAvailabilityException,
} from './availability-rules';
export { bootstrapSchedulingDefaults } from './provisioning';
