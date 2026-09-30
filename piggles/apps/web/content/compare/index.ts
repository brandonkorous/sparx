import type { ComparePage } from './types';
import { SQUARE } from './square';
import { SHOPIFY } from './shopify';
import { WIX } from './wix';
import { SQUARESPACE } from './squarespace';
import { HUBSPOT } from './hubspot';
import { ZOHO_ONE } from './zoho-one';

export type { ComparePage, ComparePoint, AreaId, AreaCell, Offer } from './types';
export { AREA_LABELS, AREA_APP, PIGGLES_AREAS } from './areas';

/**
 * The day every competitor fact on these pages was read from the competitor's
 * own site. Shown on every page. Change it only after re-checking every row in
 * piggles/docs/marketing/COMPETITORS-2026-09-30.md, never to make a page look fresh.
 */
export const CHECKED_ON = '2026-09-30';

/** In the order people most often ask about them. */
export const COMPARISONS: ComparePage[] = [SQUARE, SHOPIFY, WIX, SQUARESPACE, HUBSPOT, ZOHO_ONE];

export const COMPARISON_BY_SLUG: Record<string, ComparePage> = Object.fromEntries(
  COMPARISONS.map((c) => [c.slug, c])
);
