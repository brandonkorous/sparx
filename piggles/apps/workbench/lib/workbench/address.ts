'use client';

// The address of a pane — one answer, used by everything that needs one.
//
// Three things ask this question and they must never disagree: the browser
// address bar (which tracks the focused pane), the copy-link controls, and any
// future share affordance. A second implementation is how "copy link" and "the
// bar" end up producing different URLs for the same pane, which is worse than
// having neither.
//
// One deliberate divergence, and it is not a second implementation: a pane may
// declare share params (lib/workbench/share-as.ts), which `usePaneLink` applies
// on top of the descriptor. The bar keeps naming the pane the operator has —
// a following pane, following — while a copied link names what they are looking
// at. Both go through the functions below; only the descriptor differs.
//
// WHY THE SITE IS ALWAYS ON A COPYABLE LINK. A link is written to be READ BY
// SOMEONE ELSE — pasted into a chat, sent in an email. The reader's workbench is
// on whatever business they last used, and records belong to exactly one, so an
// address without `?site=` opens the right surface against the wrong data. It is
// the difference between "here's the order" and "here's an order screen".

import { buildPath } from '@wizeworks/links';
import type { PaneDescriptor } from '../surfaces/descriptor';

/** The workbench root: your layout, no destination. What an unaddressable pane falls back to. */
export const ROOT_ADDRESS = '/';

/**
 * The root-relative address for a pane, or the root when it has none.
 *
 * A pane can legitimately have no address: a detail surface opened without its
 * record (a half-built descriptor), or — until the check script says otherwise —
 * a surface with no route. Falling back to the root is the honest answer, since
 * "your layout, as you left it" is exactly what the operator would get back.
 */
export function addressForPane(
  descriptor: PaneDescriptor | null | undefined,
  siteSlug?: string
): string {
  if (!descriptor) return ROOT_ADDRESS;
  return (
    buildPath(descriptor.surface, descriptor.params, siteSlug ? { site: siteSlug } : undefined) ??
    ROOT_ADDRESS
  );
}

/**
 * The absolute address for a pane, for a link that leaves this browser.
 *
 * Null — not the root — when the pane has no address, because a copy-link
 * control must HIDE rather than hand someone a link to the app in general when
 * they asked for a link to this thing.
 */
export function shareableAddressForPane(
  descriptor: PaneDescriptor | null | undefined,
  siteSlug?: string,
  origin?: string
): string | null {
  if (!descriptor) return null;
  const base = origin ?? (typeof window === 'undefined' ? '' : window.location.origin);
  if (!base) return null;
  return buildPath(descriptor.surface, descriptor.params, {
    origin: base,
    ...(siteSlug ? { site: siteSlug } : {}),
  });
}
