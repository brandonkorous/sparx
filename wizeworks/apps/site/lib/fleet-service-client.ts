// Browser-side client for booking service on a trade account's vehicles and
// reading each vehicle's service history (sparx persona issue 086), against the
// portal endpoints in api-rest `routes/v1/public/b2b-portal-service.ts`.
//
// One read answers both the Service page and every vehicle card on the Fleet
// page. A fleet of twenty trucks would otherwise ask the same question twenty
// times, so concurrent reads for one account share a single request, and a
// booking clears it so the next read is fresh.

import type { BookingConfirmation } from './scheduling-client';

const API_BASE = '/api/sparx';

export interface FleetServiceType {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  requiresApproval: boolean;
  requiresAsset: boolean;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  /** The zone the business's times are in; null = the reader's own. */
  timezone: string | null;
}

export interface FleetServiceVehicle {
  id: string;
  label: string;
  vin: string | null;
}

export interface ServiceRecordPart {
  orderId: string | null;
  orderItemId: string | null;
  orderNumber: string | null;
  variantId: string | null;
  sku: string | null;
  title: string;
  quantity: number;
}

export interface ServiceRecordVehicle {
  vehicleId: string;
  label: string;
}

export interface ServiceRecord {
  id: string;
  serviceName: string;
  status: string;
  startAt: string;
  endAt: string;
  timezone: string;
  notes: string | null;
  vehicle: ServiceRecordVehicle | null;
  parts: ServiceRecordPart[];
}

/** What the portal knows about service for one account. `enabled: false` means
 *  the business does not take bookings, and the portal offers none. */
export type AccountService =
  | { enabled: false }
  | {
      enabled: true;
      canBook: boolean;
      services: FleetServiceType[];
      vehicles: FleetServiceVehicle[];
      records: ServiceRecord[];
      /** Linked orders the reader placed themselves: those open on their order page. */
      myOrderIds: string[];
    };

export interface ServiceBookingConfirmation extends BookingConfirmation {
  vehicle: string;
  timezone: string;
}

const OUR_FAULT = 'Something went wrong at our end. Please try again in a moment.';

async function unwrap<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; error: { code?: string; message: string } }
    | null;
  if (!res.ok || !body || body.success === false) {
    const failure = body?.success === false ? body.error : null;
    throw new Error(failure && failure.code !== 'VALIDATION_ERROR' ? failure.message : OUR_FAULT);
  }
  return body.data;
}

function serviceUrl(path: string, tenantSlug: string, propertySlug?: string): string {
  const qs = new URLSearchParams({ tenant: tenantSlug });
  if (propertySlug) qs.set('property', propertySlug);
  return `${API_BASE}/v1/public/b2b/portal${path}?${qs.toString()}`;
}

const inFlight = new Map<string, Promise<AccountService>>();

/** The account's service picture. Concurrent callers share one request. */
export function loadAccountService(
  tenantSlug: string,
  accountId: string,
  propertySlug?: string
): Promise<AccountService> {
  const key = `${tenantSlug}:${propertySlug ?? ''}:${accountId}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const request = fetch(
    serviceUrl(`/${encodeURIComponent(accountId)}/service`, tenantSlug, propertySlug),
    { cache: 'no-store' }
  )
    .then((res) => unwrap<AccountService>(res))
    .finally(() => {
      // Shared only while it is on its way: the next visit to the page asks again.
      inFlight.delete(key);
    });
  inFlight.set(key, request);
  return request;
}

export interface BookServiceBody {
  vehicleId: string;
  serviceId: string;
  startAt: string;
  notes?: string;
}

export async function bookAccountService(
  tenantSlug: string,
  accountId: string,
  body: BookServiceBody,
  propertySlug?: string
): Promise<ServiceBookingConfirmation> {
  const res = await fetch(
    serviceUrl(`/${encodeURIComponent(accountId)}/service/bookings`, tenantSlug, propertySlug),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  return unwrap<ServiceBookingConfirmation>(res);
}
