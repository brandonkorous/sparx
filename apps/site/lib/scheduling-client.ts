// Browser-side scheduling client — slot lookup + booking submission against the
// public scheduling surface, via the same-origin /api/sparx proxy (no CORS, and
// the tenant slug is carried on the query string like the checkout client).

const API_BASE = '/api/sparx';

export interface PublicSlot {
  startAt: string;
  endAt: string;
  remaining: number;
}

export interface BookingConfirmation {
  id: string;
  status: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  requiresApproval: boolean;
}

export interface CreateBookingBody {
  serviceId: string;
  startAt: string;
  partySize?: number;
  customer: { name: string; email: string; phone?: string };
  notes?: string;
}

async function unwrap<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; error: { message: string } }
    | null;
  if (!res.ok || !body || body.success === false) {
    const message = body?.success === false ? body.error.message : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body.data;
}

export async function loadSlots(
  tenantSlug: string,
  serviceId: string,
  fromISO: string,
  toISO: string,
  partySize?: number
): Promise<PublicSlot[]> {
  const qs = new URLSearchParams({ tenant: tenantSlug, serviceId, from: fromISO, to: toISO });
  if (partySize) qs.set('partySize', String(partySize));
  const res = await fetch(`${API_BASE}/v1/public/scheduling/availability?${qs.toString()}`);
  return unwrap<PublicSlot[]>(res);
}

export async function createPublicBooking(
  tenantSlug: string,
  body: CreateBookingBody
): Promise<BookingConfirmation> {
  const qs = new URLSearchParams({ tenant: tenantSlug });
  const res = await fetch(`${API_BASE}/v1/public/scheduling/bookings?${qs.toString()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return unwrap<BookingConfirmation>(res);
}
