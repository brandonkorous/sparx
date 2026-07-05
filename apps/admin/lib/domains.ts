// Domain presentation helpers for the operator console (Slice 5). The platform
// `statusTone` dictionary doesn't carry the domain-lifecycle-specific statuses
// (`verifying`, `pending_ssl`, `transfer_pending`) — per the Badge convention,
// domain code keeps its own curated reading and delegates the rest to the shared
// dictionary so `active`/`verified`/`failed` stay consistent with everywhere else.

import { statusTone, statusLabel } from '@sparx/ui';
import type { OperatorDomainSslStatus } from '@sparx/operator';

type Tone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const DOMAIN_STATUS_TONE: Record<string, Tone> = {
  verifying: 'info',
  pending_ssl: 'info',
  transfer_pending: 'warning',
};

const DOMAIN_STATUS_LABEL: Record<string, string> = {
  pending_ssl: 'Provisioning SSL',
  transfer_pending: 'Transfer pending',
};

/** Semantic tone for a domain lifecycle status (curated first, then the shared
 *  platform dictionary). */
export function domainStatusTone(status: string): Tone {
  return DOMAIN_STATUS_TONE[status] ?? statusTone(status);
}

/** Display label for a domain status. */
export function domainStatusLabel(status: string): string {
  return DOMAIN_STATUS_LABEL[status] ?? statusLabel(status);
}

/** Human label for the domain type. */
export function domainTypeLabel(type: string): string {
  switch (type) {
    case 'subdomain':
      return 'sparx.zone address';
    case 'custom':
      return 'Custom domain';
    case 'purchased':
      return 'Purchased through sparx';
    default:
      return type;
  }
}

/** SSL/TLS readiness → tone. Secured is a win; provisioning is in-motion;
 *  unsecured is inert (not alarming — a domain simply isn't verified yet). */
export function sslTone(ssl: OperatorDomainSslStatus): Tone {
  switch (ssl) {
    case 'secured':
      return 'success';
    case 'provisioning':
      return 'info';
    default:
      return 'neutral';
  }
}

export function sslLabel(ssl: OperatorDomainSslStatus): string {
  switch (ssl) {
    case 'secured':
      return 'TLS secured';
    case 'provisioning':
      return 'Provisioning';
    default:
      return 'Not secured';
  }
}

/** How a host proves ownership, in words. */
export function verificationMethodLabel(method: 'cname' | 'txt' | 'auto'): string {
  switch (method) {
    case 'cname':
      return 'CNAME record';
    case 'txt':
      return 'TXT control-proof';
    default:
      return 'Managed automatically';
  }
}
