// Maps a domain status string (order / invoice / quote / account / appointment)
// to a SparxBadge color. These follow standard status-color conventions; an
// unknown status falls back to neutral. Used by the account status pills.
import type { ColorKey } from '@sparx/site-ui';

export function statusColor(status: string): ColorKey {
  switch (status.toLowerCase()) {
    case 'success':
    case 'paid':
    case 'accepted':
    case 'active':
    case 'fulfilled':
    case 'completed':
    case 'delivered':
    case 'approved':
    case 'confirmed':
      return 'success';
    case 'danger':
    case 'overdue':
    case 'rejected':
    case 'expired':
    case 'cancelled':
    case 'canceled':
    case 'failed':
    case 'declined':
    case 'void':
      return 'danger';
    case 'warning':
    case 'sent':
    case 'pending':
    case 'draft':
    case 'processing':
    case 'open':
    case 'partial':
    case 'due':
    case 'unpaid':
    case 'on_hold':
    case 'scheduled':
      return 'warning';
    default:
      return 'neutral';
  }
}
