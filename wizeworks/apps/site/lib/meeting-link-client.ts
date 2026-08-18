// Browser-side booking-link client (docs/144 §12).
//
// Two calls, both through the same-origin `/api/sparx` proxy with the tenant on
// the query string, exactly like the signing and scheduling clients: resolve the
// link, and afterwards say that a booking came through it.
//
// There is no credential. A booking link is a public address a business puts in
// an email signature — that is the entire point of it — so the only thing it
// identifies is which link, and everything it can do is take a booking that the
// scheduling module would have taken anyway.

const API_BASE = '/api/sparx';

/** What `/meet/<slug>` needs to frame the booking. */
export interface PublicMeetingLink {
  id: string;
  name: string;
  description: string | null;
  serviceId: string;
  hostName: string;
  durationMinutes: number;
  timezone: string | null;
  /**
   * False for a link that has been retired, or whose service has been deleted.
   *
   * Deliberately not a 404: somebody is clicking this out of an email from six
   * months ago, and "no longer in use, reply and ask for a new one" is something
   * they can act on where a not-found page is not.
   */
  active: boolean;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

async function unwrap<T>(response: Response, fallback: string): Promise<T> {
  const body = (await response.json()) as Envelope<T>;
  if (!response.ok || body.success !== true || body.data === undefined) {
    throw new Error(body.error?.message ?? fallback);
  }
  return body.data;
}

export async function loadMeetingLink(
  tenantSlug: string,
  slug: string
): Promise<PublicMeetingLink> {
  const response = await fetch(
    `${API_BASE}/v1/public/meet/${encodeURIComponent(slug)}?tenant=${encodeURIComponent(tenantSlug)}`,
    { cache: 'no-store' }
  );
  return unwrap<PublicMeetingLink>(response, 'We could not find that booking link.');
}

/**
 * Tell the CRM the booking came through this link.
 *
 * Runs AFTER the booking exists, and its failure must never surface: the meeting
 * is booked either way, and a customer who has just been told "you're booked"
 * cannot act on "we could not attach that to a link" and should not be shown it.
 * The cost of a silent failure here is one missing timeline entry.
 */
export async function attachBooking(
  tenantSlug: string,
  slug: string,
  bookingId: string
): Promise<void> {
  try {
    await fetch(
      `${API_BASE}/v1/public/meet/${encodeURIComponent(slug)}/booked?tenant=${encodeURIComponent(tenantSlug)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      }
    );
  } catch {
    // Intentionally swallowed — see above.
  }
}
