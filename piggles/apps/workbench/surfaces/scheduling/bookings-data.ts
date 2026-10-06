'use client';

// The scheduling bookings data layer: every read, write, query key and row type the
// Bookings surfaces use. A series occurrence IS a booking, so series writes refresh
// the booking root too. The server's Zod has the final say on every write payload.
export { schedulingErrorMessage, isNotFound } from './bookings-data/errors';
export { describeTimelineEntry, timelineActorLabel } from './bookings-data/timeline-words';
export {
  formatWhen,
  bookingResourceLabel,
  formatClock,
  formatDay,
  formatMoney,
  bookingWhoLabel,
  customerName,
  bookingTabTitle,
  formatRelativeTime,
  bookedCustomerName,
} from './bookings-data/names-and-times';
export { buildRrule, humanizeRrule, WEEKDAYS } from './bookings-data/recurrence';
export type { EndsMode, Frequency, RecurrenceDraft } from './bookings-data/recurrence';
export {
  bookingStateMeta,
  bookingTypeLabel,
  isTerminalBooking,
  seriesStateMeta,
  waitlistStateMeta,
} from './bookings-data/status-words';
export type { Tone } from './bookings-data/status-words';
export {
  useCreateBooking,
  useCancelBooking,
  useCheckInBooking,
  useCompleteBooking,
  useConfirmBooking,
  useNoShowBooking,
  useRescheduleBooking,
  useUpdateBooking,
  useCancelSeries,
  useCreateSeries,
  useAcceptWaitlist,
  useCreateWaitlistEntry,
  useOfferWaitlist,
  useRemoveWaitlist,
  useInvalidateBookings,
  useInvalidateWaitlist,
} from './bookings-data/writes';
export type {
  CreateBookingPayload,
  UpdateBookingPayload,
  CreateSeriesPayload,
  CreatedSeriesResult,
  CreateWaitlistPayload,
} from './bookings-data/writes';
export {
  useBookings,
  useSchedulingServices,
  useSchedulingResources,
  useCustomer,
  useBookingTimeline,
  useCustomerSearch,
  useBooking,
  useBookingSeries,
  useBookingSeriesList,
  useWaitlist,
} from './bookings-data/reads';
export { bookingKeys, seriesKeys, waitlistKeys, lookupKeys } from './bookings-data/keys';
export type { BookingOrder, BookingQuery, SeriesQuery, WaitlistQuery } from './bookings-data/keys';
export type {
  Booking,
  CustomerLite,
  ResourceLite,
  ServiceLite,
  BookingPayment,
  BookingStatus,
  BookingType,
  BookingSeriesDetail,
  BookingSeries,
  SeriesStatus,
  WaitlistEntry,
  WaitlistStatus,
  BookingResourceRow,
  BookingAttendeeRow,
  BookedCustomer,
  SeriesOccurrence,
  BookingTimelineEntry,
} from './bookings-data/shapes';
