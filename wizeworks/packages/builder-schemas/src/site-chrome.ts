// The shared `navbar` component seed builder (docs/98 §3.7, §5).
//
// A navbar is NOT a "header". It's a reusable component: a `<nav class="navbar">`
// that HAS three zones — `navbar-start`, `navbar-center`, `navbar-end`. The zone
// layout lives in CSS (surface-compile theme.ts, verbatim from daisyUI): the side
// zones are width:50%, the center is shrink-0 between them, so center content is
// dead-center regardless of what sits on either side. The site "header" is just a
// navbar placed at the top of the layout — placement, not a separate type.
//
// This is the ONE seed definition of that navbar, reused by the blank-site starter
// (starters.ts) AND every blueprint, so the navbar is authored once. Each caller
// passes its own per-tree `node()` factory (so ids keep the tree's prefix) and the
// content for each zone — the navbar shell is identical, the contents vary per
// site. To center the brand, a caller puts the Wordmark in the `center` zone (the
// blank-site starter does exactly this). There is no "centered" variant.
//
// Zod-free authoring data, like starters.ts / archetypes.ts.

import type { BuilderNode } from './node';

/** A per-tree seed-node factory (the `node()` helper in starters/blueprints, which
 *  wraps `seedNode` with the tree's id prefix). It must accept verbatim `cls` +
 *  `name` so the navbar shell can author raw `el:*` zones. */
export type SeedFactory = (
  type: string,
  opts?: {
    props?: Record<string, unknown>;
    bind?: string;
    cls?: string;
    name?: string;
    children?: BuilderNode[];
  }
) => BuilderNode;

/** The contents of each navbar zone (pre-built nodes from the caller's factory).
 *  Any zone may be empty — the navbar's `navbar-start`/`navbar-end` are width:50%
 *  and `navbar-center` is shrink-0 between them, so e.g. brand in `start` + action
 *  in `end` (empty center) reads as a normal bar, and brand in `center` is dead-
 *  center between whatever the side zones hold. */
export interface NavbarZones {
  start?: BuilderNode[];
  center?: BuilderNode[];
  end?: BuilderNode[];
}

/** The `navbar` component: a `<nav class="navbar">` with `navbar-start`,
 *  `navbar-center`, and `navbar-end` zones (docs/98 §5) — NOT a rigid `Section
 *  "Header"`. Brand/nav/actions live in whichever zone the caller chooses;
 *  centering the brand is just "put it in the center zone". `bg`/`border` are
 *  author utilities (the navbar utility is layout-only); fully editable +
 *  deletable like any node. */
export function navbar(node: SeedFactory, zones: NavbarZones): BuilderNode {
  return node('el:nav', {
    name: 'Navbar',
    cls: 'navbar border-b border-base-200 bg-base-100',
    props: { ariaLabel: 'Primary' },
    children: [
      node('el:div', {
        name: 'navbar-start',
        cls: 'navbar-start gap-3',
        children: zones.start ?? [],
      }),
      node('el:div', {
        name: 'navbar-center',
        cls: 'navbar-center gap-6',
        children: zones.center ?? [],
      }),
      node('el:div', {
        name: 'navbar-end',
        cls: 'navbar-end gap-3',
        children: zones.end ?? [],
      }),
    ],
  });
}
