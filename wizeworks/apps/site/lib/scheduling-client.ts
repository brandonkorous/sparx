// Browser-side scheduling client — slot lookup + booking submission against the
// public scheduling surface, via the same-origin /api/sparx proxy (no CORS, and
// the tenant slug is carried on the query string like the checkout client).

const API_BASE = '/api/sparx';

export interface PublicSlot {
  startAt: string;
  endAt: string;
  remaining: number;
}

export type DepositType = 'card_hold' | 'deposit' | 'prepay';

/** "Add to calendar" links for a booking (docs/79 §8.1): the per-booking `.ics`
 *  download plus Google/Outlook web deep links. */
export interface CalendarLinks {
  ics: string;
  google: string;
  outlook: string;
}

export interface BookingConfirmation {
  id: string;
  status: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  requiresApproval: boolean;
  /** The place, on one line — null when the business has no address on file, so
   *  the confirmation says nothing rather than naming a place that locates
   *  nobody. */
  location?: string | null;
  /** Who the appointment is with. Null for a table, a room or a piece of kit. */
  staff?: string | null;
  /** Present when the service's policy requires payment at booking (docs/79 §9):
   *  a clientSecret to confirm with the gateway's card element. Null otherwise. */
  deposit?: {
    clientSecret: string;
    /** Present when the tenant runs its own Stripe account (`stripe_direct`) — the
     *  intent is on THEIR account, so the browser must load Stripe.js with THEIR key. */
    publishableKey?: string;
    amountCents: number;
    type: DepositType;
  } | null;
  calendar?: CalendarLinks | null;
  /** Site-relative address of the CHANGE-OR-CANCEL page for this booking — a
   *  signed link that needs no account (issue 153). The confirmation offers it
   *  beside the calendar links, so the way back exists while she is still
   *  looking at what she just booked. */
  manageUrl?: string | null;
}

export interface CreateBookingBody {
  serviceId: string;
  startAt: string;
  partySize?: number;
  customer: { name: string; email: string; phone?: string };
  notes?: string;
  /** The customer's chosen resource for a "customer_choice" service. */
  resourceId?: string;
}

/** A resource a customer can pick for a "customer_choice" service (docs/79 §7.5). */
export interface BookableResource {
  id: string;
  name: string;
  kind: string;
  description: string | null;
  color: string | null;
  imageUrl: string | null;
}

/** The specific resources offered for a service (empty unless it's customer_choice). */
export async function loadServiceResources(
  tenantSlug: string,
  serviceId: string
): Promise<BookableResource[]> {
  const qs = new URLSearchParams({ tenant: tenantSlug });
  const res = await fetch(
    `${API_BASE}/v1/public/scheduling/services/${serviceId}/resources?${qs.toString()}`
  );
  return unwrap<BookableResource[]>(res);
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
  partySize?: number,
  resourceId?: string
): Promise<PublicSlot[]> {
  const qs = new URLSearchParams({ tenant: tenantSlug, serviceId, from: fromISO, to: toISO });
  if (partySize) qs.set('partySize', String(partySize));
  if (resourceId) qs.set('resourceId', resourceId);
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

export interface PublicSession {
  bookingId: string;
  serviceName: string | null;
  startAt: string;
  endAt: string;
  remaining: number;
}

/** Upcoming class sessions with open seats (docs/79 §7.2). */
export async function listSessions(
  tenantSlug: string,
  serviceId: string,
  fromISO: string,
  toISO: string
): Promise<PublicSession[]> {
  const qs = new URLSearchParams({ tenant: tenantSlug, serviceId, from: fromISO, to: toISO });
  const res = await fetch(`${API_BASE}/v1/public/scheduling/sessions?${qs.toString()}`);
  return unwrap<PublicSession[]>(res);
}

export interface JoinSessionResult {
  attendeeId: string;
  status: string;
  waitlisted: boolean;
}

/** Join a class session (find-or-creates the customer). A full session enrolls the
 *  customer as waitlisted. */
export async function joinSession(
  tenantSlug: string,
  bookingId: string,
  body: { customer: { name: string; email: string; phone?: string }; partySize?: number }
): Promise<JoinSessionResult> {
  const qs = new URLSearchParams({ tenant: tenantSlug });
  const res = await fetch(
    `${API_BASE}/v1/public/scheduling/sessions/${bookingId}/join?${qs.toString()}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  return unwrap<JoinSessionResult>(res);
}

export interface JoinWaitlistBody {
  serviceId: string;
  customer: { name: string; email: string; phone?: string };
  desiredFrom: string;
  desiredTo: string;
}

/** Join the service waitlist when nothing's open in the desired window (docs/79
 *  §7). The customer is emailed/texted when a spot opens. */
export async function joinWaitlist(
  tenantSlug: string,
  body: JoinWaitlistBody
): Promise<{ id: string; status: string }> {
  const qs = new URLSearchParams({ tenant: tenantSlug });
  const res = await fetch(`${API_BASE}/v1/public/scheduling/waitlist?${qs.toString()}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return unwrap<{ id: string; status: string }>(res);
}

// ── Managing one booking from a signed link (issue 153) ──────────────────────
//
// No session and no tenant slug: the token in the link names the booking AND the
// business it belongs to, which is the whole point — the person reading it
// booked as a guest and has no account to sign in to.

/** One booking as its own customer may see it. Matches the account portal's
 *  projection exactly, because both come from the same server-side view. */
export interface ManagedBooking {
  id: string;
  serviceId: string;
  serviceName: string;
  status: string;
  startAt: string;
  endAt: string;
  timezone: string;
  durationMinutes: number;
  partySize: number | null;
  staff: string[];
  notes: string | null;
  cancellationReason: string | null;
  canCancel: boolean;
  canReschedule: boolean;
  calendar: CalendarLinks | null;
  where: string | null;
}

function manageEndpoint(token: string, action?: string): string {
  const suffix = action ? `/${action}` : '';
  return `${API_BASE}/v1/public/scheduling/manage${suffix}?t=${encodeURIComponent(token)}`;
}

export async function loadManagedBooking(token: string): Promise<ManagedBooking> {
  return unwrap<ManagedBooking>(await fetch(manageEndpoint(token), { cache: 'no-store' }));
}

export async function rescheduleManagedBooking(
  token: string,
  startAt: string
): Promise<ManagedBooking> {
  const res = await fetch(manageEndpoint(token, 'reschedule'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ startAt }),
  });
  return unwrap<ManagedBooking>(res);
}

export async function cancelManagedBooking(
  token: string,
  reason?: string
): Promise<ManagedBooking> {
  const res = await fetch(manageEndpoint(token, 'cancel'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(reason ? { reason } : {}),
  });
  return unwrap<ManagedBooking>(res);
}
