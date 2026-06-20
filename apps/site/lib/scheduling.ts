// Storefront scheduling reads (docs/79 §13). Thin server-side client over
// api-rest's `/v1/public/scheduling/*` surface, mirroring lib/commerce.ts in
// shape. Tenant is resolved from the request host (resolveSiteRoute); a tenant
// without the scheduling module active returns null/[] so the /book route 404s.

import { resolveSiteRoute } from './site-context';

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
}

interface Envelope<T> {
  success: boolean;
  data?: T;
}

async function publicGet<T>(path: string): Promise<T | null> {
  const route = await resolveSiteRoute();
  if (!route) return null;
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE_URL}${path}${sep}tenant=${encodeURIComponent(route.tenantSlug)}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 60, tags: ['sparx-scheduling', `scheduling:${route.tenantSlug}`] },
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

/** A single bookable service by id, or null if it isn't bookable online. */
export async function getBookableService(id: string): Promise<PublicService | null> {
  const services = await listBookableServices();
  return services.find((s) => s.id === id) ?? null;
}

/** The active tenant slug — passed to the booking widget for its browser calls. */
export async function activeTenantSlug(): Promise<string | null> {
  return (await resolveSiteRoute())?.tenantSlug ?? null;
}
