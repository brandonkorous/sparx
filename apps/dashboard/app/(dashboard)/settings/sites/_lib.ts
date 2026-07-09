import type { Domain, Property } from '@/lib/sites';

// Shared, pure presentation helpers for the multi-site management surface — the
// list, the detail, and the domains tab all resolve status the same way so a
// "Live" site is green everywhere (docs/35 §9 status-is-its-own-axis). Kept in a
// plain `.ts` module so both the server detail body and the client list/tabs can
// import it.

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface StatusBadge {
  label: string;
  color: StatusTone;
}

/** A site's lifecycle → a semantic badge. */
export function siteStatusBadge(p: Property): StatusBadge {
  switch (p.status) {
    case 'active':
      return { label: 'Live', color: 'success' };
    case 'draft':
      return { label: 'Draft', color: 'warning' };
    case 'suspended':
      return { label: 'Suspended', color: 'danger' };
    default:
      return { label: p.status, color: 'neutral' };
  }
}

/** A domain's status → a semantic badge. sparx-zone subdomains are always live. */
export function domainStatusBadge(d: Domain): StatusBadge {
  if (d.type === 'subdomain') return { label: 'Live', color: 'success' };
  switch (d.status) {
    case 'active':
    case 'verified':
      return { label: 'Live', color: 'success' };
    case 'pending_ssl':
      return { label: 'SSL provisioning', color: 'warning' };
    case 'verifying':
    case 'pending':
      return { label: 'Verifying', color: 'warning' };
    case 'failed':
      return { label: 'Verification failed', color: 'danger' };
    case 'transfer_pending':
      return { label: 'Transfer pending', color: 'neutral' };
    default:
      return { label: d.status, color: 'neutral' };
  }
}

/** The domain that fronts a site — the canonical one, else the first. */
export function primaryDomainOf(domains: Domain[]): Domain | undefined {
  return domains.find((d) => d.isCanonical) ?? domains[0];
}

/** The brand colour a site's chip/avatar wears — its per-site brand override,
 *  falling back to the active-module accent (Builder indigo). */
export function siteChipColor(p: Property): string {
  const c = p.brandOverride?.colorPrimary?.trim();
  if (c) return c;
  return 'var(--color-module)';
}
