// Multi-site (web PROPERTY) reads + the active-site selection (docs/49). A tenant
// has one-or-more sites over a shared back office; the dashboard authors ONE at a
// time, chosen by the site switcher (a cookie → `x-sparx-property-id`, injected
// by lib/api-rest-client.ts). Server-only (these call api-rest with the staff JWT).

import { cookies } from 'next/headers';
import { api } from './api-rest-client';
import { ACTIVE_PROPERTY_COOKIE } from './api-rest-client';

/** Per-site brand + presentation override (docs/49 §3, Slice B) — null = inherit
 *  the tenant brand or theme. Any absent/null field inherits. */
export interface BrandOverride {
  businessName?: string | null;
  colorPrimary?: string | null;
  colorPrimaryForeground?: string | null;
  colorAccent?: string | null;
  logoMediaId?: string | null;
  fontHeading?: string | null;
  fontBody?: string | null;
  colorBackground?: string | null;
  colorMuted?: string | null;
  colorBorder?: string | null;
  radiusBase?: string | null;
  hidePricesWhenSignedOut?: boolean | null;
}

export interface Property {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  isPrimary: boolean;
  status: string;
  settings: Record<string, unknown>;
  brandOverride: BrandOverride | null;
  createdAt: string;
  updatedAt: string;
}

export interface DomainInstructions {
  cname: { name: string; value: string };
  txt: { name: string; value: string } | null; // null for subdomain connects (CNAME-only proof)
}

export interface Domain {
  id: string;
  propertyId: string;
  host: string;
  type: string; // subdomain | custom | purchased
  status: string; // pending | verifying | verified | active | failed | pending_ssl | transfer_pending
  isCanonical: boolean;
  verifiedAt: string | null;
  // Purchase-specific fields (null for custom/zone domains)
  registrar: string | null;
  registrarOrderId: string | null;
  registeredAt: string | null;
  expiresAt: string | null;
  autoRenew: boolean;
  whoisPrivacy: boolean;
  renewalPriceCents: number | null;
  createdAt: string;
  instructions: DomainInstructions | null;
}

/** The tenant's web properties, primary first. */
export async function listProperties(): Promise<Property[]> {
  return api.get<Property[]>('/v1/properties');
}

/** All of the tenant's domains across every property. */
export async function listDomains(): Promise<Domain[]> {
  return api.get<Domain[]>('/v1/domains');
}

/** The active property id from the switcher cookie (null = the tenant's primary,
 *  which api-rest resolves server-side). */
export async function getActivePropertyId(): Promise<string | null> {
  return (await cookies()).get(ACTIVE_PROPERTY_COOKIE)?.value ?? null;
}

/** Resolve the property the dashboard is currently authoring — the cookie's id if
 *  it still names one of the tenant's properties, else the primary. Used to show
 *  the active site in the switcher and to label "you are editing <site>". */
export async function getActiveProperty(): Promise<Property | null> {
  const [props, activeId] = await Promise.all([
    listProperties().catch(() => [] as Property[]),
    getActivePropertyId(),
  ]);
  if (props.length === 0) return null;
  const match = activeId ? props.find((p) => p.id === activeId) : undefined;
  return match ?? props.find((p) => p.isPrimary) ?? props[0] ?? null;
}
