// Shared client/server types for the Scheduling dashboard. These mirror the
// api-rest view shapes (services/resources/availability/bookings routes) — the
// single contract the lists, forms, and detail panes read.

export type BookingType = 'appointment' | 'class' | 'reservation' | 'rental';
export type ResourceKind = 'staff' | 'asset' | 'table' | 'space' | 'equipment';
export type AssignmentStrategy = 'any_available' | 'round_robin' | 'customer_choice' | 'collective';
export type BookingStatus =
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'waitlisted';

export interface ResourceRequirement {
  role: string;
  kind: ResourceKind;
  skillTags?: string[];
  count?: number;
}

/** A resource's linked external calendar (docs/79 §8) — safe view, no secrets. */
export interface CalendarConnection {
  id: string;
  resourceId: string;
  provider: string;
  connectionKind: string;
  credentialSource: string;
  direction: string;
  fidelity: string;
  status: string;
  externalCalendarId: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface SchedulingService {
  id: string;
  bookingType: BookingType;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  priceCents: number;
  currency: string;
  capacity: number;
  assignmentStrategy: AssignmentStrategy;
  resourceRequirements: ResourceRequirement[];
  policyId: string | null;
  intakeFormId: string | null;
  locationId: string | null;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  slotIntervalMin: number;
  color: string | null;
  imageUrl: string | null;
  bookableOnline: boolean;
  requiresApproval: boolean;
  isActive: boolean;
  requiresAsset: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type DepositType = 'none' | 'card_hold' | 'deposit' | 'prepay';
export type FeeType = 'fixed' | 'percent';

export interface BookingPolicy {
  id: string;
  name: string;
  depositType: DepositType;
  depositAmountCents: number | null;
  depositPercent: number | null;
  cancellationWindowHours: number;
  lateCancelFeeType: FeeType | null;
  lateCancelFeeValue: number | null;
  noShowFeeType: FeeType | null;
  noShowFeeValue: number | null;
  policyText: string | null;
  reminderOffsetsMin: number[];
  createdAt: string;
  updatedAt: string;
}

export interface SchedulingResource {
  id: string;
  kind: ResourceKind;
  userId: string | null;
  locationId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  color: string | null;
  timezone: string;
  exclusive: boolean;
  capacity: number;
  capacityMin: number | null;
  capacityMax: number | null;
  skillTags: string[];
  bookableOnline: boolean;
  isActive: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityWindow {
  id: string;
  resourceId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  validFrom: string | null;
  validTo: string | null;
}

export interface AvailabilityException {
  id: string;
  resourceId: string | null;
  locationId: string | null;
  kind: 'closed' | 'custom_hours' | 'blackout' | 'special_price';
  startAt: string;
  endAt: string;
  reason: string | null;
  meta: Record<string, unknown>;
}

export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  candidatesByRole: Record<string, string[]>;
  remaining: number;
}

export interface BookingResourceView {
  id: string;
  role: string;
  status: string;
  startAt: string;
  endAt: string;
  resource: { id: string; name: string; kind: string; color: string | null };
}

export interface BookingAttendeeView {
  id: string;
  customerId: string | null;
  guestName: string | null;
  partySize: number;
  status: string;
  waitlistPosition: number | null;
}

export interface Booking {
  id: string;
  serviceId: string;
  bookingType: BookingType;
  seriesId: string | null;
  locationId: string | null;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  timezone: string;
  capacity: number;
  partySize: number | null;
  customerId: string | null;
  b2bAccountId: string | null;
  assetRef: Record<string, unknown> | null;
  partsLinked: unknown[];
  workOrderId: string | null;
  source: string;
  policyId: string | null;
  depositStatus: string | null;
  paymentIntentId: string | null;
  intakeSubmissionId: string | null;
  notes: string | null;
  staffNotes: string | null;
  confirmedAt: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  noShowAt: string | null;
  createdAt: string;
  updatedAt: string;
  service: {
    id: string;
    name: string;
    bookingType: BookingType;
    durationMinutes: number;
    priceCents: number;
    currency: string;
    color: string | null;
  };
  resources: BookingResourceView[];
  attendees: BookingAttendeeView[];
}

export interface CalendarEvent {
  id: string;
  serviceId: string;
  serviceName: string;
  bookingType: string;
  status: string;
  startAt: string;
  endAt: string;
  color: string | null;
  customerId: string | null;
  resourceIds: string[];
  resourceNames: string[];
  partySize: number | null;
}
