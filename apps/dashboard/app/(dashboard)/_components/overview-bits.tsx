import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Button, Card, cn, colorClass } from '@sparx/ui';

// Small shared pieces for the module overview pages (docs/34 overview archetype).
// The charts/sample-data live in ./overview-charts; this file holds the
// formatters, the section-card wrapper, the "see all" link, and the compact
// metric tile those pages reuse so every module overview reads identically.

export { SampleBadge } from './overview-charts';
export type { SampleReason } from './overview-charts';

// ── liveOr: "sample until real" ──────────────────────────────
// Choose live data when the tenant actually has some, else fall back to the
// section's illustrative sample so a new/quiet tenant still sees a populated
// screen instead of a wall of "—". Returns the chosen data plus whether it's
// sample, so the caller renders <SampleBadge reason="no-data" /> only when it
// fell back. See docs/97-analytics-reporting-architecture.md §9.
//
//   const suppliers = liveOr(live?.bySupplier, SAMPLE_SUPPLIERS);
//   // supplier rows: ≥1 real row counts as live (a single row flips it).
//   <OverviewCard right={suppliers.isSample ? <SampleBadge reason="no-data" /> : undefined}>
//
// Arrays are "live enough" at length >= min (default 1 — a single row counts);
// scalars/objects are live when non-null. Charts that read poorly with one point
// can raise the bar with { min: 2 }.

export interface SampleResolution<T> {
  /** Live data when available, otherwise the sample fallback. */
  data: T;
  /** True when we fell back to sample — gate the badge on this. */
  isSample: boolean;
}

export function liveOr<T>(
  live: T | null | undefined,
  sample: T,
  opts?: { min?: number }
): SampleResolution<T> {
  const min = opts?.min ?? 1;
  const enough = Array.isArray(live) ? live.length >= min : live != null;
  return enough ? { data: live as T, isSample: false } : { data: sample, isSample: true };
}

// ── Formatters ───────────────────────────────────────────────
// All fail soft to an em dash so a missing/forbidden metric renders "—" rather
// than "NaN" or "$NaN" — overview pages call these on values that may be null
// when a report endpoint isn't reachable yet.

const DASH = '—';

export function fmtMoneyCents(cents?: number | null, currency = 'USD'): string {
  if (cents == null || Number.isNaN(cents)) return DASH;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function fmtMoney(amount?: number | null, currency = 'USD', fractionDigits = 0): string {
  if (amount == null || Number.isNaN(amount)) return DASH;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

export function fmtNumber(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return new Intl.NumberFormat('en-US').format(value);
}

/** A 0–1 ratio rendered as a percentage. */
export function fmtPercentRatio(ratio?: number | null, digits = 1): string {
  if (ratio == null || Number.isNaN(ratio)) return DASH;
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** An already-percent value (e.g. 48.6) rendered with a unit. */
export function fmtPercent(value?: number | null, digits = 1): string {
  if (value == null || Number.isNaN(value)) return DASH;
  return `${value.toFixed(digits)}%`;
}

// ── MetricTile ───────────────────────────────────────────────
// A compact bordered count tile for the secondary metric clusters (content
// types, segments, list growth, aging summaries) that sit below the headline
// Stat strip. Tone recolors the value for at-a-glance status.

export type MetricTone = 'default' | 'warning' | 'danger' | 'success' | 'module';

const TONE_CLASS: Record<MetricTone, string> = {
  default: 'text-[var(--color-text-primary)]',
  warning: 'text-[var(--color-warning-text)]',
  danger: 'text-[var(--color-danger-text)]',
  success: 'text-[var(--color-success-text)]',
  module: 'text-[var(--module-active-text)]',
};

export interface MetricTileProps {
  value: React.ReactNode;
  label: React.ReactNode;
  tone?: MetricTone;
  className?: string;
}

export function MetricTile({ value, label, tone = 'default', className }: MetricTileProps) {
  return (
    <div className={cn('rounded-md border border-[var(--color-border-default)] p-3', className)}>
      <div className={cn('text-xl leading-none font-medium', TONE_CLASS[tone])}>{value}</div>
      <div className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">{label}</div>
    </div>
  );
}

// ── OverviewCard ─────────────────────────────────────────────
// The section card every overview is built from: a module-tinted Card (its
// background wears the active module's subtle tint) with a title row — an
// optional module-colored icon, the title, an optional right slot (a CardLink
// or SampleBadge) — and an optional description above the body.
//
// On a DENSE cross-module page only ONE card per module hue should wear the
// tint — the section's "primary" card. Every other card passes `plain` to drop
// to a neutral surface so the screen doesn't become competing color washes. To
// tint a card in ANOTHER module's hue (e.g. a CRM panel on the Commerce page),
// wrap it in a nested <ModuleProvider module="crm"> — the tint, icon, and links
// all follow.

export interface OverviewCardProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned slot in the header — a CardLink or a SampleBadge. */
  right?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Render as a neutral surface instead of the module-tinted "primary" card.
   *  On dense cross-module pages, every card EXCEPT the one primary card per
   *  module hue should pass this. */
  plain?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function OverviewCard({
  title,
  icon,
  description,
  right,
  padding,
  plain,
  className,
  children,
}: OverviewCardProps) {
  return (
    <Card variant={plain ? 'default' : 'module'} padding={padding} className={className}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-medium text-[var(--color-text-primary)]">
            {icon && (
              <span aria-hidden className="text-[var(--module-active)]">
                {icon}
              </span>
            )}
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{description}</p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children}
    </Card>
  );
}

// ── OverviewRow ──────────────────────────────────────────────
// A list row: a tone-tinted icon square, a title + optional hint, and a
// right-aligned value/badge/link. The workhorse for payouts, inventory,
// deliverability checks, recover-&-grow, automations, and similar lists.

export interface OverviewRowProps {
  icon?: React.ReactNode;
  /** Icon-square color slot (role var). Default `module`. */
  tone?: string;
  title: React.ReactNode;
  hint?: React.ReactNode;
  /** Right-aligned slot — a formatted value, a Badge, or a CardLink/Button. */
  right?: React.ReactNode;
  className?: string;
}

export function OverviewRow({
  icon,
  tone = 'module',
  title,
  hint,
  right,
  className,
}: OverviewRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-[var(--color-border-default)] py-3 last:border-b-0',
        className
      )}
    >
      {icon && (
        <span
          aria-hidden
          className={cn(
            colorClass(tone),
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--c-tint,var(--color-bg-subtle))] text-[var(--c-ink,var(--color-text-primary))]'
          )}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">{title}</div>
        {hint && <div className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">{hint}</div>}
      </div>
      {right != null && (
        <div className="shrink-0 text-right text-sm font-medium text-[var(--color-text-primary)] tabular-nums">
          {right}
        </div>
      )}
    </div>
  );
}

// ── CardLink ─────────────────────────────────────────────────
// The "see all →" affordance in a card header. A module-colored text link with
// a trailing chevron, routed via next/link.

export function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button asChild color="module" variant="link" size="sm">
      <Link href={href}>
        {children}
        <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
      </Link>
    </Button>
  );
}
