import * as React from 'react';
import { cva, type VariantProps } from '../../utils/cva';
import { cn } from '../../utils/cn';
import { chipTreatmentVariants, colorClass, type ColorKey } from '../_recipes/variants';

// Badge — status pill on the shared color × variant × size axes (docs/35).
// Default `neutral / soft` matches the old `default` variant.

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap',
  {
    variants: {
      variant: chipTreatmentVariants,
      size: {
        sm: 'px-1.5 py-0.5 text-[0.625rem]',
        md: 'px-2 py-0.5 text-xs',
        lg: 'px-2.5 py-1 text-sm',
      },
    },
    defaultVariants: { variant: 'soft', size: 'md' },
  }
);

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>, VariantProps<typeof badgeVariants> {
  /** Semantic color slot (known slots autocomplete; any string accepted for
   *  runtime custom theme colors). Defaults to `neutral`. */
  color?: ColorKey | (string & {});
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, color = 'neutral', variant, size, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(colorClass(color), badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Badge.displayName = 'Badge';

// ── Status → tone ───────────────────────────────────────────────────────────
// A status pill IS a Badge — there is no separate StatusBadge. What makes one
// read at a glance is its COLOR, so the platform resolves a raw status string to
// a semantic tone HERE, once, and every list/detail renders
// `<Badge color={statusTone(s)} variant="soft">{statusLabel(s)}</Badge>`. That
// keeps "active"/"paid"/"completed" green and "failed"/"overdue"/"cancelled"
// red everywhere instead of bland neutral pills. The dictionary covers the
// universal business-status vocabulary; domain code with a different reading
// (e.g. a *completed* booking is inert, not a win) passes `color` to <Badge>
// directly or keeps its own curated map.

/** The tones a status pill can take (a subset of the semantic color slots). */
export type StatusTone = Extract<ColorKey, 'success' | 'warning' | 'info' | 'danger' | 'neutral'>;

const STATUS_TONE: Record<string, StatusTone> = {
  // success — live / good / settled
  active: 'success',
  live: 'success',
  published: 'success',
  enabled: 'success',
  online: 'success',
  open: 'success',
  ready: 'success',
  connected: 'success',
  verified: 'success',
  paid: 'success',
  completed: 'success',
  complete: 'success',
  confirmed: 'success',
  fulfilled: 'success',
  delivered: 'success',
  shipped: 'success',
  captured: 'success',
  succeeded: 'success',
  success: 'success',
  approved: 'success',
  won: 'success',
  available: 'success',
  in_stock: 'success',
  healthy: 'success',
  synced: 'success',
  accepted: 'success',
  converted: 'success',
  received: 'success',
  recovered: 'success',
  resolved: 'success',
  posted: 'success',
  // warning — needs attention / not yet live / partial
  draft: 'warning',
  pending: 'warning',
  requested: 'warning',
  scheduled: 'warning',
  queued: 'warning',
  waiting: 'warning',
  waitlisted: 'warning',
  on_hold: 'warning',
  hold: 'warning',
  review: 'warning',
  in_review: 'warning',
  partial: 'warning',
  partially_paid: 'warning',
  backordered: 'warning',
  backorder: 'warning',
  low_stock: 'warning',
  unverified: 'warning',
  trialing: 'warning',
  unpaid: 'warning',
  awaiting: 'warning',
  gated: 'warning',
  flagged: 'warning',
  awaiting_shipment: 'warning',
  abandoned: 'warning',
  credit_hold: 'warning',
  // info — in motion
  running: 'info',
  in_progress: 'info',
  in_transit: 'info',
  syncing: 'info',
  processing: 'info',
  sending: 'info',
  sent: 'info',
  new: 'info',
  placed: 'info',
  submitted: 'info',
  inspecting: 'info',
  reserved: 'info',
  // danger — failure / terminal-bad
  failed: 'danger',
  error: 'danger',
  cancelled: 'danger',
  canceled: 'danger',
  refunded: 'danger',
  declined: 'danger',
  rejected: 'danger',
  overdue: 'danger',
  expired: 'danger',
  past_due: 'danger',
  no_show: 'danger',
  lost: 'danger',
  blocked: 'danger',
  suspended: 'danger',
  banned: 'danger',
  out_of_stock: 'danger',
  disconnected: 'danger',
  unhealthy: 'danger',
  void: 'danger',
  voided: 'danger',
  chargeback: 'danger',
  denied: 'danger',
  spam: 'danger',
  bounced: 'danger',
  // neutral — inert / retired / done-quietly
  archived: 'neutral',
  inactive: 'neutral',
  disabled: 'neutral',
  closed: 'neutral',
  done: 'neutral',
  paused: 'neutral',
  skipped: 'neutral',
  offline: 'neutral',
  deleted: 'neutral',
  spent: 'neutral',
  inspected: 'neutral',
  released: 'neutral',
  consumed: 'neutral',
  unknown: 'neutral',
  none: 'neutral',
};

function normalizeStatus(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/** Resolve a raw status string to its semantic Badge tone (`neutral` fallback). */
export function statusTone(status: string): StatusTone {
  return STATUS_TONE[normalizeStatus(status)] ?? 'neutral';
}

/** Humanize a raw status for display: `in_progress` → `In progress`. */
export function statusLabel(status: string): string {
  const s = status.trim().replace(/[_-]+/g, ' ');
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s;
}

export { badgeVariants };
