// Heading / Text / Divider / Stat / PriceTag — the typographic leaves of a
// builder page.
//
// These wear silica's OWN type-scale and stat classes (`h1`/`h2`/`h3`,
// `display-1`, `text-lg`, `stat`/`stat-value`/`stat-title`/`stat-desc`), so a
// tenant theme's `--font-head`, `--font-sans` and `--color-base-content` reach
// them with nothing in between. They exist as sparx components only because a
// builder LEAF needs a stable prop shape (`level`, `variant`, `ratio`) that the
// node's persisted props map onto — not because they restyle anything.
//
// SERVER components: no state, no handlers, no client bundle.
//
// One deliberate change from the retired `st-*` versions: `meta` no longer fades.
// It was a muted ink on text a visitor is meant to READ, which RULE #3 forbids;
// it is now simply smaller. Hierarchy comes from scale, not opacity.

import * as React from 'react';
import { cx } from '@wizeworks/silicaui-react/server';

// ── Heading ──────────────────────────────────────────────────────────────────

export type HeadingLevel = 'h1' | 'h2' | 'h3';

export interface SiteHeadingProps {
  level?: HeadingLevel;
  /** Opt into the fluid display/hero scale, independent of the semantic level —
   *  e.g. an `h1` rendered at display size. Omit for the level's own size. */
  size?: 'display';
  className?: string;
  id?: string;
  children?: React.ReactNode;
}

export function SiteHeading({
  level = 'h2',
  size,
  className,
  id,
  children,
}: SiteHeadingProps): React.ReactElement {
  const Tag = level;
  return (
    <Tag className={cx(size === 'display' ? 'display-1' : level, className)} id={id}>
      {children}
    </Tag>
  );
}
SiteHeading.displayName = 'SiteHeading';

// ── Text ─────────────────────────────────────────────────────────────────────

export type TextVariant = 'body' | 'eyebrow' | 'meta';

export interface SiteTextProps {
  variant?: TextVariant;
  className?: string;
  id?: string;
  children?: React.ReactNode;
}

const TEXT_VARIANT: Record<TextVariant, string> = {
  body: 'text-base leading-relaxed',
  // A tenant's own kicker. sparx's marketing surfaces don't get one (RULE #2),
  // but this is the site OWNER's design decision on their own page, and the
  // authored value is already persisted on the node.
  eyebrow: 'text-sm font-medium tracking-wide uppercase',
  meta: 'text-sm leading-relaxed',
};

export function SiteText({
  variant = 'body',
  className,
  id,
  children,
}: SiteTextProps): React.ReactElement {
  return (
    <p className={cx(TEXT_VARIANT[variant], className)} id={id}>
      {children}
    </p>
  );
}
SiteText.displayName = 'SiteText';

// ── Divider ──────────────────────────────────────────────────────────────────

export interface SiteDividerProps {
  className?: string;
}

/** A full-width hairline in the theme's border tone. Not silica's `divider`,
 *  which is a flex separator built to carry a label between two panes. */
export function SiteDivider({ className }: SiteDividerProps): React.ReactElement {
  return <hr className={cx('border-base-300 w-full border-0 border-t', className)} />;
}
SiteDivider.displayName = 'SiteDivider';

// ── Stat ─────────────────────────────────────────────────────────────────────

export interface SiteStatProps {
  value: React.ReactNode;
  label?: string;
  caption?: string;
  className?: string;
}

export function SiteStat({ value, label, caption, className }: SiteStatProps): React.ReactElement {
  return (
    <div className={cx('stat', className)}>
      <div className="stat-value">{value}</div>
      {label ? <div className="stat-title">{label}</div> : null}
      {caption ? <div className="stat-desc">{caption}</div> : null}
    </div>
  );
}
SiteStat.displayName = 'SiteStat';

// ── PriceTag ─────────────────────────────────────────────────────────────────

export interface PriceTagProps {
  amount?: number | null;
  /** Currency symbol prefix. Defaults to `$`. */
  currency?: string;
  className?: string;
}

/** A formatted monetary amount. An absent/non-finite amount renders nothing —
 *  an unbound price shows no stray `$0.00`. */
export function PriceTag({
  amount,
  currency = '$',
  className,
}: PriceTagProps): React.ReactElement | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return (
    <span className={cx('font-semibold tabular-nums', className)}>
      {`${currency}${amount.toFixed(2)}`}
    </span>
  );
}
PriceTag.displayName = 'PriceTag';
