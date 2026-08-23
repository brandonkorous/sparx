// sparx Scheduling engine (docs/79) — service-layer barrel.
//
// The availability/slot engine, the booking lifecycle with the DB-level
// no-overlap guarantee, and resource/service/availability setup. Consumed by the
// REST API, Server Actions, the public booking widget, the scheduling-worker, and
// the MCP tools — every transport validates against @wizeworks/scheduling-schemas
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
  type ResourceOverride,
  type SlotComputationInput,
  type ComputedSlot,
  resourceFreeIntervals,
  parseCustomHoursMeta,
  buildResourceOverrides,
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
  type BookingAuditAction,
  type BookingTimelineEntry,
  type CustomerBookingStats,
  recordBookingEvent,
  getBookingTimeline,
  getCustomerBookingStats,
} from './booking-history';
export { type BookingNotice, getBookingNotices } from './booking-notices';
export {
  type LocationRow,
  listLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
} from './locations';
export {
  type BookingPlace,
  formatAddressLine,
  findBookingPlace,
  findBookingPlaceTx,
  findServicePlaces,
  customerFacingPlace,
  findBookingHosts,
  joinNames,
} from './booking-receipt';
export {
  type BookableResource,
  createResource,
  updateResource,
  getResource,
  listResources,
  listResourcesPaged,
  listBookableResourcesForService,
  deleteResource,
  getResourcePropertyIds,
  getResourcePropertyIdsFor,
} from './resources';
export {
  createService,
  updateService,
  getService,
  listServices,
  listServicesPaged,
  deleteService,
} from './services';
export {
  createBookingPolicy,
  updateBookingPolicy,
  getBookingPolicy,
  listBookingPolicies,
  deleteBookingPolicy,
} from './policies';
export {
  type SkippedOccurrence,
  type MaterializeResult,
  type CreatedSeries,
  type MaterializeOptions,
  type BookingSeriesSummary,
  type BookingSeriesDetail,
  type CancelledSeries,
  SERIES_HORIZON_DAYS,
  createBookingSeries,
  materializeSeries,
  listBookingSeries,
  getBookingSeries,
  cancelBookingSeries,
} from './series';
export {
  type ClassSessionSummary,
  type ListClassSessionsOptions,
  type BookedSeat,
  type AttendeeUpdate,
  listClassSessions,
  bookClassSeat,
  listSessionAttendees,
  updateAttendee,
} from './classes';
export {
  type SchedulingReport,
  type SchedulingReportTotals,
  type SchedulingReportQuery,
  type TopService,
  getSchedulingReport,
} from './reports';
export { type SchedulingMcpScope, type SchedulingMcpCtx, schedulingMcpTools } from './mcp';
export {
  type ListWaitlistOptions,
  type WaitlistEntryDetail,
  type AcceptedWaitlist,
  joinWaitlist,
  listWaitlist,
  listWaitlistDetailed,
  leaveWaitlist,
  offerWaitlistEntry,
  acceptWaitlistOffer,
  expireWaitlistOffers,
} from './waitlist';
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
export {
  type BookingSmsFields,
  type WaitlistOfferSmsFields,
  renderBookingSms,
  renderWaitlistOfferSms,
} from './sms-templates';
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
  type CalendarOAuthProvider,
  type AuthorizeUrlParams,
  type TokenExchangeParams,
  type TokenRefreshParams,
  type OAuthTokens,
  GOOGLE_CALENDAR_SCOPES,
  MICROSOFT_CALENDAR_SCOPES,
  microsoftTenant,
  calendarScopes,
  calendarTokenUrl,
  buildCalendarAuthorizeUrl,
  buildTokenExchangeBody,
  buildTokenRefreshBody,
  parseTokenResponse,
  isAccessTokenExpired,
} from './calendar-oauth';
export {
  type BusyWindow,
  type OutboundBookingEvent,
  parseGoogleBusy,
  googleSyncTokenFrom,
  googleNextPageTokenFrom,
  googleItemsFrom,
  parseMicrosoftBusy,
  microsoftDeltaLinkFrom,
  microsoftNextLinkFrom,
  microsoftValueFrom,
  bookingICalUid,
  buildGoogleImportEvent,
} from './calendar-events';
export {
  type CalDavCalendar,
  extractElements,
  extractFirst,
  elementPresent,
  xmlUnescape,
  extractHref,
  parsePrincipalHref,
  parseCalendarHomeHref,
  parseCalendarCollections,
  parseCalendarData,
} from './caldav-xml';
export {
  type CreateConnectionData,
  type ConnectionSyncState,
  createCalendarConnection,
  listCalendarConnections,
  getCalendarConnection,
  deleteCalendarConnection,
  updateConnectionSyncState,
  replaceExternalBusyBlocks,
} from './calendar';
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
