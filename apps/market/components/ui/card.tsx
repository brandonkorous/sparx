// The marketplace's card surface, built ON silicaui's <Card> (never a hand-rolled
// div). One place owns the interactive-card treatment — the border, surface fill,
// and hover-lift shared by every clickable card (product, merchant, category,
// promo) — so appearance lives with the component, not copied across features.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card } from 'silicaui-react';
// Server-safe cx (the main barrel is 'use client'); works in server + client.
import { cx } from 'silicaui-react/server';

/** The shared interactive-card treatment: the hover-lift only. The base surface
 *  (base-100 fill, base-300 hairline border, radius, overflow) already comes from
 *  silicaui's <Card> — so we never re-declare it, only layer the hover state on
 *  top (a primary-tinted border + raised shadow). Apply to a <Card>:
 *  `INTERACTIVE_CARD_CLASS` for cards with their own inner links (product/merchant),
 *  <LinkCard> for whole-card link tiles. */
export const INTERACTIVE_CARD_CLASS =
  'transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg';

/** A whole-card link tile — an interactive silicaui <Card> wrapped in a Next
 *  <Link>. The `group` lives on the link so inner `group-hover:` (image zoom, arrow
 *  nudge) responds to hovering anywhere on the card. */
export function LinkCard({
  href,
  ariaLabel,
  className,
  children,
}: {
  href: string;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} aria-label={ariaLabel} className="group block">
      <Card className={cx(INTERACTIVE_CARD_CLASS, className)}>{children}</Card>
    </Link>
  );
}
