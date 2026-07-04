import type { Domain } from '@/lib/sites';

// Shared pure helpers for the Domains settings surface — the inventory table and
// the search/purchase section. Status is resolved once so it reads the same as
// everywhere else (docs/35 §9).

export type Tone = 'success' | 'warning' | 'danger' | 'neutral';

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/** A domain's status → a semantic badge. Expiry (for purchased domains) wins over
 *  the raw lifecycle status. */
export function domainStatus(d: Domain): { label: string; color: Tone } {
  if (d.type === 'purchased' && d.expiresAt) {
    const days = daysUntil(d.expiresAt);
    if (days !== null && days <= 7)
      return { label: `Expires in ${Math.max(1, days)}d`, color: 'danger' };
    if (days !== null && days <= 30) return { label: 'Expiring soon', color: 'warning' };
  }
  if (d.status === 'active' || d.status === 'verified')
    return { label: 'Active', color: 'success' };
  if (d.status === 'pending_ssl') return { label: 'SSL provisioning', color: 'warning' };
  if (d.status === 'verifying' || d.status === 'pending')
    return { label: 'Pending DNS', color: 'warning' };
  if (d.status === 'failed') return { label: 'Verification failed', color: 'danger' };
  if (d.status === 'transfer_pending') return { label: 'Transfer pending', color: 'neutral' };
  return { label: d.status, color: 'neutral' };
}

/** How the domain got here — the sparx-zone subdomain, a purchased registration,
 *  or a connected domain the tenant already owned. */
export function typeLabel(d: Domain): string {
  if (d.type === 'subdomain') return 'sparx zone';
  if (d.type === 'purchased') return 'Purchased';
  return 'Connected';
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
