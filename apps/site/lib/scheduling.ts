// Storefront scheduling reads (docs/79 §13). Thin server-side client over
// api-rest's `/v1/public/scheduling/*` surface, mirroring lib/commerce.ts in
// shape. Tenant is resolved from the request host (resolveSiteRoute); a tenant
// without the scheduling module active returns null/[] so the /book route 404s.

import { resolveActivePropertySlug, resolveSiteRoute } from './site-context';

const BASE_URL = process.env.SPARX_API_REST_URL ?? 'http://localhost:3100';

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  bookingType: 'appointment' | 'class' | 'reservation' | 'rental';
  durationMinutes: number;
  priceCents: number;
  currency: string;
  capacity: number;
  color: string | null;
  imageUrl: string | null;
  requiresApproval: boolean;
  slotIntervalMin: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  /** When 'customer_choice', the widget shows a "pick your {providerLabel}" step. */
  assignmentStrategy: 'any_available' | 'round_robin' | 'collective' | 'customer_choice';
  /** The word for the bookable person ("stylist", "technician", "team member"). */
  providerLabel: string;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
}

/** What `/meet/<slug>` needs to frame a booking (docs/144 §12). */
export interface PublicMeetingLink {
  id: string;
  name: string;
  description: string | null;
  serviceId: string;
  hostName: string;
  durationMinutes: number;
  timezone: string | null;
  /** False once retired, or once the service behind it is gone. */
  active: boolean;
}

async function publicGet<T>(path: string, init?: RequestInit): Promise<T | null> {
  const route = await resolveSiteRoute();
  if (!route) return null;
  // Scope every public scheduling read to the ACTIVE site, exactly as lib/commerce.ts
  // does — the endpoint resolves `?property=` and otherwise falls back to the tenant's
  // PRIMARY site. Without this a non-primary site (e.g. a Template/second business) shows
  // the primary site's services instead of its own, so a site whose services live only on
  // itself renders "no services bookable" even though it has them. Null for the primary
  // site keeps single-site storefronts unchanged.
  const propertySlug = await resolveActivePropertySlug();
  const params = new URLSearchParams({ tenant: route.tenantSlug });
  if (propertySlug) params.set('property', propertySlug);
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE_URL}${path}${sep}${params.toString()}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 60, tags: ['sparx-scheduling', `scheduling:${route.tenantSlug}`] },
      ...init,
    });
    const json = (await res.json()) as Envelope<T>;
    if (!res.ok || !json.success || json.data === undefined) return null;
    return json.data;
  } catch {
    return null;
  }
}

/** Bookable services for the active tenant (empty when scheduling is off). */
export async function listBookableServices(): Promise<PublicService[]> {
  return (await publicGet<PublicService[]>('/v1/public/scheduling/services')) ?? [];
}

/**
 * A booking link by its public slug (docs/144 §12), or null if no such link.
 *
 * Returns retired links too, with `active: false`. The link is in email
 * signatures and old quotes that cannot be recalled, so the page has to be able
 * to say "no longer in use" — which is something the reader can act on, unlike a
 * not-found page.
 *
 * NOT revalidated. A link resolves once per visit because the answer includes
 * whether it is still taking bookings, and a cached "yes" outlives the moment
 * somebody retired it.
 */
export async function getMeetingLink(slug: string): Promise<PublicMeetingLink | null> {
  return publicGet<PublicMeetingLink>(`/v1/public/meet/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  });
}

/** A single bookable service by id, or null if it isn't bookable online. */
export async function getBookableService(id: string): Promise<PublicService | null> {
  const services = await listBookableServices();
  return services.find((s) => s.id === id) ?? null;
}

/** The active tenant slug — passed to the booking widget for its browser calls. */
export async function activeTenantSlug(): Promise<string | null> {
  return (await resolveSiteRoute())?.tenantSlug ?? null;
}
