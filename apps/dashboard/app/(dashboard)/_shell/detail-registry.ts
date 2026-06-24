import { moduleManifests } from './registry';

// Client-safe manifest helpers for the detail-view system.
//
// IMPORTANT: this module is imported by client components (the detail-panel
// chrome, entity row links). It must NOT pull in any server-only detail
// content components — those live in `detail-slot.tsx`, a server-only module
// the parallel `@detail` route renders. Mixing the two is what dragged
// `next/headers` (via `_content.tsx` → `@sparx/auth`) into the client bundle.
//
// Adding a new entity to the detail-view system is a 3-step change:
//   1. Extract the page body into `<entity-route>/_content.tsx` so it
//      renders without full-page chrome.
//   2. Register the server component in `detail-slot.tsx`.
//   3. Set `hasDetailView: true` on the matching manifest entityType.

// Sentinel entity id meaning "create a new record of this type" rather than
// "open record <id>". The detail token reuses the existing `type:id` shape
// (`?drawer=collection:new`) — safe because record ids are cuids, never the
// literal string `new`. The `@detail` slot branches on this to render the
// create form instead of a detail body; `EntityCreateButton` writes it.
export const CREATE_SENTINEL = 'new';

// Entity type ids that have an overlay CREATE form registered in
// `detail-slot.tsx`'s `createComponents`. `EntityCreateButton` consults this
// (NOT `hasDetailView`) to decide whether a drawer/modal create is possible —
// an entity can have a detail view but no create overlay yet, in which case
// the create button must fall back to the full-page `/new` route rather than
// open an empty drawer. Kept in sync with `createComponents` by hand (the slot
// is server-only; this set is client-safe).
const CREATE_VIEW_TYPES = new Set<string>([
  'category',
  'collection',
  // Product creation is the multi-step SurfaceFrame flow (docs/86). It opts INTO
  // the drawer/modal overlay so the user's `defaultDetailView` preference picks
  // the style; unlike the single-column create forms it renders as the
  // SurfaceFrame `inline` variant and is flagged full-bleed below so the chrome
  // gives it the whole body. The full page lives at /commerce/products/new.
  'product',
  'warehouse',
  'price-list',
  'customer',
  'b2b-account',
  // Quote + Order creation are multi-step SurfaceFrames (full-bleed below); a
  // created record opens into its detail view. Full pages: /crm/quotes/new,
  // /crm/orders/new.
  'quote',
  'order',
  // Purchase order + transfer creation are multi-step SurfaceFrames (full-bleed
  // below); their editors stay full-page. Full pages live under /inventory/.
  'purchase-order',
  'transfer',
  'segment',
  'page',
  'content-type',
  'content-entry',
  // Billing-document creation is the multi-step SurfaceFrame (full-bleed below).
  // Its detail/editor stays full-page, but create opts into the drawer/modal so
  // the "New" button honors `defaultDetailView`. Full page: /invoicing/documents/new.
  'billing-document',
  // Single-column create overlays for list surfaces that previously rendered an
  // inline form in the page body. author + taxonomy flow into their detail view
  // on success; the rest have no detail view and stay open with an inline result.
  'gift-card',
  'account-credit',
  'author',
  'taxonomy',
  'redirect',
  'suppression',
  'sending-domain',
  // Commerce settings-area entities migrated to the F-shell create surface.
  // discount has no detail view (stays open / returns to the list); bundle +
  // shipping zone/profile + tax zone flow into their detail view on success.
  'discount',
  'bundle',
  'shipping-zone',
  'shipping-profile',
  'tax-zone',
  'configurator-template',
]);

export function hasCreateView(typeId: string): boolean {
  return CREATE_VIEW_TYPES.has(typeId);
}

// Create overlays whose content manages its own padding + height and should
// fill the drawer/modal body edge-to-edge, rather than sitting in the chrome's
// default padded, single-scroll column. The product SurfaceFrame (two-pane rail
// + working pane) is the first of these. Client-safe so the detail-panel chrome
// can branch without importing the server-only slot.
const FULL_BLEED_CREATE_TYPES = new Set<string>([
  'product',
  'customer',
  'b2b-account',
  'content-entry',
  'billing-document',
  'quote',
  'order',
  'purchase-order',
  'transfer',
  // Single-step create forms now render through the same F-shell (docs/86) — a
  // one-step SurfaceFrame with the pinned floor toolbar — so they are full-bleed
  // too (no padded card-in-body). Converted off the old card+footer shell so far;
  // the rest of the single-step forms join here as each is migrated.
  'category',
  'collection',
  'warehouse',
  'gift-card',
  'segment',
  'price-list',
  'content-type',
  'author',
  'taxonomy',
  'redirect',
  'account-credit',
  'suppression',
  'sending-domain',
  'page',
  'discount',
  'bundle',
  'shipping-zone',
  'shipping-profile',
  'tax-zone',
  'configurator-template',
]);

export function isFullBleedCreate(typeId: string): boolean {
  return FULL_BLEED_CREATE_TYPES.has(typeId);
}

// Detail (edit) views whose body IS a single edit form rendered through the same
// F-shell SurfaceFrame as its create sibling (docs/86 edit surface-type rule: a
// detail view that is one edit form → render it as a SurfaceFrame so create +
// edit are symmetric). Like full-bleed creates, the frame owns its own padding,
// scroll, and pinned floor toolbar, so the drawer/modal/full-page host must hand
// it the whole body edge-to-edge instead of the default padded scroll column.
// This is ONLY for single-form detail views — tabbed detail views (product,
// customer, …) keep the default padded body and clean up their edit PANEL in
// place. Client-safe so the detail-panel chrome can branch without the slot.
const FULL_BLEED_DETAIL_TYPES = new Set<string>(['category']);

export function isFullBleedDetail(typeId: string): boolean {
  return FULL_BLEED_DETAIL_TYPES.has(typeId);
}

// Create overlays whose SurfaceFrame renders a live "draft summary" column (the
// F layout — docs/86). These are the record-building wizards where the right
// column earns the width. The modal host reads this to size the dialog wider
// (room for form + summary); creates absent from this set use a narrower,
// form-only modal so a lone form never floats in a too-wide dialog. A wizard
// joins this set ONLY once it actually passes SurfaceFrame a `summary` — otherwise
// the wide modal would frame a narrow form with empty gutters. The whole
// line-item document family now carries a live summary: quote / order bill a
// party and roll up to a total; purchase-order / transfer build against a
// supplier or route; billing-document mirrors its totals + deposit. Client-safe
// (no server import).
const SUMMARY_CREATE_TYPES = new Set<string>([
  'product',
  'quote',
  'order',
  'purchase-order',
  'transfer',
  'billing-document',
  // Record-builder wizards (not line-item docs) that earn the summary column too:
  // the customer full-profile wizard shows identity + its "fill to create" extras;
  // the B2B account wizard shows the account + pricing/credit + fleet size.
  'customer',
  'b2b-account',
]);

export function isSummaryCreate(typeId: string): boolean {
  return SUMMARY_CREATE_TYPES.has(typeId);
}

// Parses a `type:id` token (the value of `?drawer=` / `?modal=`) into its
// parts. Returns null for malformed tokens (no colon, empty type, empty id).
// Pure and dependency-free so both the server `@detail` slot and the client
// panel chrome share one definition.
export function parseDetailToken(
  raw: string | null | undefined
): { typeId: string; entityId: string } | null {
  if (!raw) return null;
  const idx = raw.indexOf(':');
  if (idx < 1 || idx === raw.length - 1) return null;
  return { typeId: raw.slice(0, idx), entityId: raw.slice(idx + 1) };
}

// Finds the manifest entity type by id. Used by the detail panel chrome to
// resolve the entity's label, routePrefix, etc.
export function findEntityType(typeId: string) {
  for (const manifest of moduleManifests) {
    const et = manifest.entityTypes.find((e) => e.id === typeId);
    if (et) return { entityType: et, manifest };
  }
  return undefined;
}

// Whether an entity type opts into the drawer/modal detail view. Driven by
// the manifest flag rather than the server registry so client code can ask
// without importing server components.
export function hasDetailView(typeId: string): boolean {
  return findEntityType(typeId)?.entityType.hasDetailView === true;
}

// The full-page href for an open detail, or null when the entity can't build
// one from the token alone. Most entities live at `routePrefix/<id>`. A
// `content-entry` route is `/cms/types/<typeKey>/<id>`, so its token encodes
// both as `<typeKey>:<id>` — we split it back out here. Pure + client-safe so
// the detail-panel chrome can call it.
export function fullPageHrefFor(typeId: string, id: string): string | null {
  if (typeId === 'content-entry') {
    // Create has no type-scoped id yet — the maximize target is the wizard's
    // `/new` route (not a `<typeKey>:<id>` detail). Without this the split below
    // fails on the bare `new` and the chrome drops the maximize control.
    if (id === CREATE_SENTINEL) return '/cms/content/new';
    const sep = id.indexOf(':');
    if (sep < 1 || sep === id.length - 1) return null;
    return `/cms/types/${id.slice(0, sep)}/${id.slice(sep + 1)}`;
  }
  const found = findEntityType(typeId);
  if (!found) return null;
  return `${found.entityType.routePrefix}/${id}`;
}
