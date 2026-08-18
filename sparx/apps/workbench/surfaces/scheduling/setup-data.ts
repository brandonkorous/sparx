'use client';

// ══════════════════════════════════════════════════════════════════════════
// SCHEDULING SETUP DATA LAYER
//
// The four "Setup" surfaces of the Scheduling module read and write through this
// one file: Services (what people can book you for), People & equipment (what a
// booking uses up), Availability (the hours you can be booked, and the days you
// cannot), and Booking rules (notice, cancellation, deposit). No surface
// declares a query key, a fetch, or a row type of its own — they all come from
// here, so a service renamed on the detail pane reads by its new name in the
// picker on the availability pane docked beside it.
//
//   Services
//     GET    /v1/scheduling/services            list (q / type / active, paged)
//     POST   /v1/scheduling/services            create
//     GET    /v1/scheduling/services/:id        one
//     PATCH  /v1/scheduling/services/:id        edit
//     DELETE /v1/scheduling/services/:id        soft-delete (admin)
//
//   Resources
//     GET    /v1/scheduling/resources           list (kind / active)
//     POST   /v1/scheduling/resources           create
//     GET    /v1/scheduling/resources/:id       one
//     PATCH  /v1/scheduling/resources/:id       edit
//     DELETE /v1/scheduling/resources/:id       soft-delete (admin)
//
//   Availability
//     GET    /v1/scheduling/resources/:id/availability   weekly windows
//     PUT    /v1/scheduling/resources/:id/availability   replace the week
//     GET    /v1/scheduling/exceptions                   closures / time off
//     POST   /v1/scheduling/exceptions                   add one
//     DELETE /v1/scheduling/exceptions/:id               remove one
//
//   Booking rules
//     GET    /v1/scheduling/policies            list (q, paged)
//     POST   /v1/scheduling/policies            create
//     GET    /v1/scheduling/policies/:id        one
//     PATCH  /v1/scheduling/policies/:id        edit
//     DELETE /v1/scheduling/policies/:id        delete (admin)
// ══════════════════════════════════════════════════════════════════════════

import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { ApiError } from '@wizeworks/api-client';
import { api } from '../../lib/api/client';

/* ── Shared ─────────────────────────────────────────────────────────────── */

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface StateLabel {
  label: string;
  tone: Tone;
}

/**
 * The server's own sentence for a 4xx, shown verbatim — these routes name the
 * exact problem far better than anything this side could infer from a status
 * code. A 5xx carries no such sentence, so it falls back to the caller's wording.
 */
export function schedulingErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return error.message;
  }
  return fallback;
}

/** True when the thing behind an edit pane no longer exists. */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** Money, from integer cents. The service layer stores a lowercase ISO currency
 *  (`usd`); Intl wants it upper-cased. */
export function formatMoney(cents: number, currency: string): string {
  const code = (currency || 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(
      cents / 100
    );
  } catch {
    // An unknown currency code shouldn't blank the whole cell.
    return `${(cents / 100).toFixed(2)} ${code}`;
  }
}

/** A run of minutes as "1 hr 30 min", the way a person reads a duration. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0 min';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${String(hours)} hr`);
  if (mins > 0) parts.push(`${String(mins)} min`);
  return parts.join(' ');
}

/* ══════════════════════════════════════════════════════════════════════════
   SERVICES
   ══════════════════════════════════════════════════════════════════════════ */

export type BookingType = 'appointment' | 'class' | 'reservation' | 'rental';
export type AssignmentStrategy = 'any_available' | 'round_robin' | 'collective' | 'customer_choice';
export type ResourceKind = 'staff' | 'asset' | 'table' | 'space' | 'equipment';

/** One required-resource role on a service (stored in resource_requirements). */
export interface ResourceRequirement {
  role: string;
  kind: ResourceKind;
  skillTags: string[];
  count: number;
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

export interface ServicesQuery {
  q?: string;
  bookingType?: BookingType;
  activeOnly: boolean;
  take: number;
  skip: number;
}

export const serviceKeys = {
  all: ['scheduling', 'services'] as const,
  list: (query: ServicesQuery) => [...serviceKeys.all, 'list', query] as const,
  one: (id: string) => [...serviceKeys.all, 'one', id] as const,
};

export function useServices(query: ServicesQuery) {
  return useQuery({
    queryKey: serviceKeys.list(query),
    queryFn: () =>
      api.list<SchedulingService>('/v1/scheduling/services', {
        ...(query.q ? { q: query.q } : {}),
        ...(query.bookingType ? { bookingType: query.bookingType } : {}),
        ...(query.activeOnly ? { activeOnly: true } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function useService(id: string) {
  return useQuery({
    queryKey: serviceKeys.one(id),
    queryFn: () => api.get<SchedulingService>(`/v1/scheduling/services/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

/** The fields a create/edit sends. Everything optional so a PATCH carries only
 *  what moved; create fills in the required ones itself. */
export interface ServiceInput {
  name?: string;
  description?: string | null;
  bookingType?: BookingType;
  durationMinutes?: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  priceCents?: number;
  currency?: string;
  capacity?: number;
  assignmentStrategy?: AssignmentStrategy;
  resourceRequirements?: ResourceRequirement[];
  policyId?: string | null;
  minLeadMinutes?: number;
  maxAdvanceDays?: number;
  slotIntervalMin?: number;
  bookableOnline?: boolean;
  requiresApproval?: boolean;
  requiresAsset?: boolean;
  isActive?: boolean;
}

function useInvalidateServices() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: serviceKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: serviceKeys.one(id) });
  };
}

export function useCreateService() {
  const invalidate = useInvalidateServices();
  return useMutation({
    mutationFn: (input: ServiceInput) =>
      api.post<SchedulingService>('/v1/scheduling/services', input),
    onSuccess: (row) => {
      invalidate(row.id);
    },
  });
}

export function useUpdateService(id: string) {
  const invalidate = useInvalidateServices();
  return useMutation({
    mutationFn: (input: ServiceInput) =>
      api.patch<SchedulingService>(`/v1/scheduling/services/${id}`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteService(id: string) {
  const invalidate = useInvalidateServices();
  return useMutation({
    mutationFn: () => api.delete(`/v1/scheduling/services/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** The booking kinds, in the order they are offered — stored value plus the
 *  words a business owner uses for it. */
export const BOOKING_TYPES: { value: BookingType; label: string; hint: string }[] = [
  {
    value: 'appointment',
    label: 'Appointment',
    hint: 'A one-to-one slot — a haircut, a consultation, a repair.',
  },
  {
    value: 'class',
    label: 'Class or group session',
    hint: 'Several people book the same session — a yoga class, a workshop.',
  },
  {
    value: 'reservation',
    label: 'Reservation',
    hint: 'A table or space held for a party — a restaurant booking.',
  },
  {
    value: 'rental',
    label: 'Rental or hire',
    hint: 'Something hired out for a stretch of time — a bike, a kayak, a room.',
  },
];

const BOOKING_TYPE_LABEL = new Map<string, string>(BOOKING_TYPES.map((t) => [t.value, t.label]));

export function bookingTypeLabel(value: string): string {
  return BOOKING_TYPE_LABEL.get(value) ?? 'Booking';
}

export const ASSIGNMENT_STRATEGIES: {
  value: AssignmentStrategy;
  label: string;
  hint: string;
}[] = [
  {
    value: 'any_available',
    label: 'Whoever is free',
    hint: 'The first suitable person or thing that is free takes the booking.',
  },
  {
    value: 'round_robin',
    label: 'Share the work evenly',
    hint: 'Bookings are spread across your team so no one is favoured.',
  },
  {
    value: 'collective',
    label: 'Everyone at once',
    hint: 'The booking needs every listed role free at the same time.',
  },
  {
    value: 'customer_choice',
    label: 'Let the customer choose',
    hint: 'The customer picks who they want when they book.',
  },
];

/** What a service looks like at a glance: whether it takes bookings, and where. */
export function serviceState(
  service: Pick<SchedulingService, 'isActive' | 'bookableOnline'>
): StateLabel {
  if (!service.isActive) return { label: 'Off', tone: 'neutral' };
  if (!service.bookableOnline) return { label: 'Staff only', tone: 'warning' };
  return { label: 'Bookable', tone: 'success' };
}

/* ══════════════════════════════════════════════════════════════════════════
   RESOURCES — people & equipment
   ══════════════════════════════════════════════════════════════════════════ */

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
  /** The sites this person or place works for. EMPTY = all of them, which is both
   *  the default and what every single-site business reads. */
  propertyIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ResourcesQuery {
  kind?: ResourceKind;
  activeOnly: boolean;
}

export const resourceKeys = {
  all: ['scheduling', 'resources'] as const,
  list: (query: ResourcesQuery) => [...resourceKeys.all, 'list', query] as const,
  one: (id: string) => [...resourceKeys.all, 'one', id] as const,
};

export function useResources(query: ResourcesQuery) {
  return useQuery({
    queryKey: resourceKeys.list(query),
    queryFn: () =>
      api.list<SchedulingResource>('/v1/scheduling/resources', {
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.activeOnly ? { activeOnly: true } : {}),
      }),
    placeholderData: (previous) => previous,
  });
}

export function useResource(id: string) {
  return useQuery({
    queryKey: resourceKeys.one(id),
    queryFn: () => api.get<SchedulingResource>(`/v1/scheduling/resources/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

export interface ResourceInput {
  name?: string;
  kind?: ResourceKind;
  description?: string | null;
  color?: string | null;
  timezone?: string;
  exclusive?: boolean;
  capacity?: number;
  capacityMin?: number | null;
  capacityMax?: number | null;
  skillTags?: string[];
  bookableOnline?: boolean;
  isActive?: boolean;
  /** Full replacement set. Empty = every site; omitted on an update = leave it alone. */
  propertyIds?: string[];
}

function useInvalidateResources() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: resourceKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: resourceKeys.one(id) });
  };
}

export function useCreateResource() {
  const invalidate = useInvalidateResources();
  return useMutation({
    mutationFn: (input: ResourceInput) =>
      api.post<SchedulingResource>('/v1/scheduling/resources', input),
    onSuccess: (row) => {
      invalidate(row.id);
    },
  });
}

export function useUpdateResource(id: string) {
  const invalidate = useInvalidateResources();
  return useMutation({
    mutationFn: (input: ResourceInput) =>
      api.patch<SchedulingResource>(`/v1/scheduling/resources/${id}`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteResource(id: string) {
  const invalidate = useInvalidateResources();
  return useMutation({
    mutationFn: () => api.delete(`/v1/scheduling/resources/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   LOCATIONS — the physical places served from
   ══════════════════════════════════════════════════════════════════════════ */

export interface LocationAddress {
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

export interface BusinessLocation {
  id: string;
  name: string;
  address: LocationAddress;
  timezone: string;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  /** The sites served from here. EMPTY = all of them. */
  propertyIds: string[];
  /** What is filed here — so the UI can say what switching it off affects, and
   *  explain a refused delete before the owner tries it. */
  counts: { resources: number; services: number; bookings: number };
  createdAt: string;
  updatedAt: string;
}

export interface LocationInput {
  name?: string;
  address?: LocationAddress;
  timezone?: string;
  lat?: number | null;
  lng?: number | null;
  isActive?: boolean;
  /** Full replacement set. Empty = every site; omitted on an update = untouched. */
  propertyIds?: string[];
}

export const locationKeys = {
  all: ['scheduling', 'locations'] as const,
  list: (activeOnly: boolean) => [...locationKeys.all, 'list', activeOnly] as const,
  one: (id: string) => [...locationKeys.all, 'one', id] as const,
};

export function useLocations(activeOnly = false) {
  return useQuery({
    queryKey: locationKeys.list(activeOnly),
    // `api.list` normalizes the bare array the endpoint returns into `{items}`,
    // the same shape every other list hook here reads.
    queryFn: () =>
      api.list<BusinessLocation>(
        '/v1/scheduling/locations',
        activeOnly ? { activeOnly: true } : {}
      ),
    placeholderData: (previous) => previous,
  });
}

export function useLocation(id: string) {
  return useQuery({
    queryKey: locationKeys.one(id),
    queryFn: () => api.get<BusinessLocation>(`/v1/scheduling/locations/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

function useInvalidateLocations() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: locationKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: locationKeys.one(id) });
    // A resource or service names its location, so their lists go stale too.
    void queryClient.invalidateQueries({ queryKey: resourceKeys.all });
  };
}

export function useCreateLocation() {
  const invalidate = useInvalidateLocations();
  return useMutation({
    mutationFn: (input: LocationInput) =>
      api.post<BusinessLocation>('/v1/scheduling/locations', input),
    onSuccess: (row) => {
      invalidate(row.id);
    },
  });
}

export function useUpdateLocation(id: string) {
  const invalidate = useInvalidateLocations();
  return useMutation({
    mutationFn: (input: LocationInput) =>
      api.patch<BusinessLocation>(`/v1/scheduling/locations/${id}`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeleteLocation(id: string) {
  const invalidate = useInvalidateLocations();
  return useMutation({
    mutationFn: () => api.delete(`/v1/scheduling/locations/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

/** One line of address, in reading order, for a list row. */
export function formatAddress(address: LocationAddress): string {
  return [address.line1, address.line2, address.city, address.region, address.postalCode]
    .filter((part) => part && part.trim() !== '')
    .join(', ');
}

/** A short, familiar set of zones — the same list the resource form offers, so a
 *  place and the people working it are described the same way. */
export const TIMEZONE_OPTIONS = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const;

export const RESOURCE_KINDS: { value: ResourceKind; label: string; hint: string }[] = [
  {
    value: 'staff',
    label: 'A person',
    hint: 'A member of your team who carries out bookings.',
  },
  {
    value: 'space',
    label: 'A room or space',
    hint: 'A treatment room, a studio, a meeting room.',
  },
  {
    value: 'table',
    label: 'A table',
    hint: 'A table a party is seated at — with a size it can hold.',
  },
  {
    value: 'equipment',
    label: 'A machine or tool',
    hint: 'A piece of equipment a booking needs — a chair, a bay, a machine.',
  },
  {
    value: 'asset',
    label: 'Something you hire out',
    hint: 'A vehicle or item that is booked out for a time — a bike, a kayak.',
  },
];

const RESOURCE_KIND_LABEL = new Map<string, string>(RESOURCE_KINDS.map((k) => [k.value, k.label]));

export function resourceKindLabel(value: string): string {
  return RESOURCE_KIND_LABEL.get(value) ?? 'Resource';
}

export function resourceState(resource: Pick<SchedulingResource, 'isActive'>): StateLabel {
  return resource.isActive
    ? { label: 'In use', tone: 'success' }
    : { label: 'Off', tone: 'neutral' };
}

/* ══════════════════════════════════════════════════════════════════════════
   AVAILABILITY — weekly hours per resource, plus closures / time off
   ══════════════════════════════════════════════════════════════════════════ */

export interface AvailabilityWindow {
  id: string;
  resourceId: string;
  /** 0 = Sunday .. 6 = Saturday. */
  dayOfWeek: number;
  /** Minutes from local midnight. */
  startMinute: number;
  endMinute: number;
  validFrom: string | null;
  validTo: string | null;
}

/** What a PUT sends for one day-window (no id — the whole week is replaced). */
export interface AvailabilityWindowInput {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
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

export const availabilityKeys = {
  windows: (resourceId: string) => ['scheduling', 'availability', 'windows', resourceId] as const,
  exceptions: (resourceId: string | null) =>
    ['scheduling', 'availability', 'exceptions', resourceId ?? 'all'] as const,
};

export function useResourceWindows(resourceId: string | null) {
  return useQuery({
    queryKey: availabilityKeys.windows(resourceId ?? 'none'),
    queryFn: () =>
      api.get<AvailabilityWindow[]>(`/v1/scheduling/resources/${resourceId ?? ''}/availability`),
    enabled: Boolean(resourceId),
  });
}

export function useSetResourceWindows(resourceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (windows: AvailabilityWindowInput[]) =>
      api.put<AvailabilityWindow[]>(`/v1/scheduling/resources/${resourceId}/availability`, {
        windows,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: availabilityKeys.windows(resourceId) });
    },
  });
}

/** Closures & time off. Passing a resource narrows to that resource's own
 *  exceptions; the exceptions endpoint returns business-wide ones (null
 *  resource) unfiltered, so the surface reads all and groups them itself. */
export function useExceptions() {
  return useQuery({
    queryKey: availabilityKeys.exceptions(null),
    queryFn: () => api.get<AvailabilityException[]>('/v1/scheduling/exceptions'),
  });
}

export interface ExceptionInput {
  resourceId?: string | null;
  /** `closed` = shut all day; `custom_hours` = open, but with special hours (the
   *  hours ride in `meta` as minutes-from-midnight). */
  kind: 'closed' | 'custom_hours';
  startAt: string;
  endAt: string;
  reason?: string | null;
  /** For `custom_hours`: the special open/close, local minutes from midnight. */
  meta?: { startMinute: number; endMinute: number };
}

/** Read the special open/close out of a `custom_hours` exception's meta, or null
 *  when it is not a well-formed custom-hours override. */
export function customHoursOf(
  exception: AvailabilityException
): { startMinute: number; endMinute: number } | null {
  if (exception.kind !== 'custom_hours') return null;
  const start = exception.meta.startMinute;
  const end = exception.meta.endMinute;
  if (typeof start !== 'number' || typeof end !== 'number' || end <= start) return null;
  return { startMinute: start, endMinute: end };
}

/** Minutes-from-midnight → a friendly 12-hour clock ("9:00 AM"), for display. */
export function minutesToClock(minutes: number): string {
  const clamped = Math.max(0, Math.min(1440, minutes));
  const h24 = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12)}:${String(m).padStart(2, '0')} ${period}`;
}

export function useCreateException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExceptionInput) =>
      api.post<AvailabilityException>('/v1/scheduling/exceptions', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: availabilityKeys.exceptions(null) });
    },
  });
}

export function useDeleteException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/v1/scheduling/exceptions/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: availabilityKeys.exceptions(null) });
    },
  });
}

/** The days of the week, ordered Monday-first the way a rota is usually read.
 *  `value` is the stored 0=Sun..6=Sat index. */
export const WEEK_DAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
];

/** Minutes-from-midnight → "HH:MM" for a native time input. */
export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(1440, minutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "HH:MM" → minutes-from-midnight, or null when the string is not a time. */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59) return null;
  return h * 60 + m;
}

/* ══════════════════════════════════════════════════════════════════════════
   BOOKING RULES — deposit / cancellation / no-show policies
   ══════════════════════════════════════════════════════════════════════════ */

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

export interface PoliciesQuery {
  q?: string;
  take: number;
  skip: number;
}

export const policyKeys = {
  all: ['scheduling', 'policies'] as const,
  list: (query: PoliciesQuery) => [...policyKeys.all, 'list', query] as const,
  one: (id: string) => [...policyKeys.all, 'one', id] as const,
};

export function usePolicies(query: PoliciesQuery) {
  return useQuery({
    queryKey: policyKeys.list(query),
    queryFn: () =>
      api.list<BookingPolicy>('/v1/scheduling/policies', {
        ...(query.q ? { q: query.q } : {}),
        take: query.take,
        skip: query.skip,
      }),
    placeholderData: (previous) => previous,
  });
}

export function usePolicy(id: string) {
  return useQuery({
    queryKey: policyKeys.one(id),
    queryFn: () => api.get<BookingPolicy>(`/v1/scheduling/policies/${id}`),
    enabled: id !== 'new',
    retry: (failureCount, error) =>
      error instanceof ApiError && error.status === 404 ? false : failureCount < 2,
  });
}

export interface PolicyInput {
  name?: string;
  depositType?: DepositType;
  depositAmountCents?: number | null;
  depositPercent?: number | null;
  cancellationWindowHours?: number;
  lateCancelFeeType?: FeeType | null;
  lateCancelFeeValue?: number | null;
  noShowFeeType?: FeeType | null;
  noShowFeeValue?: number | null;
  policyText?: string | null;
  reminderOffsetsMin?: number[];
}

function useInvalidatePolicies() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: policyKeys.all });
    if (id) void queryClient.invalidateQueries({ queryKey: policyKeys.one(id) });
  };
}

export function useCreatePolicy() {
  const invalidate = useInvalidatePolicies();
  return useMutation({
    mutationFn: (input: PolicyInput) => api.post<BookingPolicy>('/v1/scheduling/policies', input),
    onSuccess: (row) => {
      invalidate(row.id);
    },
  });
}

export function useUpdatePolicy(id: string) {
  const invalidate = useInvalidatePolicies();
  return useMutation({
    mutationFn: (input: PolicyInput) =>
      api.patch<BookingPolicy>(`/v1/scheduling/policies/${id}`, input),
    onSuccess: () => {
      invalidate(id);
    },
  });
}

export function useDeletePolicy(id: string) {
  const invalidate = useInvalidatePolicies();
  return useMutation({
    mutationFn: () => api.delete(`/v1/scheduling/policies/${id}`),
    onSuccess: () => {
      invalidate();
    },
  });
}

export const DEPOSIT_TYPES: { value: DepositType; label: string; hint: string }[] = [
  {
    value: 'none',
    label: 'No deposit',
    hint: 'Customers book without paying anything up front.',
  },
  {
    value: 'card_hold',
    label: 'Hold a card on file',
    hint: 'No money is taken unless they miss the booking or cancel late.',
  },
  {
    value: 'deposit',
    label: 'Take a deposit',
    hint: 'Part of the price is paid when they book, the rest on the day.',
  },
  {
    value: 'prepay',
    label: 'Pay in full up front',
    hint: 'The whole price is charged at the time of booking.',
  },
];

/** The reminder times offered as tick-boxes — minutes before the booking. */
export const REMINDER_OFFSETS: { minutes: number; label: string }[] = [
  { minutes: 10080, label: '1 week before' },
  { minutes: 2880, label: '2 days before' },
  { minutes: 1440, label: '1 day before' },
  { minutes: 120, label: '2 hours before' },
  { minutes: 60, label: '1 hour before' },
];

/** A plain-language summary of what a policy asks of a customer, for the list. */
export function policySummary(policy: BookingPolicy): string {
  const parts: string[] = [];
  const deposit = DEPOSIT_TYPES.find((d) => d.value === policy.depositType);
  parts.push(deposit ? deposit.label : 'No deposit');
  parts.push(
    policy.cancellationWindowHours > 0
      ? `${String(policy.cancellationWindowHours)}h cancellation notice`
      : 'Cancel any time'
  );
  return parts.join(' · ');
}
