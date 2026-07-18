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
  // Deal creation is the single-step SurfaceFrame (full-bleed below); a created
  // deal opens into its detail view. Full page: /crm/deals/new.
  'deal',
  // Order creation is a multi-step SurfaceFrame (full-bleed below); a created
  // order opens into its detail view. Full page: <module>/orders/new — the
  // three order routes each have one; the overlay resolves the tenant's lens.
  'order',
  // Purchase order + transfer creation are multi-step SurfaceFrames (full-bleed
  // below); their editors stay full-page. Full pages live under /inventory/.
  'purchase-order',
  'transfer',
  'segment',
  // Task create-only overlay (no detail view); a created task returns to the list.
  'task',
  // Pipeline create-only overlay (detail is a full-width Kanban, not a drawer); a
  // created pipeline continues to its edit screen to add stages.
  'pipeline',
  'page',
  'content-type',
  'content-entry',
  // Billing-document creation is the multi-step SurfaceFrame (full-bleed below).
  // Its detail/editor stays full-page, but create opts into the drawer/modal so
  // the "New" button honors `defaultDetailView`. Full page: /invoicing/documents/new.
  'billing-document',
  // Workflow create-only overlay (the stage editor stays full-page); a created
  // workflow continues to its edit screen to add stages.
  'workflow',
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
  // Scheduling / B2B / Inventory / Dropship list surfaces whose create form moved
  // from a self-owned modal onto the SurfaceFrame overlay (docs/105 Wave 3). No
  // detail view — a created record returns to the list; editing rides a modal.
  'service',
  'resource',
  'booking-policy',
  'booking',
  'b2b-service-type',
  'b2b-pricing-tier',
  'inventory-source',
  'dropship-supplier',
  // Inventory supplier create-only overlay (detail stays full-page); a created
  // supplier opens its detail to add per-variant purchasing links.
  'supplier',
  // Inventory lot create-only overlay (the lot detail — serials + recalls — stays
  // full-page); a created lot navigates to its detail.
  'lot',
  // Inventory count create-only overlay (the count detail — quantity entry/review/
  // post — stays full-page); a created count navigates to its detail.
  'count',
  // A tenant SITE (web property) — the multi-step New-site wizard opts into the
  // overlay so "New site" honors defaultDetailView. Full page: /settings/sites/new.
  'site',
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
  'deal',
  'content-entry',
  'billing-document',
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
  'task',
  'pipeline',
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
  // Wave 3 list-surface create overlays (scheduling/b2b/inventory/dropship).
  'service',
  'resource',
  'booking-policy',
  'booking',
  'b2b-service-type',
  'b2b-pricing-tier',
  'inventory-source',
  'dropship-supplier',
  'supplier',
  'lot',
  'count',
  'workflow',
  // Multi-step New-site wizard fills the drawer/modal/page body edge-to-edge.
  'site',
]);

export function isFullBleedCreate(typeId: string): boolean {
  return FULL_BLEED_CREATE_TYPES.has(typeId);
}

// Detail (edit) views whose body owns its own padding, scroll, and height and so
// must be handed the whole drawer/modal/full-page body edge-to-edge instead of
// the default padded single-scroll column. Two shapes qualify (docs/86):
//   - SINGLE-FORM edits rendered on the same F-shell SurfaceFrame as their create
//     sibling (category) — the frame owns the field card + pinned floor toolbar.
//   - TABBED record details that run a full-height two-pane: a scrolling tab
//     column beside a persistent summary aside (product) — the aside only fills
//     its column edge-to-edge (matching the create wizard) when the body is a
//     fixed-height frame, which is exactly what full-bleed provides.
// A tabbed detail withOUT a summary aside (customer, b2b, …) keeps the default
// padded body. Client-safe so the detail-panel chrome can branch without the slot.
const FULL_BLEED_DETAIL_TYPES = new Set<string>(['category', 'product']);

export function isFullBleedDetail(typeId: string): boolean {
  return FULL_BLEED_DETAIL_TYPES.has(typeId);
}

// The narrow subset of full-bleed details: a SINGLE edit form (+ optional summary)
// that reads best in a tighter dialog so its fields don't stretch. Tabbed
// full-bleed details (product) instead want the wide canvas — room for the tab
// content AND the full-height summary aside — so they are deliberately excluded.
// Drives the modal width only; the body treatment is `isFullBleedDetail`.
const SINGLE_FORM_DETAIL_TYPES = new Set<string>(['category']);

export function isSingleFormDetail(typeId: string): boolean {
  return SINGLE_FORM_DETAIL_TYPES.has(typeId);
}

// Create overlays whose SurfaceFrame renders a live "draft summary" column (the
// F layout — docs/86). These are the record-building wizards where the right
// column earns the width. The modal host reads this to size the dialog wider
// (room for form + summary); creates absent from this set use a narrower,
// form-only modal so a lone form never floats in a too-wide dialog. A wizard
// joins this set ONLY once it actually passes SurfaceFrame a `summary` — otherwise
// the wide modal would frame a narrow form with empty gutters. The whole
// line-item document family now carries a live summary: order bills a party
// and rolls up to a total; purchase-order / transfer build against a supplier
// or route; billing-document (which a B2B quote/RFQ also is) mirrors its
// totals + deposit. Client-safe (no server import).
const SUMMARY_CREATE_TYPES = new Set<string>([
  'product',
  'order',
  'purchase-order',
  'transfer',
  'billing-document',
  // Record-builder wizards (not line-item docs) that earn the summary column too:
  // the customer full-profile wizard shows identity + its "fill to create" extras;
  // the B2B account wizard shows the account + pricing/credit + fleet size.
  'customer',
  'b2b-account',
  // Single-step create with a natural scope/status summary: the price list shows
  // name, channel scope, currency, priority, and its draft status as it's filled.
  'price-list',
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
